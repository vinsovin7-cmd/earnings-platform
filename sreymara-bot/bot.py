import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

import asyncio
from aiohttp import web
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from google import genai
from dotenv import load_dotenv

import database as db
import keyboards as kb
import moderation as mod
from admin_panel import create_admin_app

load_dotenv("sreymara-bot/.env")
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "0"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_CLIENT = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
db.init_db()

# --- STATES ---
class Onboarding(StatesGroup):
    gender = State()
    age = State()
    pref = State()
    photo = State()
    bio = State()

class AIChat(StatesGroup):
    chatting = State()

class SetWallet(StatesGroup):
    waiting_address = State()

# --- BULLETPROOF GEMINI ENGINE WITH AUTOMATIC FAILOVER ---
async def call_gemini_api(prompt: str) -> str:
    if not GEMINI_CLIENT:
        return "⚠️ Gemini API key is not configured in .env."

    # Priority order: Try 2.0 first, then 1.5, then flash-latest
    models_to_try = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-latest",
        "gemini-1.5-flash-8b"
    ]
    
    last_error = ""
    for model_name in models_to_try:
        try:
            response = await asyncio.wait_for(
                GEMINI_CLIENT.aio.models.generate_content(
                    model=model_name,
                    contents=prompt
                ),
                timeout=10
            )
            if response.text and response.text.strip():
                return response.text.strip()
            last_error = "Gemini returned an empty response."
        except Exception as e:
            last_error = str(e)
            continue
            
    return f"✨ Sreymara AI is experiencing high network traffic. Please try again shortly. ({last_error})"

async def generate_icebreaker(user1_bio, user2_bio):
    prompt = (
        f"Generate one witty, luxury conversation starter for two newly matched people. "
        f"Person 1: '{user1_bio}', Person 2: '{user2_bio}'. One short question only."
    )
    res = await call_gemini_api(prompt)
    if "⚠️" in res or "✨" in res:
        return "✨ If you could fly to any city tonight for dinner, where would it be?"
    return res

# --- GREETING & CONVERSATIONAL CATCH-ALL (NO /start NEEDED) ---
async def start_onboarding_or_menu(message: types.Message, state: FSMContext, custom_greeting=None):
    await state.clear()
    user = db.get_user(message.from_user.id)
    if user:
        if user[12]: # is_banned
            await message.answer("🚫 Your account has been suspended by Sreymara administration.")
            return
        greeting = custom_greeting or "Welcome back to Sreymara Luxury Lounge ✨"
        await message.answer(greeting, reply_markup=kb.main_menu_keyboard(user[7]))
        return

    welcome_text = (
        f"I'm so glad to hear from you! 😊\n\n"
        f"Welcome to **Sreymara Luxury Lounge & Cinema** ✨\n"
        f"Here you can meet verified people, watch exclusive live movies, and earn crypto rewards just for chatting!\n\n"
        f"Let's get your profile ready. **Select your gender below:**"
    )
    await state.set_state(Onboarding.gender)
    await message.answer(welcome_text, reply_markup=kb.gender_keyboard())

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    await start_onboarding_or_menu(message, state)

@dp.message(Onboarding.gender)
async def process_gender(message: types.Message, state: FSMContext):
    await state.update_data(gender=message.text)
    await state.set_state(Onboarding.age)
    await message.answer("How old are you? (Enter a number)", reply_markup=types.ReplyKeyboardRemove())

@dp.message(Onboarding.age)
async def process_age(message: types.Message, state: FSMContext):
    if not message.text.isdigit():
        await message.answer("Please enter a valid age number:")
        return
    await state.update_data(age=int(message.text))
    await state.set_state(Onboarding.pref)
    await message.answer("Who are you looking to meet?", reply_markup=kb.pref_keyboard())

@dp.message(Onboarding.pref)
async def process_pref(message: types.Message, state: FSMContext):
    await state.update_data(pref=message.text)
    await state.set_state(Onboarding.photo)
    await message.answer("Upload a profile photo:", reply_markup=types.ReplyKeyboardRemove())

@dp.message(Onboarding.photo, F.photo)
async def process_photo(message: types.Message, state: FSMContext):
    await state.update_data(photo_id=message.photo[-1].file_id)
    await state.set_state(Onboarding.bio)
    await message.answer("Write a short bio about yourself:")

