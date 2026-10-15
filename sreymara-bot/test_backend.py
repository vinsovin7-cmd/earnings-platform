"""End-to-end backend test: webapp_auth HMAC + admin_panel aiohttp handlers.

Runs without aiogram (uses a stub bot sender). Validates the server-verified
watch-to-earn trust boundary and the payout lifecycle.

Run:  python sreymara-bot/test_backend.py
"""
import asyncio
import hashlib
import hmac
import os
import sqlite3
import sys
import time
from urllib.parse import urlencode

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database as db
import webapp_auth
import admin_panel
from aiohttp.test_utils import TestClient, TestServer

BOT_TOKEN = "123456:TEST-TOKEN-FOR-HMAC"
TEST_UID = 990001

# ---- 1. webapp_auth: build a valid signed initData and verify it ----
def make_init_data(user_id, bot_token, auth_age=0):
    user = f'{{"id":{user_id},"first_name":"Test","username":"tester"}}'
    fields = {
        "auth_date": str(int(time.time()) - auth_age),
        "query_id": "AAA",
        "user": user,
    }
    dcs = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest()
    fields["hash"] = h
    return urlencode(fields)

print("=== webapp_auth tests ===")
good = make_init_data(TEST_UID, BOT_TOKEN)
assert webapp_auth.verify_init_data(good, BOT_TOKEN)["id"] == TEST_UID, "valid initData must verify"
print("PASS valid initData verifies, user id extracted")

bad_sig = good[:-4] + "0000"
assert webapp_auth.verify_init_data(bad_sig, BOT_TOKEN) is None, "tampered hash must fail"
print("PASS tampered hash rejected")

wrong_token = make_init_data(TEST_UID, "999:OTHER")
assert webapp_auth.verify_init_data(wrong_token, BOT_TOKEN) is None, "wrong token must fail"
print("PASS wrong token rejected")

expired = make_init_data(TEST_UID, BOT_TOKEN, auth_age=100000)
assert webapp_auth.verify_init_data(expired, BOT_TOKEN, max_age_seconds=60) is None, "expired must fail"
print("PASS expired auth_date rejected")

assert webapp_auth.verify_init_data("", BOT_TOKEN) is None, "empty must fail"
assert webapp_auth.verify_init_data(good, "") is None, "empty token must fail"
print("PASS empty inputs rejected")

# ---- 2. admin_panel: watch-ping, payout lifecycle, broadcast ----
async def run_api_tests():
    db.init_db()
    admin_panel.BOT_TOKEN = BOT_TOKEN

    sent = []
    async def stub_sender(user_id, text):
        sent.append((user_id, text))
        return True
    admin_panel.set_bot_sender(stub_sender)

    # fresh test user with a wallet
    db.save_user(TEST_UID, "tester", "F", 30, "Everyone", "p", "bio")
    db.update_trx_wallet(TEST_UID, "T" + "A" * 33)

    app = admin_panel.create_admin_app()
    server = TestServer(app)
    client = TestClient(server)
    await client.start_server()

    print("\n=== admin_panel /api/watch-ping tests ===")
    r = await client.post("/api/watch-ping", json={"initData": good, "minutes": 1})
    assert r.status == 200, r.status
    data = await r.json()
    assert data["status"] == "ok", data
    assert data["points"] == db.POINTS_PER_MINUTE + 50, data  # 50 starting + 5/min
    print("PASS valid watch-ping credited, points:", data["points"], "trx:", round(data["available_trx"], 4))

    r = await client.post("/api/watch-ping", json={"initData": bad_sig, "minutes": 1})
    assert r.status == 401, r.status
    print("PASS unsigned watch-ping rejected with 401")

    db.credit_watch_earnings(TEST_UID, 100, 0.01)  # +1.0 TRX, +500 points
    avail = db.get_available_balance(TEST_UID, "TRX")
    assert avail > 0, avail
    print("PASS after watch credits, available TRX:", round(avail, 4))

    tx_id = db.record_withdrawal_request(TEST_UID, 0.5, "TRX", "T" + "A" * 33)
    assert tx_id, "withdrawal should be recorded"
    print("PASS withdrawal recorded, tx id:", tx_id)

    r = await client.get("/api/data")
    data = await r.json()
    assert data["crypto"]["pending_payouts"] >= 1, data["crypto"]
    assert any(p["id"] == tx_id for p in data["payouts"]), "tx should appear in queue"
    print("PASS payout appears in /api/data queue; pending:", data["crypto"]["pending_payouts"])

    r = await client.post(f"/api/payout?tx_id={tx_id}&action=approve")
    assert r.status == 200
    out = await r.json()
    assert out["new_status"] == "PAID", out
    assert any(uid == TEST_UID for uid, _ in sent), "user should be notified"
    print("PASS payout approved via API and user notified")

    sent.clear()
    db.save_user(990002, "second", "M", 22, "Everyone", "p", "b")
    r = await client.post("/api/broadcast", json={"text": "Hello Sreymara!"})
    assert r.status == 200
    out = await r.json()
    assert out["status"] == "ok" and out["sent"] >= 2, out
    print("PASS broadcast delivered to", out["sent"], "users, failed:", out["failed"])

    # cleanup test rows
    c = sqlite3.connect(db.DB_PATH); cur = c.cursor()
    for u in (TEST_UID, 990002):
        cur.execute("DELETE FROM users WHERE user_id = ?", (u,))
        cur.execute("DELETE FROM transactions WHERE user_id = ?", (u,))
        cur.execute("DELETE FROM watch_sessions WHERE user_id = ?", (u,))
    c.commit(); c.close()

    await client.close()

asyncio.run(run_api_tests())
print("\nALL BACKEND INTEGRATION TESTS PASSED")

