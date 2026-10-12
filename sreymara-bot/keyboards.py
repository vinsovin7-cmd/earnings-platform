from aiogram.types import (
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo
)

# Codespaces WebApp URL for Cinema
CINEMA_URL = "https://urban-space-palm-tree-6vvv649xjv7v35wgx-3000.app.github.dev/cinema.html"

def gender_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="👩 I'm a girl"), KeyboardButton(text="👨 I'm a guy")]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )

def pref_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Looking for men"), KeyboardButton(text="Looking for women")],
            [KeyboardButton(text="Everyone")]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )

def main_menu_keyboard(vip_tier="Standard"):
    badge = "👑 Elite" if vip_tier == "Elite" else ("💎 Diamond" if vip_tier == "Diamond" else "🌟 VIP")
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🔍 Match Online Now"), KeyboardButton(text="🍿 Watch Sreymara Cinema")],
            [KeyboardButton(text="🎁 Luxury Gifts & Store"), KeyboardButton(text="🤖 Ask Sreymara AI")],
            [KeyboardButton(text=f"👑 VIP Status ({badge})")]
        ],
        resize_keyboard=True
    )

def searching_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="❌ Cancel Search")]],
        resize_keyboard=True
    )

def active_chat_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🎁 Send Luxury Gift"), KeyboardButton(text="⏭️ Next Partner")],
            [KeyboardButton(text="🚪 Leave Chat")]
        ],
        resize_keyboard=True
    )

def cinema_inline_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🍿 Launch Cinema Streaming Room ↗",
                    web_app=WebAppInfo(url=CINEMA_URL)
                )
            ]
        ]
    )

def luxury_gifts_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🍾 Vintage Champagne (10 TRX)", callback_data="gift:champagne:10:🍾"),
                InlineKeyboardButton(text="🌹 Golden Rose (5 TRX)", callback_data="gift:rose:5:🌹")
            ],
            [
                InlineKeyboardButton(text="🏎️ Supercar Key (50 TRX)", callback_data="gift:supercar:50:🏎️"),
                InlineKeyboardButton(text="💎 Diamond Ring (100 TRX)", callback_data="gift:ring:100:💎")
            ]
        ]
    )