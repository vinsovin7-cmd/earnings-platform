import re

PHONE_PATTERN = re.compile(r'(\+?\d[\d\s\-().]{7,\d})')
TELEGRAM_HANDLE = re.compile(r'(@[a-zA-Z0-9_]{4,}|t\.me\/[a-zA-Z0-9_]+)', re.IGNORECASE)
WHATSAPP_KEYWORDS = re.compile(r'\b(whatsapp|whats\s*app|wa\.me|my\s*number|drop\s*number|watsapp)\b', re.IGNORECASE)

def check_message(text: str) -> tuple[bool, str]:
    if not text:
        return False, ""
    if WHATSAPP_KEYWORDS.search(text):
        return True, "WhatsApp keyword / solicitation"
    if TELEGRAM_HANDLE.search(text):
        return True, "Telegram username or link"
    digits = re.sub(r'\D', '', text)
    if len(digits) >= 9:
        return True, "Phone number format"
    return False, ""
