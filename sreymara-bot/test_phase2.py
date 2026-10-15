"""Phase 2 verification: 70/30 split, admin cashout, referral onboarding, watch-ping."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database as db
import sqlite3

db.init_db()

REFERRER = 8522820906      # admin / test referrer
NEW_USER = 700000001
WATCHER = 700000002

def cleanup():
    c = sqlite3.connect(db.DB_PATH); cur = c.cursor()
    for u in (REFERRER, NEW_USER, WATCHER):
        cur.execute("DELETE FROM users WHERE user_id = ?", (u,))
        cur.execute("DELETE FROM watch_sessions WHERE user_id = ?", (u,))
    # reset treasury to zero for a clean simulation
    cur.execute("""UPDATE admin_treasury SET total_gross_revenue_trx=0, total_admin_profit_trx=0,
                   total_user_payouts_trx=0, admin_withdrawn_trx=0, admin_wallet_address=NULL WHERE id=1""")
    cur.execute("DELETE FROM admin_withdrawals")
    c.commit(); c.close()

cleanup()

# --- seed users ---
db.save_user(REFERRER, "owner", "M", 30, "Everyone", "p", "b")
db.update_trx_wallet(REFERRER, "T" + "O" * 33)
db.save_user(WATCHER, "watcher", "F", 25, "Everyone", "p", "b")

print("=== 70/30 SPLIT: 1.0 TRX gross ===")
res = db.credit_split_earnings(WATCHER, 1.0, 0)
print("breakdown:", res)
assert abs(res["user_trx"] - 0.30) < 1e-9, f"expected 0.30 user, got {res['user_trx']}"
assert abs(res["admin_trx"] - 0.70) < 1e-9, f"expected 0.70 admin, got {res['admin_trx']}"
u = db.get_user_full(WATCHER)
assert abs(u["total_earned_trx"] - 0.30) < 1e-9, u["total_earned_trx"]
stats = db.get_admin_treasury_stats()
print("treasury after split:", stats)
assert abs(stats["total_gross_revenue_trx"] - 1.0) < 1e-9
assert abs(stats["total_admin_profit_trx"] - 0.70) < 1e-9
assert abs(stats["total_user_payouts_trx"] - 0.30) < 1e-9
assert abs(stats["available_admin_trx"] - 0.70) < 1e-9
print("PASS: exactly 0.30 to user, 0.70 to admin treasury, gross = 1.0")

print("\n=== WATCH-PING applies split (10 min @ 0.01 = 0.10 gross) ===")
r = db.record_watch_ping(WATCHER, minutes=10, trx_rate=0.01)
print("watch-ping result:", r)
assert abs(r["gross_trx"] - 0.10) < 1e-9
assert abs(r["user_trx"] - 0.03) < 1e-9
assert abs(r["admin_trx"] - 0.07) < 1e-9
assert r["points"] == 50  # 10 min * 5 pts (full points to user)
u = db.get_user_full(WATCHER)
assert u["watch_time_minutes"] == 10, u["watch_time_minutes"]
print("PASS: watch-ping split correct; user watch_time_minutes =", u["watch_time_minutes"])

print("\n=== ADMIN CASHOUT debits treasury, not user funds ===")
before_user_trx = db.get_user_full(WATCHER)["total_earned_trx"]
before_avail = db.get_admin_treasury_stats()["available_admin_trx"]
print("available admin before:", round(before_avail, 4))
wd = db.record_admin_cashout(0.50, "T" + "C" * 33)
assert wd, "cashout should succeed"
after = db.get_admin_treasury_stats()
after_user_trx = db.get_user_full(WATCHER)["total_earned_trx"]
print("available admin after:", round(after["available_admin_trx"], 4), "| withdrawn:", round(after["admin_withdrawn_trx"], 4))
assert abs(after["available_admin_trx"] - (before_avail - 0.50)) < 1e-9
assert abs(after["admin_withdrawn_trx"] - 0.50) < 1e-9
assert abs(after_user_trx - before_user_trx) < 1e-9, "user funds must be untouched"
print("PASS: treasury debited 0.50, user funds untouched")

print("\n=== CASHOUT over-balance rejected ===")
over = db.record_admin_cashout(999.0, "T" + "C" * 33)
assert over is None, "over-balance cashout must be rejected"
print("PASS: over-balance cashout rejected")

print("\n=== REFERRAL ONBOARDING ===")
db.save_user(NEW_USER, "newbie", "F", 22, "Everyone", "p", "b")  # starts at 50 pts
ref_before = db.get_user_full(REFERRER)
ref_res = db.process_referral_onboarding(NEW_USER, REFERRER)
print("referral result:", ref_res)
assert ref_res, "referral should process"
ref_after = db.get_user_full(REFERRER)
new_after = db.get_user_full(NEW_USER)
print("referrer: count", ref_before["referral_count"], "->", ref_after["referral_count"],
      "| pts", ref_before["merlin_points"], "->", ref_after["merlin_points"],
      "| trx", round(ref_before["total_earned_trx"], 4), "->", round(ref_after["total_earned_trx"], 4))
assert ref_after["referral_count"] == ref_before["referral_count"] + 1
assert ref_after["merlin_points"] == ref_before["merlin_points"] + 100
assert abs(ref_after["total_earned_trx"] - (ref_before["total_earned_trx"] + 0.5)) < 1e-9
assert new_after["referred_by"] == REFERRER
assert new_after["merlin_points"] == 50 + 50  # starting 50 + bonus 50
print("PASS: referrer +100 pts/+0.5 TRX/count++, new user +50 pts & attributed")

print("\n=== DOUBLE-REFERRAL guard ===")
dup = db.process_referral_onboarding(NEW_USER, REFERRER)
assert dup is None, "already-referred user must not be re-credited"
print("PASS: duplicate referral rejected")

print("\n=== admin_withdrawals log ===")
logs = db.get_admin_withdrawals()
print("withdrawal log:", logs)
assert len(logs) == 1 and abs(logs[0][1] - 0.50) < 1e-9

cleanup()
print("\nALL PHASE 2 DATABASE TESTS PASSED")
