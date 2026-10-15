import os
from aiogram.types import (
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo
)

# Codespaces WebApp URL for Cinema
CINEMA_URL = "https://urban-space-palm-tree-6vvv649xjv7v35wgx-3000.app.github.dev/cinema.html"

# Telegram Mini App (cinema + watch-to-earn) launch URL. Overridable via env.
MINI_APP_URL = os.getenv(
    "MINI_APP_URL",
    "https://urban-space-palm-tree-6vvv649xjv7v35wgx-3000.app.github.dev/miniapp/index.html"
)
# Deep-link entry points so the Mini App can auto-select a channel on launch.
AL_JAZEERA_WEBAPP_URL = f"{MINI_APP_URL}#channel=aljazeera"
MERLIN_WEBAPP_URL = f"{MINI_APP_URL}#channel=merlin"

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

def main_menu_keyboard(vip_tier="Standard", is_admin=False):
    badge = "👑 Elite" if vip_tier == "Elite" else ("💎 Diamond" if vip_tier == "Diamond" else "🌟 VIP")
    rows = [
        # New Mini App cinema launcher (WebApp) + legacy cinema entry (kept for compatibility)
        [
            KeyboardButton(
                text="🎬 Urban Cinema & Lounge",
                web_app=WebAppInfo(url=MINI_APP_URL)
            ),
            KeyboardButton(text="🍿 Watch Sreymara Cinema")
        ],
        # Live news + crypto rewards hub
        [
            KeyboardButton(text="📡 Al Jazeera English Live"),
            KeyboardButton(text="💰 Merlin Rewards & TRX")
        ],
        # Matching + AI (existing handlers preserved)
        [
            KeyboardButton(text="🔍 Match Online Now"),
            KeyboardButton(text="🤖 Ask Sreymara AI")
        ],
        # Gifts store + profile
        [
            KeyboardButton(text="🎁 Luxury Gifts & Store"),
            KeyboardButton(text="👤 My Profile")
        ],
        # Viral growth + sponsor watch-to-earn
        [
            KeyboardButton(text="🚀 Share & Earn"),
            KeyboardButton(text="📺 Watch Sponsor Ad")
        ],
        # VIP status (existing handler preserved)
        [KeyboardButton(text=f"👑 VIP Status ({badge})")]
    ]
    # Executive panel only for the admin
    if is_admin:
        rows.append([KeyboardButton(text="⚙️ Admin Executive Panel")])
    return ReplyKeyboardMarkup(
        keyboard=rows,
        resize_keyboard=True
    )


def trx_earnings_keyboard():
    """Inline controls for the Merlin Rewards & TRX hub."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📥 Set TRC-20 Wallet", callback_data="trx:set_wallet"),
                InlineKeyboardButton(text="💸 Withdraw TRX", callback_data="trx:withdraw")
            ],
            [
                InlineKeyboardButton(text="🔄 Refresh Balance", callback_data="trx:refresh"),
                InlineKeyboardButton(text="🔙 Main Menu", callback_data="trx:main_menu")
            ]
        ]
    )


def stream_selector_keyboard():
    """Dual-channel stream launcher + watch-to-earn booster."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📺 Al Jazeera Live News",
                    web_app=WebAppInfo(url=AL_JAZEERA_WEBAPP_URL)
                ),
                InlineKeyboardButton(
                    text="🍿 Merlin Series VIP Channel",
                    web_app=WebAppInfo(url=MERLIN_WEBAPP_URL)
                )
            ],
            [
                InlineKeyboardButton(
                    text="💎 Boost Earnings (Watch to Earn)",
                    web_app=WebAppInfo(url=MINI_APP_URL)
                )
            ]
        ]
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

def admin_panel_keyboard():
    """Executive admin command center inline menu."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📊 Live Metrics Dashboard", callback_data="admin:metrics")],
            [InlineKeyboardButton(text="💸 Pending Payout Queue", callback_data="admin:payouts")],
            [
                InlineKeyboardButton(text="🔍 User Search", callback_data="admin:search"),
                InlineKeyboardButton(text="📢 Global Broadcast", callback_data="admin:broadcast")
            ],
            [InlineKeyboardButton(text="👑 Platform Treasury (70% Vault)", callback_data="admin:treasury")],
            [InlineKeyboardButton(text="🖥️ Open Web Dashboard", url="http://localhost:8080")]
        ]
    )


def admin_treasury_menu_keyboard():
    """70/30 treasury dashboard + cashout controls (admin-only)."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🏦 Withdraw Admin Treasury (TRX)", callback_data="admin:cashout")],
            [
                InlineKeyboardButton(text="🔄 Refresh Vault", callback_data="admin:treasury"),
                InlineKeyboardButton(text="⬅️ Back", callback_data="admin:main")
            ]
        ]
    )


def share_referral_keyboard(bot_username, user_id):
    """1-tap forward/share button for the viral referral link."""
    ref_link = f"https://t.me/{bot_username}?start=ref_{user_id}"
    share_text = "🍿 Join Sreymara Lounge & Cinema! Watch live movies, chat with AI, and earn real TRX crypto!"
    # Telegram share deep-link that pre-fills the message for 1-tap forwarding.
    share_url = f"https://t.me/share/url?url={ref_link}&text={share_text}"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📤 Share & Earn (Forward)", url=share_url)],
            [InlineKeyboardButton(text="🔙 Main Menu", callback_data="trx:main_menu")]
        ]
    )


def payout_review_keyboard(tx_id):
    """Approve / reject controls for a single pending withdrawal."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Approve & Mark Paid", callback_data=f"payout:approve:{tx_id}"),
                InlineKeyboardButton(text="❌ Reject", callback_data=f"payout:reject:{tx_id}")
            ]
        ]
    )