@dp.message(Onboarding.bio)
async def process_bio(message: types.Message, state: FSMContext):
    data = await state.get_data()
    db.save_user(
        user_id=message.from_user.id,
        username=message.from_user.username or "",
        gender=data["gender"],
        age=data["age"],
        pref=data["pref"],
        photo_id=data["photo_id"],
        bio=message.text
    )
    await state.clear()
    await message.answer(
        "🎉 Profile created successfully!\n"
        "💰 **50 Sreymara Reward Points added to your account.**\n"
        "Explore Cinema, chat to earn, or find a partner below:",
        reply_markup=kb.main_menu_keyboard("Standard")
    )

# --- 🍿 LIVE CINEMA (WATCH-TO-EARN) ---
@dp.message(F.text == "🍿 Watch Sreymara Cinema")
async def launch_cinema(message: types.Message):
    db.add_activity_reward(message.from_user.id, points=5, watch_mins=15)
    await message.answer(
        "🎬 **Sreymara Cinema & Watch-to-Earn**\n\n"
        "✨ Streaming movies earns you **Sreymara Points** trackable towards USDT/TRX rewards.\n"
        "👑 VIP members get high-definition streams and exclusive premieres.\n\n"
        "Tap below to launch the streaming theater:",
        reply_markup=kb.cinema_inline_keyboard()
    )

# --- 👑 VIP STATUS ---
@dp.message(F.text.startswith("👑 VIP Status"))
async def vip_store(message: types.Message):
    user = db.get_user(message.from_user.id)
    tier = user[7] if user else "Standard"
    points = user[8] if user else 50
    
    vip_text = (
        f"👑 **Sreymara VIP & Diamond Lounge**\n\n"
        f"Current Tier: **{tier}**\n"
        f"Reward Points Balance: **{points} Points**\n\n"
        f"💎 **Diamond VIP Benefits:**\n"
        f"• ⚡ Priority live matchmaking (skip the queue)\n"
        f"• 🍿 2x Cinema Watch-to-Earn Rewards\n"
        f"• 🌟 Diamond badge in chat rooms\n"
        f"• 🤖 Unlimited Gemini AI personal coaching\n\n"
        f"Manage your tier from your Sreymara Command Center dashboard."
    )
    await message.answer(vip_text)

# --- 🎁 LUXURY GIFTS & TIPPING ---
@dp.message(F.text == "🎁 Luxury Gifts & Store")
async def show_store(message: types.Message):
    user = db.get_user(message.from_user.id)
    balance = user[8] if user else 50
    wallet = user[11] if user and user[11] else "Not Linked"
    
    await message.answer(
        f"💎 **Sreymara Vault & Rewards**\n\n"
        f"💰 Balance: **{balance} Points**\n"
        f"🔗 Tron/USDT Wallet: `{wallet}`\n\n"
        f"Send luxury gifts in anonymous chats or link your wallet for payouts.\n"
        f"Send /wallet to link your crypto address.",
        reply_markup=kb.luxury_gifts_keyboard()
    )

@dp.message(Command("wallet"))
async def prompt_wallet(message: types.Message, state: FSMContext):
    await state.set_state(SetWallet.waiting_address)
    await message.answer("Please send your Tron (TRX / USDT TRC-20) address:")

@dp.message(SetWallet.waiting_address)
async def save_wallet_address(message: types.Message, state: FSMContext):
    addr = message.text.strip()
    db.save_wallet(message.from_user.id, addr)
    await state.clear()
    await message.answer(f"✅ Wallet saved: `{addr}`\nYour rewards and gift earnings are now linked!")

@dp.message(F.text == "🎁 Send Luxury Gift")
async def send_gift_in_chat(message: types.Message):
    partner_id = db.get_partner(message.from_user.id)
    if not partner_id:
        await message.answer("You are not in an active chat room.")
        return
    await message.answer("Choose a luxury gift to send:", reply_markup=kb.luxury_gifts_keyboard())

@dp.callback_query(F.data.startswith("gift:"))
async def handle_gift(call: types.CallbackQuery):
    _, gift_name, value, icon = call.data.split(":")
    partner_id = db.get_partner(call.from_user.id)
    
    db.record_gift(call.from_user.id, partner_id or 0, gift_name, icon, int(value))
    await call.answer(f"Sent {icon} {gift_name.title()}!", show_alert=True)
    
    if partner_id:
        db.add_activity_reward(partner_id, points=int(value))
        await bot.send_message(
            partner_id,
            f"🎁 **Luxury Gift Received!**\nYour partner sent you a {icon} **{gift_name.title()}** (+{value} Points added to your balance) ✨"
        )

