import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

import asyncio
from aiohttp import web
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandObject
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from google import genai
from dotenv import load_dotenv

import database as db
import keyboards as kb
import moderation as mod
import admin_panel
from admin_panel import create_admin_app

load_dotenv("sreymara-bot/.env")
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "0"))
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))
MINI_APP_URL = os.getenv(
    "MINI_APP_URL",
    "https://urban-space-palm-tree-6vvv649xjv7v35wgx-3000.app.github.dev/miniapp/index.html"
)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_CLIENT = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Bot username is resolved at startup (needed to build viral referral links).
BOT_USERNAME = os.getenv("BOT_USERNAME", "")

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
    pending_referrer = State()

class AIChat(StatesGroup):
    chatting = State()

class SetWallet(StatesGroup):
    waiting_address = State()

class Withdraw(StatesGroup):
    waiting_amount = State()

class AdminPanel(StatesGroup):
    waiting_search_id = State()
    waiting_broadcast = State()
    waiting_cashout = State()

# --- BULLETPROOF GEMINI ENGINE: gemini-1.5-flash + exponential backoff ---
GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_MAX_ATTEMPTS = 3

async def call_gemini_api(prompt: str) -> str:
    """Query Gemini with automatic exponential backoff (up to 3 attempts).

    Falls back to a graceful, on-brand response if the Google API is congested
    or quotas are exhausted, so users never see a raw error.
    """
    if not GEMINI_CLIENT:
        return "⚠️ Gemini API key is not configured in .env."

    last_error = ""
    for attempt in range(1, GEMINI_MAX_ATTEMPTS + 1):
        try:
            response = await asyncio.wait_for(
                GEMINI_CLIENT.aio.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=prompt
                ),
                timeout=15
            )
            if response.text and response.text.strip():
                return response.text.strip()
            last_error = "Gemini returned an empty response."
        except Exception as e:
            last_error = str(e)

        # Exponential backoff before the next attempt (1s, 2s, ...) — skip after last.
        if attempt < GEMINI_MAX_ATTEMPTS:
            await asyncio.sleep(2 ** (attempt - 1))

    # Graceful fallback after all attempts are exhausted.
    return ("✨ Sreymara AI is experiencing high network traffic right now. "
            "Please try again in a moment.")

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
async def start_onboarding_or_menu(message: types.Message, state: FSMContext, custom_greeting=None, referrer_id=None):
    await state.clear()
    user = db.get_user(message.from_user.id)
    if user:
        if user[12]: # is_banned
            await message.answer("🚫 Your account has been suspended by Sreymara administration.")
            return
        greeting = custom_greeting or "Welcome back to Sreymara Luxury Lounge ✨"
        await message.answer(greeting, reply_markup=kb.main_menu_keyboard(user[7], is_admin=(message.from_user.id == ADMIN_ID)))
        return

    # New user: remember the referrer (if any) so it can be applied once the
    # profile is created in process_bio(). We do NOT credit yet — the user row
    # does not exist until onboarding completes.
    if referrer_id and referrer_id != message.from_user.id:
        await state.update_data(referrer_id=referrer_id)

    welcome_text = (
        f"I'm so glad to hear from you! 😊\n\n"
        f"Welcome to **Sreymara Luxury Lounge & Cinema** ✨\n"
        f"Here you can meet verified people, watch exclusive live movies, and earn crypto rewards just for chatting!\n\n"
        f"Let's get your profile ready. **Select your gender below:**"
    )
    await state.set_state(Onboarding.gender)
    await message.answer(welcome_text, reply_markup=kb.gender_keyboard())

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext, command: CommandObject):
    # Viral referral deep-link: /start ref_<referrer_id>
    referrer_id = None
    if command.args:
        arg = command.args.strip()
        if arg.startswith("ref_"):
            candidate = arg[4:]
            if candidate.lstrip("-").isdigit():
                referrer_id = int(candidate)
    await start_onboarding_or_menu(message, state, referrer_id=referrer_id)

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
    user_id = message.from_user.id
    full_name = message.from_user.full_name or message.from_user.username or str(user_id)
    db.save_user(
        user_id=user_id,
        username=message.from_user.username or "",
        gender=data["gender"],
        age=data["age"],
        pref=data["pref"],
        photo_id=data["photo_id"],
        bio=message.text
    )

    # --- VIRAL REFERRAL ONBOARDING ---
    # If the user arrived via a /start ref_<id> deep-link, credit the referrer and
    # the new user now that both rows exist, then celebrate with the referrer.
    referrer_id = data.get("referrer_id")
    referral_result = None
    if referrer_id:
        referral_result = db.process_referral_onboarding(user_id, referrer_id)
        if referral_result:
            try:
                await bot.send_message(
                    referrer_id,
                    "🎉 Your friend just joined Sreymara Lounge! "
                    "+100 Points and 0.5 TRX credited to your balance."
                )
            except Exception as e:
                print(f"⚠️ Failed to notify referrer {referrer_id}: {e}")
    await state.clear()

    # --- REAL-TIME ADMIN REGISTRATION ALERT (right after awarding 50 points) ---
    # Enhanced with referral attribution + live 70% vault reserve.
    if ADMIN_ID:
        treasury = db.get_admin_treasury_stats()
        referrer_display = referrer_id if referral_result else (referrer_id or "Direct/Organic")
        dossier = (
            "🚨 NEW VIP USER REGISTERED\n"
            f"User ID: {user_id} | Referrer: {referrer_display}\n"
            f"Name: {full_name} | Age: {data['age']} | Gender: {data['gender']}\n"
            f"Bio: {message.text}\n"
            f"Platform Vault Reserve (70%): {treasury['available_admin_trx']:.4f} TRX"
        )
        try:
            await bot.send_message(ADMIN_ID, dossier)
        except Exception as e:
            print(f"⚠️ Failed to send registration alert to admin: {e}")

    await message.answer(
        "🎉 Profile created successfully!\n"
        "💰 **50 Sreymara Reward Points added to your account.**\n"
        "Explore Cinema, chat to earn, or find a partner below:",
        reply_markup=kb.main_menu_keyboard("Standard", is_admin=(user_id == ADMIN_ID))
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
    addr = (message.text or "").strip()
    # Persist to BOTH the legacy wallet_address column and the new trx_wallet
    # column so /balance, /claim and withdrawals all see the linked address.
    db.update_trx_wallet(message.from_user.id, addr)
    await state.clear()
    note = ""
    if not is_valid_trc20(addr):
        note = ("\n\n⚠️ Heads up: that doesn't look like a standard TRC-20 address "
                "(should start with 'T' and be 34 characters). "
                "You can update it anytime with `/trx <address>`.")
    await message.answer(
        f"✅ Wallet saved: `{addr}`\nYour rewards and gift earnings are now linked!{note}",
        parse_mode="Markdown",
        reply_markup=kb.trx_earnings_keyboard()
    )


# ==========================================================================
# CRYPTO & EARNINGS COMMANDS (/trx, /balance, /claim) + Merlin Rewards hub
# ==========================================================================
def is_valid_trc20(address: str) -> bool:
    """A TRC-20 (Tron) address starts with 'T' and is exactly 34 chars long."""
    return bool(address) and address.startswith("T") and len(address) == 34


async def show_balance(message: types.Message):
    """Shared renderer for /balance and the Refresh button."""
    u = db.get_user_full(message.from_user.id)
    if not u:
        await message.answer("Please complete your profile first with /start.")
        return
    points = u["merlin_points"] or 0
    available_trx = db.get_available_balance(message.from_user.id, "TRX")
    pending_usdt = u["total_earned_usdt"] or 0.0
    wallet = u["trx_wallet"] or "Not Linked"
    watch_min = u["watch_time_minutes"] or 0
    await message.answer(
        "💰 **Sreymara Balance**\n\n"
        f"✨ Sreymara Points: **{points}**\n"
        f"💵 Available TRX: **{available_trx:.4f} TRX**\n"
        f"🪙 Pending USDT Earnings: **{pending_usdt:.4f} USDT**\n"
        f"⏱️ Total Watch Time: **{watch_min} min**\n"
        f"🔗 TRC-20 Wallet: `{wallet}`\n\n"
        f"Convert points to TRX with /claim (rate: {int(db.POINTS_PER_TRX)} pts = 1 TRX).",
        reply_markup=kb.trx_earnings_keyboard()
    )


@dp.message(Command("trx"))
async def cmd_set_trx(message: types.Message, state: FSMContext):
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("Usage: `/trx <TRC20_address>`\nExample: `/trx TQn9Y2khEs95JWNG4MAeP2bKsKfMCcUxWy`", parse_mode="Markdown")
        return
    address = parts[1].strip()
    if not is_valid_trc20(address):
        await message.answer(
            "❌ **Invalid TRC-20 address.**\n"
            "A Tron address must start with `T` and be exactly 34 characters long.\n"
            "Please double-check and try again.",
            parse_mode="Markdown"
        )
        return
    db.update_trx_wallet(message.from_user.id, address)
    await state.clear()
    await message.answer(
        f"✅ **TRC-20 wallet linked!**\n`{address}`\n\n"
        "Your future TRX payouts will be sent here. Use /balance to view your earnings.",
        parse_mode="Markdown",
        reply_markup=kb.trx_earnings_keyboard()
    )


@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    await show_balance(message)


@dp.message(Command("claim"))
async def cmd_claim(message: types.Message):
    u = db.get_user_full(message.from_user.id)
    if not u:
        await message.answer("Please complete your profile first with /start.")
        return
    if not (u["trx_wallet"] or ""):
        await message.answer(
            "🔗 **Link your wallet first!**\n"
            "Send `/trx <your_TRC20_address>` before claiming TRX.",
            parse_mode="Markdown"
        )
        return
    result = db.claim_points_to_trx(message.from_user.id)
    if not result or not result.get("converted"):
        reason = (result or {}).get("reason", "Nothing to claim yet — keep watching to earn points!")
        await message.answer(f"⏳ {reason}")
        return
    await message.answer(
        "🎉 **Claim Successful!**\n\n"
        f"Converted **{result['points']} points** ➜ **{result['trx']:.4f} TRX**.\n"
        "Your TRX is now withdrawable via /balance → 💸 Withdraw TRX.",
        parse_mode="Markdown",
        reply_markup=kb.trx_earnings_keyboard()
    )


@dp.message(F.text == "💰 Merlin Rewards & TRX")
async def merlin_rewards_hub(message: types.Message):
    u = db.get_user_full(message.from_user.id)
    points = (u["merlin_points"] if u else 50) or 0
    available_trx = db.get_available_balance(message.from_user.id, "TRX") if u else 0.0
    await message.answer(
        "💎 **Merlin Rewards & TRX Hub**\n\n"
        f"✨ Points: **{points}**   |   💵 Available TRX: **{available_trx:.4f}**\n\n"
        "• Watch live streams & cinema to earn points automatically.\n"
        "• /claim converts points → TRX.\n"
        "• Link a TRC-20 wallet to withdraw.\n\n"
        "Choose an action below:",
        reply_markup=kb.trx_earnings_keyboard()
    )


@dp.message(F.text == "📡 Al Jazeera English Live")
async def al_jazeera_live(message: types.Message):
    await message.answer(
        "📡 **Al Jazeera English — Live 24/7**\n\n"
        "Tap below to open the live news stream inside the Mini App and start "
        "earning while you watch.",
        reply_markup=kb.stream_selector_keyboard()
    )


@dp.message(F.text == "👤 My Profile")
async def my_profile(message: types.Message):
    u = db.get_user_full(message.from_user.id)
    if not u:
        await message.answer("You don't have a profile yet. Send /start to create one!")
        return
    await message.answer(
        "👤 **Your Sreymara Profile**\n\n"
        f"🆔 ID: `{u['user_id']}`\n"
        f"👤 Username: @{u['username'] or 'none'}\n"
        f"⚧ Gender: {u['gender']}\n"
        f"🎂 Age: {u['age']}\n"
        f"👑 Tier: {u['vip_tier']}\n"
        f"✨ Points: {u['merlin_points']}\n"
        f"⏱️ Watch Time: {u['watch_time_minutes']} min\n"
        f"🔗 TRC-20 Wallet: `{u['trx_wallet'] or 'Not Linked'}`",
        parse_mode="Markdown"
    )


# --- 🚀 SHARE & EARN (viral referral) ---
@dp.message(F.text == "🚀 Share & Earn")
async def share_and_earn(message: types.Message):
    user_id = message.from_user.id
    # Resolve the bot username lazily (cached in BOT_USERNAME after first call).
    username = BOT_USERNAME
    if not username:
        try:
            me = await bot.get_me()
            username = me.username or ""
            globals()["BOT_USERNAME"] = username
        except Exception:
            username = ""
    if not username:
        await message.answer("⚠️ Referral links are temporarily unavailable. Please try again shortly.")
        return

    ref_link = f"https://t.me/{username}?start=ref_{user_id}"
    u = db.get_user_full(user_id) or {}
    ref_count = u.get("referral_count", 0) or 0
    await message.answer(
        "🚀 **Share & Earn**\n\n"
        "Invite friends with your personal link. When a friend joins and finishes "
        "their profile, you instantly earn **+100 Points and 0.5 TRX** — and they "
        "get a **+50 point** welcome bonus.\n\n"
        f"🔗 Your link:\n`{ref_link}`\n\n"
        f"👥 Friends referred so far: **{ref_count}**\n\n"
        "Tap below to forward it in one tap:",
        parse_mode="Markdown",
        reply_markup=kb.share_referral_keyboard(username, user_id)
    )


# --- 📺 SPONSOR AD WATCH-TO-EARN (70/30 split) ---
@dp.message(F.text == "📺 Watch Sponsor Ad")
async def watch_sponsor_ad(message: types.Message):
    if not db.get_user(message.from_user.id):
        await message.answer("Please complete your profile first with /start.")
        return
    gross = db.SPONSOR_AD_GROSS_TRX
    await message.answer(
        "📺 **Sponsor Spotlight**\n\n"
        "🎬 *Simulating a 15-second sponsor video…* 🍿\n\n"
        "Thanks for supporting our sponsors! Here's your reward:",
        parse_mode="Markdown"
    )
    # Simulate a 15-second view, then apply the silent 70/30 split
    # (0.10 gross TRX → 0.03 user / 0.07 admin treasury).
    result = db.credit_split_earnings(message.from_user.id, gross, 0)
    await message.answer(
        "✅ **Sponsor reward credited!**\n\n"
        f"💵 You earned: **+{result['user_trx']:.4f} TRX**\n"
        "✨ Sreymara Points: use /balance to view your total.\n\n"
        "Watch again anytime to keep earning!",
        parse_mode="Markdown",
        reply_markup=kb.trx_earnings_keyboard()
    )


# --- TRX hub inline callbacks ---
@dp.callback_query(F.data == "trx:refresh")
async def cb_trx_refresh(call: types.CallbackQuery):
    await call.answer()
    await show_balance(call.message)


@dp.callback_query(F.data == "trx:main_menu")
async def cb_trx_main_menu(call: types.CallbackQuery):
    await call.answer()
    u = db.get_user(call.from_user.id)
    tier = u[7] if u else "Standard"
    await call.message.answer("Main Menu:", reply_markup=kb.main_menu_keyboard(tier, is_admin=(call.from_user.id == ADMIN_ID)))


@dp.callback_query(F.data == "trx:set_wallet")
async def cb_trx_set_wallet(call: types.CallbackQuery, state: FSMContext):
    await call.answer()
    await state.set_state(SetWallet.waiting_address)
    await call.message.answer("📥 Please send your TRC-20 (Tron) wallet address:")


@dp.callback_query(F.data == "trx:withdraw")
async def cb_trx_withdraw(call: types.CallbackQuery, state: FSMContext):
    await call.answer()
    u = db.get_user_full(call.from_user.id)
    if not u or not (u["trx_wallet"] or ""):
        await call.message.answer("🔗 Link a TRC-20 wallet first with `/trx <address>`.", parse_mode="Markdown")
        return
    available = db.get_available_balance(call.from_user.id, "TRX")
    if available <= 0:
        await call.message.answer("💵 You have no withdrawable TRX yet. Watch streams and /claim to earn more.")
        return
    await state.set_state(Withdraw.waiting_amount)
    await call.message.answer(
        f"💸 **Withdraw TRX**\nAvailable: **{available:.4f} TRX**\n"
        f"Destination: `{u['trx_wallet']}`\n\n"
        "Enter the amount of TRX you'd like to withdraw:",
        parse_mode="Markdown"
    )


@dp.message(Withdraw.waiting_amount)
async def process_withdraw_amount(message: types.Message, state: FSMContext):
    try:
        amount = float((message.text or "").strip())
    except ValueError:
        await message.answer("❌ Please enter a valid number (e.g. 0.5):")
        return
    if amount <= 0:
        await message.answer("❌ Amount must be greater than zero.")
        return

    u = db.get_user_full(message.from_user.id)
    wallet = u["trx_wallet"] if u else None
    if not wallet:
        await state.clear()
        await message.answer("🔗 Link a TRC-20 wallet first with `/trx <address>`.", parse_mode="Markdown")
        return

    tx_id = db.record_withdrawal_request(message.from_user.id, amount, "TRX", wallet)
    await state.clear()
    if tx_id is None:
        available = db.get_available_balance(message.from_user.id, "TRX")
        await message.answer(f"❌ Insufficient balance. You can withdraw up to **{available:.4f} TRX**.", parse_mode="Markdown")
        return

    await message.answer(
        "✅ **Withdrawal request submitted!**\n\n"
        f"Amount: **{amount:.4f} TRX**\n"
        f"Request ID: `{tx_id}`\n"
        f"Wallet: `{wallet}`\n\n"
        "An admin will review and approve your payout shortly.",
        parse_mode="Markdown"
    )
    # Notify admin of the new payout request in real time.
    if ADMIN_ID:
        try:
            await bot.send_message(
                ADMIN_ID,
                f"💸 NEW WITHDRAWAL REQUEST\nID: {tx_id}\nUser: {message.from_user.id}\n"
                f"Amount: {amount:.4f} TRX\nWallet: `{wallet}`\n\n"
                "Open the Admin Panel → Pending Payout Queue to approve.",
                reply_markup=kb.admin_panel_keyboard()
            )
        except Exception as e:
            print(f"⚠️ Failed to notify admin of withdrawal: {e}")


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
    await message.answer("Search cancelled.", reply_markup=kb.main_menu_keyboard(is_admin=(message.from_user.id == ADMIN_ID)))

@dp.message(F.text.in_(["🚪 Leave Chat", "⏭️ Next Partner"]))
async def leave_or_next(message: types.Message):
    partner = db.end_chat(message.from_user.id)
    if partner:
        await bot.send_message(partner, "Your partner left the chat.", reply_markup=kb.main_menu_keyboard())

    if message.text == "⏭️ Next Partner":
        await start_search(message)
    else:
        await message.answer("You left the chat.", reply_markup=kb.main_menu_keyboard(is_admin=(message.from_user.id == ADMIN_ID)))

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
    await message.answer("Returned to Main Menu.", reply_markup=kb.main_menu_keyboard(is_admin=(message.from_user.id == ADMIN_ID)))

@dp.message(AIChat.chatting)
async def handle_ai_query(message: types.Message):
    await bot.send_chat_action(message.chat.id, "typing")
    reply = await call_gemini_api(message.text)
    await message.answer(reply)

# NOTE: The universal catch-all message handler has been moved to the very end of
# this file (just before main()) so that admin state handlers and command handlers
# registered later take priority in aiogram's first-match routing order.



# ==========================================================================
# ⚙️ ADMIN EXECUTIVE PANEL (metrics, payout queue, user dossier, broadcast)
# ==========================================================================
def _is_admin(user_id: int) -> bool:
    return ADMIN_ID != 0 and user_id == ADMIN_ID


@dp.message(F.text == "⚙️ Admin Executive Panel")
async def admin_panel_entry(message: types.Message):
    if not _is_admin(message.from_user.id):
        await message.answer("⛔ This area is restricted to Sreymara executives.")
        return
    await message.answer(
        "⚙️ **Sreymara Executive Command Center**\n\n"
        "Select an operation below:",
        parse_mode="Markdown",
        reply_markup=kb.admin_panel_keyboard()
    )


@dp.message(Command("admin"))
async def admin_panel_command(message: types.Message):
    if not _is_admin(message.from_user.id):
        await message.answer("⛔ This area is restricted to Sreymara executives.")
        return
    await message.answer(
        "⚙️ **Sreymara Executive Command Center**\n\nSelect an operation below:",
        parse_mode="Markdown",
        reply_markup=kb.admin_panel_keyboard()
    )


@dp.callback_query(F.data == "admin:metrics")
async def cb_admin_metrics(call: types.CallbackQuery):
    if not _is_admin(call.from_user.id):
        await call.answer("⛔ Not authorized", show_alert=True)
        return
    await call.answer()
    m = db.get_admin_dashboard_metrics()
    await call.message.answer(
        "📊 **Live Metrics Dashboard**\n\n"
        f"👥 Total Users: **{m['total_users']}**\n"
        f"🆕 Registrations (24h): **{m['registrations_24h']}**\n"
        f"💵 Total TRX Distributed: **{m['total_trx_distributed']:.4f} TRX**\n"
        f"🪙 Pending USDT Earnings: **{m['total_usdt_pending']:.4f} USDT**\n"
        f"⏳ Pending Payouts: **{m['pending_payouts']}** ({m['pending_payout_amount']:.4f} TRX)\n"
        f"📡 Active Streamers/Sessions: **{m['active_streamers']}**",
        parse_mode="Markdown",
        reply_markup=kb.admin_panel_keyboard()
    )


@dp.callback_query(F.data == "admin:main")
async def cb_admin_main(call: types.CallbackQuery):
    if not _is_admin(call.from_user.id):
        await call.answer("⛔ Not authorized", show_alert=True)
        return
    await call.answer()
    await call.message.answer(
        "⚙️ **Sreymara Executive Command Center**\n\nSelect an operation below:",
        parse_mode="Markdown",
        reply_markup=kb.admin_panel_keyboard()
    )


async def _render_treasury(message: types.Message):
    """Shared renderer for the 70/30 vault dashboard."""
    t = db.get_admin_treasury_stats()
    await message.answer(
        "👑 **Platform Treasury — 70% Vault**\n\n"
        f"📈 Total Gross Ecosystem Volume (100%): **{t['total_gross_revenue_trx']:.4f} TRX**\n"
        f"🏦 Platform Net Profit (70%): **{t['total_admin_profit_trx']:.4f} TRX**\n"
        f"✅ Available for Cashout: **{t['available_admin_trx']:.4f} TRX**\n"
        f"👥 Total User Rewards Distributed (30%): **{t['total_user_payouts_trx']:.4f} TRX**\n"
        f"💸 Total Admin Withdrawn to Date: **{t['admin_withdrawn_trx']:.4f} TRX**\n"
        f"🔗 Saved Wallet: `{t['admin_wallet_address'] or 'Not set'}`",
        parse_mode="Markdown",
        reply_markup=kb.admin_treasury_menu_keyboard()
    )


@dp.callback_query(F.data == "admin:treasury")
async def cb_admin_treasury(call: types.CallbackQuery):
    if not _is_admin(call.from_user.id):
        await call.answer("⛔ Not authorized", show_alert=True)
        return
    await call.answer()
    await _render_treasury(call.message)


@dp.callback_query(F.data == "admin:cashout")
async def cb_admin_cashout(call: types.CallbackQuery, state: FSMContext):
    if not _is_admin(call.from_user.id):
        await call.answer("⛔ Not authorized", show_alert=True)
        return
    await call.answer()
    t = db.get_admin_treasury_stats()
    if t["available_admin_trx"] <= 0:
        await call.message.answer("💵 No treasury profit available to cash out yet.")
        return
    await state.set_state(AdminPanel.waiting_cashout)
    await call.message.answer(
        "🏦 **Admin Treasury Cashout**\n\n"
        f"Available: **{t['available_admin_trx']:.4f} TRX**\n"
        f"Saved wallet: `{t['admin_wallet_address'] or 'Not set'}`\n\n"
        "Send the amount of TRX to withdraw, e.g. `0.5`\n"
        "(or send `amount wallet_address` to use a new destination, e.g. `0.5 TQn...`).",
        parse_mode="Markdown"
    )


@dp.message(AdminPanel.waiting_cashout)
async def process_admin_cashout(message: types.Message, state: FSMContext):
    if not _is_admin(message.from_user.id):
        await state.clear()
        return
    raw = (message.text or "").strip().split()
    try:
        amount = float(raw[0])
    except (ValueError, IndexError):
        await message.answer("❌ Enter a valid amount, e.g. `0.5` or `0.5 TQn...`")
        return
    # Destination: explicit arg > saved wallet.
    destination = raw[1] if len(raw) > 1 else ""
    if not destination:
        destination = db.get_admin_treasury_stats().get("admin_wallet_address") or ""
    if not destination:
        await message.answer("❌ Provide a destination wallet, e.g. `0.5 TQn9Y2kh...`")
        return
    await state.clear()

    wd_id = db.record_admin_cashout(amount, destination)
    if wd_id is None:
        avail = db.get_admin_treasury_stats()["available_admin_trx"]
        await message.answer(f"❌ Insufficient treasury. Available: **{avail:.4f} TRX**", parse_mode="Markdown")
        return
    t = db.get_admin_treasury_stats()
    await message.answer(
        "✅ **Admin cashout recorded!**\n\n"
        f"Amount: **{amount:.4f} TRX**\n"
        f"Destination: `{destination}`\n"
        f"Withdrawal ID: `{wd_id}`\n\n"
        f"Remaining available: **{t['available_admin_trx']:.4f} TRX**",
        parse_mode="Markdown",
        reply_markup=kb.admin_treasury_menu_keyboard()
    )


@dp.callback_query(F.data == "admin:payouts")
async def cb_admin_payouts(call: types.CallbackQuery):
    if not _is_admin(call.from_user.id):
        await call.answer("⛔ Not authorized", show_alert=True)
        return
    await call.answer()
    pending = db.get_pending_withdrawals()
    if not pending:
        await call.message.answer("✅ No pending payout requests. The queue is clear.")
        return
    for row in pending[:10]:
        tx_id, user_id, currency, amount, status, created, username, trx_wallet, legacy_wallet = row
        wallet = trx_wallet or legacy_wallet or "Not Linked"
        await call.message.answer(
            f"💸 **Payout Request #{tx_id}**\n"
            f"👤 User: `{user_id}` (@{username or 'none'})\n"
            f"💰 Amount: **{amount:.4f} {currency}**\n"
            f"🔗 Wallet: `{wallet}`\n"
            f"🕒 Requested: {created}",
            parse_mode="Markdown",
            reply_markup=kb.payout_review_keyboard(tx_id)
        )


@dp.callback_query(F.data.startswith("payout:"))
async def cb_payout_review(call: types.CallbackQuery):
    if not _is_admin(call.from_user.id):
        await call.answer("⛔ Not authorized", show_alert=True)
        return
    _, action, tx_id_raw = call.data.split(":")
    tx_id = int(tx_id_raw)
    if action == "approve":
        affected_user = db.set_transaction_status(tx_id, "PAID", tx_hash="")
        await call.answer("✅ Marked as PAID", show_alert=True)
        await call.message.edit_text(
            f"✅ **Payout #{tx_id} APPROVED** and marked as PAID.",
            parse_mode="Markdown"
        )
        if affected_user:
            try:
                await bot.send_message(affected_user, f"✅ Your withdrawal request #{tx_id} has been approved and paid! 🎉")
            except Exception:
                pass
    elif action == "reject":
        affected_user = db.set_transaction_status(tx_id, "REJECTED")
        await call.answer("❌ Rejected", show_alert=True)
        await call.message.edit_text(
            f"❌ **Payout #{tx_id} REJECTED.** The reserved balance has been released.",
            parse_mode="Markdown"
        )
        if affected_user:
            try:
                await bot.send_message(affected_user, f"❌ Your withdrawal request #{tx_id} was rejected. The reserved balance is available again.")
            except Exception:
                pass


@dp.callback_query(F.data == "admin:search")
async def cb_admin_search(call: types.CallbackQuery, state: FSMContext):
    if not _is_admin(call.from_user.id):
        await call.answer("⛔ Not authorized", show_alert=True)
        return
    await call.answer()
    await state.set_state(AdminPanel.waiting_search_id)
    await call.message.answer("🔍 Send the Telegram **User ID** you'd like to look up:", parse_mode="Markdown")


@dp.message(AdminPanel.waiting_search_id)
async def process_admin_search(message: types.Message, state: FSMContext):
    if not _is_admin(message.from_user.id):
        await state.clear()
        return
    raw = (message.text or "").strip()
    if not raw.lstrip("-").isdigit():
        await message.answer("❌ Please send a valid numeric Telegram User ID.")
        return
    target_id = int(raw)
    await state.clear()

    u = db.get_user_full(target_id)
    if not u:
        await message.answer(f"❌ No registered user found with ID `{target_id}`.", parse_mode="Markdown")
        return

    partner = db.get_partner(target_id)
    txs = db.get_user_transactions(target_id, limit=5)
    tx_lines = "\n".join(
        f"  • #{t[0]} {t[2]:.4f} {t[1]} — {t[4]}" for t in txs
    ) or "  (no transactions)"

    dossier = (
        "🗂 **USER DOSSIER**\n\n"
        f"🆔 ID: `{u['user_id']}`\n"
        f"👤 Username: @{u['username'] or 'none'}\n"
        f"⚧ Gender: {u['gender']} | 🎂 Age: {u['age']}\n"
        f"👑 Tier: {u['vip_tier']} | 🚦 Banned: {'Yes' if u['is_banned'] else 'No'}\n"
        f"📝 Bio: {u['bio']}\n"
        f"✨ Points: {u['merlin_points']} | ⏱️ Watch: {u['watch_time_minutes']} min\n"
        f"💵 Earned TRX: {u['total_earned_trx']:.4f} | 🪙 Earned USDT: {u['total_earned_usdt']:.4f}\n"
        f"🔗 TRC-20 Wallet: `{u['trx_wallet'] or 'Not Linked'}`\n"
        f"💬 In active chat: {'Yes (partner ' + str(partner) + ')' if partner else 'No'}\n"
        f"🧾 Recent transactions:\n{tx_lines}"
    )
    await message.answer(dossier, parse_mode="Markdown")


@dp.callback_query(F.data == "admin:broadcast")
async def cb_admin_broadcast(call: types.CallbackQuery, state: FSMContext):
    if not _is_admin(call.from_user.id):
        await call.answer("⛔ Not authorized", show_alert=True)
        return
    await call.answer()
    await state.set_state(AdminPanel.waiting_broadcast)
    await call.message.answer(
        "📢 **Global Broadcast**\n\nSend the announcement you'd like to deliver to ALL registered users.\n"
        "Reply to this message with your text (or send /cancel to abort).",
        parse_mode="Markdown"
    )


@dp.message(Command("cancel"))
async def admin_cancel(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("Cancelled.")


@dp.message(AdminPanel.waiting_broadcast)
async def process_admin_broadcast(message: types.Message, state: FSMContext):
    if not _is_admin(message.from_user.id):
        await state.clear()
        return
    text = message.text or message.caption or ""
    if not text.strip():
        await message.answer("❌ Broadcast text cannot be empty. Try again or /cancel.")
        return
    await state.clear()

    user_ids = db.get_all_user_ids()
    sent, failed = 0, 0
    status_msg = await message.answer(f"📢 Broadcasting to {len(user_ids)} users...")
    for uid in user_ids:
        try:
            await bot.send_message(uid, f"📢 **Sreymara Announcement**\n\n{text}", parse_mode="Markdown")
            sent += 1
        except Exception:
            failed += 1
    await status_msg.edit_text(
        f"📢 **Broadcast complete.**\n✅ Delivered: {sent}\n❌ Failed: {failed}"
    )


# --- LIVE RELAY, ANTI-LEAK & CONVERSATIONAL CATCH-ALL (registered LAST) ---
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
        await message.answer("Choose an option from the menu below:", reply_markup=kb.main_menu_keyboard(user[7], is_admin=(message.from_user.id == ADMIN_ID)))
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

    # Resolve the bot username once so viral referral links are ready immediately.
    global BOT_USERNAME
    if not BOT_USERNAME:
        try:
            me = await asyncio.wait_for(bot.get_me(), timeout=5)
            BOT_USERNAME = me.username or ""
            print(f"Bot username resolved: @{BOT_USERNAME}")
        except Exception as e:
            print(f"⚠️ Could not resolve bot username: {e}")

    # Let the admin panel / Mini App backend deliver DMs through the live bot.
    async def _bot_send(user_id: int, text: str) -> bool:
        try:
            await bot.send_message(user_id, text)
            return True
        except Exception:
            return False
    admin_panel.set_bot_sender(_bot_send)

    # Expose the Gemini engine (with its backoff/fallback) to the Mini App Srey AI chat.
    admin_panel.set_ai_responder(call_gemini_api)

    app = create_admin_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    await site.start()
    print("🛡️ Sreymara Admin Dashboard + Mini App API running at http://0.0.0.0:8080")

    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())