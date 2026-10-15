"""Telegram Web App ``initData`` verification.

Per ``miniapp/README.md`` earnings must be server-verified — the Mini App must
never assert a balance client-side. This module validates the signed
``window.Telegram.WebApp.initData`` string against the bot token so the backend
can trust the ``user`` object before crediting any watch-to-earn rewards.

Reference:
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
import hashlib
import hmac
import json
from urllib.parse import parse_qsl


def verify_init_data(init_data: str, bot_token: str, max_age_seconds: int = 86400):
    """Validate Telegram Web App initData.

    Returns the parsed ``user`` dict on success, or ``None`` if the signature is
    invalid, the token is missing, or (when provided) the auth_date is too old.
    """
    if not init_data or not bot_token:
        return None

    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    # data_check_string: all received fields except hash, sorted by key, "\n"-joined.
    data_check_string = "\n".join(f"{k}={parsed[k]}" for k in sorted(parsed))

    # secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    # expected hash = HMAC_SHA256(key=secret_key, msg=data_check_string) hex
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        return None

    # Optional freshness check to reject replayed initData.
    if max_age_seconds:
        import time
        auth_date = parsed.get("auth_date")
        if auth_date is not None:
            try:
                if time.time() - int(auth_date) > max_age_seconds:
                    return None
            except (TypeError, ValueError):
                return None

    user_raw = parsed.get("user")
    if not user_raw:
        return None
    try:
        return json.loads(user_raw)
    except json.JSONDecodeError:
        return None