# --- 🔍 LIVE MATCHING WITH GEMINI ICEBREAKERS ---
@dp.message(F.text == "🔍 Match Online Now")
async def start_search(message: types.Message):
    user = db.get_user(message.from_user.id)
    if user and user[12]: # is_banned
        await message.answer("🚫 Account suspended.")
        return

    is_vip = user[7] in ["Diamond", "Elite"] if user else False
    partner_id = db.join_queue(message.from_user.id, is_vip=is_vip)

    if partner_id:
        partner_user = db.get_user(partner_id)
        icebreaker = await generate_icebreaker(user[6] if user else "", partner_user[6] if partner_user else "")

        msg = (
            f"✨ **Matched Anonymously!**\n"
            f"💡 *Gemini Icebreaker*: \"{icebreaker}\"\n\n"
            f"(Use 🎁 to send gifts or ⏭️ to find another partner)"
        )
        await bot.send_message(message.from_user.id, msg, reply_markup=kb.active_chat_keyboard())
        await bot.send_message(partner_id, msg, reply_markup=kb.active_chat_keyboard())
    else:
        await message.answer("⏳ Finding someone online right now...", reply_markup=kb.searching_keyboard())

@dp.message(F.text == "❌ Cancel Search")
async def cancel_search(message: types.Message):
    db.leave_queue(message.from_user.id)
    await message.answer("Search cancelled.", reply_markup=kb.main_menu_keyboard())

@dp.message(F.text.in_(["🚪 Leave Chat", "⏭️ Next Partner"]))
async def leave_or_next(message: types.Message):
    partner = db.end_chat(message.from_user.id)
    if partner:
        await bot.send_message(partner, "Your partner left the chat.", reply_markup=kb.main_menu_keyboard())

    if message.text == "⏭️ Next Partner":
        await start_search(message)
    else:
        await message.answer("You left the chat.", reply_markup=kb.main_menu_keyboard())

# --- 🤖 GEMINI AI ASSISTANT ---
@dp.message(F.text == "🤖 Ask Sreymara AI")
async def enter_ai_mode(message: types.Message, state: FSMContext):
    await state.set_state(AIChat.chatting)
    await message.answer(
        "✨ **Sreymara AI Assistant Active**\nAsk me any question, request dating advice, translations, or tasks. Type 🔙 to return.",
        reply_markup=types.ReplyKeyboardMarkup(
            keyboard=[[types.KeyboardButton(text="🔙 Back to Main Menu")]],
            resize_keyboard=True
        )
    )

@dp.message(AIChat.chatting, F.text == "🔙 Back to Main Menu")
async def exit_ai_mode(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("Returned to Main Menu.", reply_markup=kb.main_menu_keyboard())

@dp.message(AIChat.chatting)
async def handle_ai_query(message: types.Message):
    await bot.send_chat_action(message.chat.id, "typing")
    reply = await call_gemini_api(message.text)
    await message.answer(reply)

# --- LIVE RELAY, ANTI-LEAK & CONVERSATIONAL CATCH-ALL ---
@dp.message()
async def universal_handler(message: types.Message, state: FSMContext):
    user = db.get_user(message.from_user.id)
    
    if not user:
        await start_onboarding_or_menu(message, state)
        return

    if user[12]: # is_banned
        await message.answer("🚫 Account suspended.")
        return

    partner_id = db.get_partner(message.from_user.id)
    if not partner_id:
        await message.answer("Choose an option from the menu below:", reply_markup=kb.main_menu_keyboard(user[7]))
        return

    text_to_check = message.text or message.caption or "[Media / Audio]"
    is_violation, reason = mod.check_message(text_to_check)

    db.log_message(
        sender_id=message.from_user.id,
        receiver_id=partner_id,
        text=text_to_check,
        is_flagged=int(is_violation),
        flag_reason=reason
    )

    if is_violation:
        await message.reply("⚠️ Sreymara Policy: Sharing phone numbers, WhatsApp, or usernames is forbidden.")
        if ADMIN_CHANNEL_ID:
            await bot.send_message(ADMIN_CHANNEL_ID, f"🚨 Scam/Leak Detected:\nUser: {message.from_user.id}\nReason: {reason}\nContent: {text_to_check}")
        return

    db.add_activity_reward(message.from_user.id, points=1)

    if message.text:
        await bot.send_message(partner_id, message.text)
    elif message.photo:
        await bot.send_photo(partner_id, message.photo[-1].file_id, caption=message.caption)
    elif message.voice:
        await bot.send_voice(partner_id, message.voice.file_id)

async def main():
    print("Sreymara Live & AI Bot is starting...")
    
    app = create_admin_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    await site.start()
    print("🛡️ Sreymara Admin Dashboard running at http://0.0.0.0:8080")

    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())