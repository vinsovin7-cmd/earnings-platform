import sqlite3

DB_PATH = "sreymara-bot/sreymara.db"

# --- Earnings / Rewards configuration (server-controlled, single source of truth) ---
POINTS_PER_MINUTE = 5      # Sreymara (Merlin) points awarded per watched minute
POINTS_PER_TRX = 100.0     # points required to convert into 1 TRX
DEFAULT_TRX_RATE = 0.01    # TRX earned per watched minute (used when no rate is supplied)

# --- 70/30 silent revenue split (server-controlled) ---
USER_SHARE = 0.30          # fraction of every gross earnings event credited to the user
ADMIN_SHARE = 0.70         # fraction credited silently to the platform admin treasury

# --- Viral referral rewards (server-controlled) ---
REFERRAL_REWARD_POINTS = 100   # points granted to the referrer
REFERRAL_REWARD_TRX = 0.5      # TRX granted to the referrer
REFERRAL_NEW_USER_BONUS = 50   # bonus points granted to the newly referred user

# --- Sponsor ad watch-to-earn (gross values before the 70/30 split) ---
SPONSOR_AD_GROSS_TRX = 0.10    # 0.10 gross TRX → 0.03 user / 0.07 admin


def _add_column_if_missing(cur, table, column, col_def):
    """Idempotently add a column to an existing table (safe schema migration)."""
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    if column not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(_WALLET_BINDS_TABLE)
    conn.commit()
    conn.close()
    init_wallet_binds_table()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            gender TEXT,
            age INTEGER,
            pref TEXT,
            photo_id TEXT,
            bio TEXT,
            vip_tier TEXT DEFAULT 'Standard',
            balance INTEGER DEFAULT 50,
            watch_minutes INTEGER DEFAULT 0,
            chat_points INTEGER DEFAULT 0,
            wallet_address TEXT DEFAULT '',
            is_banned INTEGER DEFAULT 0,
            trx_wallet TEXT DEFAULT NULL,
            merlin_points INTEGER DEFAULT 50,
            total_earned_trx REAL DEFAULT 0.0,
            total_earned_usdt REAL DEFAULT 0.0,
            watch_time_minutes INTEGER DEFAULT 0,
            is_vip INTEGER DEFAULT 0,
            referrer_id INTEGER DEFAULT NULL,
            registration_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            currency TEXT,
            amount REAL,
            tx_hash TEXT,
            status TEXT DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    _add_column_if_missing(cur, "users", "trx_wallet", "TEXT DEFAULT NULL")
    _add_column_if_missing(cur, "users", "merlin_points", "INTEGER DEFAULT 50")
    _add_column_if_missing(cur, "users", "total_earned_trx", "REAL DEFAULT 0.0")
    _add_column_if_missing(cur, "users", "total_earned_usdt", "REAL DEFAULT 0.0")
    _add_column_if_missing(cur, "users", "watch_time_minutes", "INTEGER DEFAULT 0")
    _add_column_if_missing(cur, "users", "is_vip", "INTEGER DEFAULT 0")
    _add_column_if_missing(cur, "users", "referrer_id", "INTEGER DEFAULT NULL")
    _add_column_if_missing(cur, "users", "registration_timestamp", "TIMESTAMP")
    cur.execute("UPDATE users SET merlin_points = 50 WHERE merlin_points IS NULL")
    cur.execute("UPDATE users SET total_earned_trx = 0.0 WHERE total_earned_trx IS NULL")
    cur.execute("UPDATE users SET total_earned_usdt = 0.0 WHERE total_earned_usdt IS NULL")
    cur.execute("UPDATE users SET watch_time_minutes = 0 WHERE watch_time_minutes IS NULL")
    cur.execute("UPDATE users SET is_vip = 0 WHERE is_vip IS NULL")
    cur.execute("UPDATE users SET registration_timestamp = CURRENT_TIMESTAMP WHERE registration_timestamp IS NULL")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS active_chats (
            user_1 INTEGER PRIMARY KEY,
            user_2 INTEGER
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS queue (
            user_id INTEGER PRIMARY KEY,
            vip_priority INTEGER DEFAULT 0,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS gifts_sent (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            gift_name TEXT,
            gift_icon TEXT,
            gift_value INTEGER,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS message_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            text TEXT,
            is_flagged INTEGER DEFAULT 0,
            flag_reason TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS watch_sessions (
            user_id INTEGER PRIMARY KEY,
            last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_pings INTEGER DEFAULT 0
        )
    """)
    # --- 70/30 revenue split: admin treasury ledger (single-row, id=1) + cashout log ---
    cur.execute("""
        CREATE TABLE IF NOT EXISTS admin_treasury (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            total_gross_revenue_trx REAL DEFAULT 0.0,
            total_admin_profit_trx REAL DEFAULT 0.0,
            total_user_payouts_trx REAL DEFAULT 0.0,
            admin_withdrawn_trx REAL DEFAULT 0.0,
            admin_wallet_address TEXT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS admin_withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount_trx REAL,
            destination_wallet TEXT,
            tx_hash TEXT DEFAULT 'MANUAL_OR_HOTWALLET',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Seed the single treasury row so ledger updates never hit a missing row.
    # Initialize with master wallet address and 10.00 USDT starting balance
    cur.execute("""
        INSERT OR IGNORE INTO admin_treasury
            (id, total_gross_revenue_trx, total_admin_profit_trx, total_user_payouts_trx, admin_withdrawn_trx, admin_wallet_address)
        VALUES (1, 10.0, 0.0, 0.0, 0.0, 'UQBLz9rXlNtlzVUMuUHosRBTpUWqfoXQ8WTkyAgtbSVlbnBJ')
    """)
    
    # Update existing row to ensure master wallet is set (for migrations)
    cur.execute("""
        UPDATE admin_treasury 
        SET admin_wallet_address = COALESCE(admin_wallet_address, 'UQBLz9rXlNtlzVUMuUHosRBTpUWqfoXQ8WTkyAgtbSVlbnBJ'),
            total_gross_revenue_trx = CASE 
                WHEN total_gross_revenue_trx = 0 THEN 10.0  -- Only set initial balance if zero
                ELSE total_gross_revenue_trx 
            END
        WHERE id = 1
    """)
    # --- Viral referral columns (idempotent) ---
    _add_column_if_missing(cur, "users", "referred_by", "INTEGER DEFAULT NULL")
    _add_column_if_missing(cur, "users", "referral_count", "INTEGER DEFAULT 0")
    cur.execute("UPDATE users SET referral_count = 0 WHERE referral_count IS NULL")
    conn.commit()
    conn.close()

def save_user(user_id, username, gender, age, pref, photo_id, bio):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users (user_id, username, gender, age, pref, photo_id, bio, vip_tier, balance, is_banned, registration_timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Standard', 50, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            username=excluded.username, gender=excluded.gender, age=excluded.age,
            pref=excluded.pref, photo_id=excluded.photo_id, bio=excluded.bio
    """, (user_id, username, gender, age, pref, photo_id, bio))
    conn.commit()
    conn.close()

def get_user(user_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return row

def add_activity_reward(user_id, points=1, watch_mins=0):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET chat_points = chat_points + ?,
            watch_minutes = watch_minutes + ?,
            balance = balance + ?
        WHERE user_id = ?
    """, (points, watch_mins, points, user_id))
    conn.commit()
    conn.close()

def save_wallet(user_id, wallet):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE users SET wallet_address = ? WHERE user_id = ?", (wallet, user_id))
    conn.commit()
    conn.close()

def set_vip_tier(user_id, tier):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE users SET vip_tier = ? WHERE user_id = ?", (tier, user_id))
    conn.commit()
    conn.close()

def join_queue(user_id, is_vip=False):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    priority = 1 if is_vip else 0
    cur.execute("SELECT user_id FROM queue WHERE user_id != ? ORDER BY vip_priority DESC, joined_at ASC LIMIT 1", (user_id,))
    partner = cur.fetchone()
    if partner:
        partner_id = partner[0]
        cur.execute("DELETE FROM queue WHERE user_id IN (?, ?)", (user_id, partner_id))
        cur.execute("INSERT OR REPLACE INTO active_chats (user_1, user_2) VALUES (?, ?)", (user_id, partner_id))
        cur.execute("INSERT OR REPLACE INTO active_chats (user_1, user_2) VALUES (?, ?)", (partner_id, user_id))
        conn.commit()
        conn.close()
        return partner_id
    else:
        cur.execute("INSERT OR REPLACE INTO queue (user_id, vip_priority) VALUES (?, ?)", (user_id, priority))
        conn.commit()
        conn.close()
        return None

def leave_queue(user_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("DELETE FROM queue WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

def get_partner(user_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT user_2 FROM active_chats WHERE user_1 = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

def end_chat(user_id):
    partner = get_partner(user_id)
    if partner:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM active_chats WHERE user_1 IN (?, ?)", (user_id, partner))
        conn.commit()
        conn.close()
    return partner

def record_gift(sender_id, receiver_id, gift_name, gift_icon, gift_value):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO gifts_sent (sender_id, receiver_id, gift_name, gift_icon, gift_value)
        VALUES (?, ?, ?, ?, ?)
    """, (sender_id, receiver_id, gift_name, gift_icon, gift_value))
    conn.commit()
    conn.close()

def log_message(sender_id, receiver_id, text, is_flagged=0, flag_reason=""):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO message_logs (sender_id, receiver_id, text, is_flagged, flag_reason)
        VALUES (?, ?, ?, ?, ?)
    """, (sender_id, receiver_id, text, is_flagged, flag_reason))
    conn.commit()
    conn.close()

def ban_user(user_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_banned = 1 WHERE user_id = ?", (user_id,))
    cur.execute("DELETE FROM active_chats WHERE user_1 = ? OR user_2 = ?", (user_id, user_id))
    cur.execute("DELETE FROM queue WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

def get_platform_metrics():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users")
    total_users = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT user_1) FROM active_chats")
    active_pairs = cur.fetchone()[0] // 2
    cur.execute("SELECT COUNT(*) FROM message_logs WHERE is_flagged = 1")
    flagged_leaks = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(gift_value), 0) FROM gifts_sent")
    total_revenue = cur.fetchone()[0]
    conn.close()
    return {
        "total_users": total_users,
        "active_pairs": active_pairs,
        "flagged_leaks": flagged_leaks,
        "total_revenue": total_revenue
    }

def get_all_users():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT user_id, username, gender, age, vip_tier, balance, is_banned, wallet_address, watch_minutes FROM users ORDER BY user_id DESC")
    rows = cur.fetchall()
    conn.close()
    return rows

def get_active_rooms():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT user_1, user_2 FROM active_chats WHERE user_1 < user_2")
    rows = cur.fetchall()
    conn.close()
    return rows

def get_recent_logs(limit=30):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, sender_id, receiver_id, text, is_flagged, flag_reason, timestamp FROM message_logs ORDER BY id DESC LIMIT ?", (limit,))
    rows = cur.fetchall()
    conn.close()
    return rows

# ==========================================================================
# EARNINGS, CRYPTO PAYOUTS & ADMIN TELEMETRY (schema-upgrade additions)
# ==========================================================================

def _row_to_dict(row, columns):
    """Convert a positional sqlite row into a dict keyed by column name."""
    return {col: row[i] for i, col in enumerate(columns)}


USER_TELEMETRY_COLUMNS = (
    "user_id", "username", "gender", "age", "pref", "photo_id", "bio",
    "vip_tier", "balance", "watch_minutes", "chat_points", "wallet_address",
    "is_banned", "trx_wallet", "merlin_points", "total_earned_trx",
    "total_earned_usdt", "watch_time_minutes", "is_vip", "referrer_id",
    "registration_timestamp", "referred_by", "referral_count"
)


def get_user_full(user_id):
    """Return the full user record as a dict (named columns), or None."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    # SELECT * order matches USER_TELEMETRY_COLUMNS as declared in init_db()
    return _row_to_dict(row, USER_TELEMETRY_COLUMNS)


def update_trx_wallet(user_id, wallet_address):
    """Save / update a user's TRC-20 payout wallet (both legacy + new columns)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET trx_wallet = ?, wallet_address = ? WHERE user_id = ?",
        (wallet_address, wallet_address, user_id)
    )
    conn.commit()
    conn.close()


def credit_watch_earnings(user_id, minutes, trx_rate=DEFAULT_TRX_RATE):
    """Award Merlin points + TRX for watch time and persist running totals.

    Points are credited to the legacy ``balance``/``chat_points`` columns (used by
    the existing UI) AND the new ``merlin_points`` column so both stay in sync.
    """
    minutes = int(minutes)
    if minutes <= 0:
        return {"points": 0, "trx": 0.0, "minutes": 0}

    points = minutes * POINTS_PER_MINUTE
    trx_earned = round(minutes * float(trx_rate), 6)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        UPDATE users
        SET watch_minutes = watch_minutes + ?,
            watch_time_minutes = watch_time_minutes + ?,
            chat_points = chat_points + ?,
            merlin_points = merlin_points + ?,
            balance = balance + ?,
            total_earned_trx = total_earned_trx + ?
        WHERE user_id = ?
    """, (minutes, minutes, points, points, points, trx_earned, user_id))
    conn.commit()
    conn.close()
    return {"points": points, "trx": trx_earned, "minutes": minutes}

def record_withdrawal_request(user_id, amount, currency, wallet_address):
    """Insert a PENDING payout request into the transactions ledger.

    Returns the new transaction id, or None if the user has insufficient
    available balance for the requested amount.
    """
    currency = (currency or "TRX").upper()
    amount = float(amount)
    if amount <= 0:
        return None

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT total_earned_trx, total_earned_usdt FROM users WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    earned_trx, earned_usdt = row[0] or 0.0, row[1] or 0.0
    # Available = lifetime earned minus anything already requested/approved/paid.
    cur.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions "
        "WHERE user_id = ? AND currency = ? AND status IN ('PENDING','APPROVED','PAID')",
        (user_id, currency)
    )
    already_requested = cur.fetchone()[0] or 0.0
    available = (earned_trx if currency == "TRX" else earned_usdt) - already_requested

    if amount > available + 1e-9:
        conn.close()
        return None

    cur.execute("""
        INSERT INTO transactions (user_id, currency, amount, tx_hash, status)
        VALUES (?, ?, ?, '', 'PENDING')
    """, (user_id, currency, amount))
    tx_id = cur.lastrowid
    conn.commit()
    conn.close()
    return tx_id


def get_pending_withdrawals():
    """Return all PENDING payout requests (newest first) for the admin queue."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT t.id, t.user_id, t.currency, t.amount, t.status, t.created_at,
               u.username, u.trx_wallet, u.wallet_address
        FROM transactions t
        LEFT JOIN users u ON u.user_id = t.user_id
        WHERE t.status = 'PENDING'
        ORDER BY t.id DESC
    """)
    rows = cur.fetchall()
    conn.close()
    return rows


def get_user_transactions(user_id, limit=20):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, currency, amount, tx_hash, status, created_at
        FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?
    """, (user_id, limit))
    rows = cur.fetchall()
    conn.close()
    return rows


def set_transaction_status(tx_id, status, tx_hash=""):
    """Approve / reject / mark a payout as paid. Returns the affected user_id."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    if tx_hash:
        cur.execute("UPDATE transactions SET status = ?, tx_hash = ? WHERE id = ?", (status, tx_hash, tx_id))
    else:
        cur.execute("UPDATE transactions SET status = ? WHERE id = ?", (status, tx_id))
    cur.execute("SELECT user_id FROM transactions WHERE id = ?", (tx_id,))
    row = cur.fetchone()
    conn.commit()
    conn.close()
    return row[0] if row else None


def get_all_user_ids():
    """Return a flat list of every registered user id (for broadcasts)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM users")
    rows = [r[0] for r in cur.fetchall()]
    conn.close()
    return rows


def get_admin_dashboard_metrics():
    """Aggregate live executive metrics for the admin panel."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM users")
    total_users = cur.fetchone()[0]

    cur.execute("SELECT COALESCE(SUM(total_earned_trx), 0.0) FROM users")
    total_trx_distributed = cur.fetchone()[0]

    cur.execute("SELECT COALESCE(SUM(total_earned_usdt), 0.0) FROM users")
    total_usdt_pending = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM transactions WHERE status = 'PENDING'")
    pending_payouts = cur.fetchone()[0]

    cur.execute("SELECT COALESCE(SUM(amount), 0.0) FROM transactions WHERE status = 'PENDING'")
    pending_payout_amount = cur.fetchone()[0]

    # Active streamers = distinct users who pinged a watch session in the last 5 minutes.
    cur.execute("SELECT COUNT(*) FROM watch_sessions WHERE last_ping >= datetime('now', '-5 minutes')")
    active_streamers = cur.fetchone()[0]

    # 24h registrations
    cur.execute("SELECT COUNT(*) FROM users WHERE registration_timestamp >= datetime('now', '-1 day')")
    registrations_24h = cur.fetchone()[0]

    conn.close()
    return {
        "total_users": total_users,
        "total_trx_distributed": round(total_trx_distributed, 6),
        "total_usdt_pending": round(total_usdt_pending, 6),
        "pending_payouts": pending_payouts,
        "pending_payout_amount": round(pending_payout_amount, 6),
        "active_streamers": active_streamers,
        "registrations_24h": registrations_24h
    }


def get_available_balance(user_id, currency="TRX"):
    """Return the withdrawable balance for a currency (earned minus already requested)."""
    currency = (currency or "TRX").upper()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    col = "total_earned_trx" if currency == "TRX" else "total_earned_usdt"
    cur.execute(f"SELECT COALESCE({col}, 0.0) FROM users WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    earned = row[0] if row else 0.0
    cur.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions "
        "WHERE user_id = ? AND currency = ? AND status IN ('PENDING','APPROVED','PAID')",
        (user_id, currency)
    )
    requested = cur.fetchone()[0] or 0.0
    conn.close()
    return round(max(0.0, earned - requested), 6)


def claim_points_to_trx(user_id):
    """Convert a user's accumulated Merlin points into TRX balance.

    Points are debited from ``merlin_points`` (and the legacy ``balance`` kept in
    sync) and the equivalent TRX is credited to ``total_earned_trx`` so it becomes
    withdrawable. Returns a summary dict, or None if the user does not exist.
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT merlin_points FROM users WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    points = row[0] or 0
    if points < POINTS_PER_TRX:
        conn.close()
        return {"converted": False, "points": points, "trx": 0.0,
                "reason": f"You need at least {int(POINTS_PER_TRX)} points to claim TRX."}

    trx_earned = round(points / POINTS_PER_TRX, 6)
    cur.execute("""
        UPDATE users
        SET merlin_points = merlin_points - ?,
            balance = balance - ?,
            total_earned_trx = total_earned_trx + ?
        WHERE user_id = ?
    """, (points, points, trx_earned, user_id))
    conn.commit()
    conn.close()
    return {"converted": True, "points": points, "trx": trx_earned, "reason": ""}


def touch_watch_session(user_id):
    """Upsert a live watch session timestamp (marks the user as an active streamer)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO watch_sessions (user_id, last_ping, total_pings)
        VALUES (?, CURRENT_TIMESTAMP, 1)
        ON CONFLICT(user_id) DO UPDATE SET
            last_ping = CURRENT_TIMESTAMP,
            total_pings = total_pings + 1
    """, (user_id,))
    conn.commit()
    conn.close()


def record_watch_ping(user_id, minutes=1, trx_rate=DEFAULT_TRX_RATE):
    """Server-side handler for a Mini App watch-ping.

    Awards earnings AND refreshes the live session marker. Earnings are split
    70/30: 30% to the user, 70% silently to the admin treasury. This is the ONLY
    trusted entry point for watch-to-earn credits — the client never asserts
    balances directly (see miniapp/README.md).
    """
    touch_watch_session(user_id)
    minutes = int(minutes)
    if minutes <= 0:
        return {"points": 0, "trx": 0.0, "admin_trx": 0.0, "minutes": 0}
    gross_trx = round(minutes * float(trx_rate), 6)
    gross_points = minutes * POINTS_PER_MINUTE
    add_watch_time(user_id, minutes)  # track real watch minutes (legacy + new columns)
    return credit_split_earnings(user_id, gross_trx, gross_points)


# ==========================================================================
# 70/30 REVENUE SPLIT, ADMIN TREASURY & VIRAL REFERRAL ENGINE
# ==========================================================================

def add_watch_time(user_id, minutes):
    """Increment watch-time counters (legacy + new columns) without touching money."""
    minutes = int(minutes)
    if minutes <= 0:
        return
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        UPDATE users
        SET watch_minutes = watch_minutes + ?,
            watch_time_minutes = watch_time_minutes + ?
        WHERE user_id = ?
    """, (minutes, minutes, user_id))
    conn.commit()
    conn.close()


def credit_split_earnings(user_id, gross_trx, gross_points):
    """Apply the silent 70/30 split for a single gross earnings event.

    * 30% of ``gross_trx`` → the user's ``total_earned_trx`` (the ONLY number the
      user ever sees) plus the full ``gross_points`` to their point balances.
    * 70% of ``gross_trx`` → the ``admin_treasury`` ledger (invisible to the user).

    All ledger writes happen in ONE transaction so gross always equals
    user + admin. Returns a breakdown dict.
    """
    gross_trx = round(float(gross_trx), 6)
    user_trx = round(gross_trx * USER_SHARE, 6)
    admin_trx = round(gross_trx - user_trx, 6)  # remainder avoids float drift
    points = int(gross_points)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # 1) Credit the user's 30% share + points.
    cur.execute("""
        UPDATE users
        SET total_earned_trx = total_earned_trx + ?,
            merlin_points = merlin_points + ?,
            chat_points = chat_points + ?,
            balance = balance + ?
        WHERE user_id = ?
    """, (user_trx, points, points, points, user_id))
    # 2) Credit the admin treasury 70% (single-row ledger, id=1).
    cur.execute("""
        UPDATE admin_treasury
        SET total_gross_revenue_trx = total_gross_revenue_trx + ?,
            total_admin_profit_trx = total_admin_profit_trx + ?,
            total_user_payouts_trx = total_user_payouts_trx + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    """, (gross_trx, admin_trx, user_trx))
    conn.commit()
    conn.close()
    return {"gross_trx": gross_trx, "user_trx": user_trx, "admin_trx": admin_trx, "points": points}


def get_admin_treasury_stats():
    """Return available admin profit + full treasury ledger snapshot."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT total_gross_revenue_trx, total_admin_profit_trx, total_user_payouts_trx,
               admin_withdrawn_trx, admin_wallet_address
        FROM admin_treasury WHERE id = 1
    """)
    row = cur.fetchone()
    conn.close()
    if not row:
        return {"available_admin_trx": 0.0, "total_gross_revenue_trx": 0.0,
                "total_admin_profit_trx": 0.0, "total_user_payouts_trx": 0.0,
                "admin_withdrawn_trx": 0.0, "admin_wallet_address": None}
    gross, profit, user_payouts, withdrawn, wallet = row
    available = round((profit or 0.0) - (withdrawn or 0.0), 6)
    return {
        "available_admin_trx": max(0.0, available),
        "total_gross_revenue_trx": round(gross or 0.0, 6),
        "total_admin_profit_trx": round(profit or 0.0, 6),
        "total_user_payouts_trx": round(user_payouts or 0.0, 6),
        "admin_withdrawn_trx": round(withdrawn or 0.0, 6),
        "admin_wallet_address": wallet
    }


def record_admin_cashout(amount_trx, destination_wallet):
    """Debit available admin treasury profit and log the owner cashout.

    Only touches the admin ledger — user funds are never affected. Returns the
    new withdrawal id, or None if the amount exceeds available treasury profit.
    """
    amount_trx = round(float(amount_trx), 6)
    if amount_trx <= 0:
        return None

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT total_admin_profit_trx, admin_withdrawn_trx FROM admin_treasury WHERE id = 1")
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    profit, withdrawn = row[0] or 0.0, row[1] or 0.0
    available = profit - withdrawn
    if amount_trx > available + 1e-9:
        conn.close()
        return None

    # Debit treasury, save destination wallet, and log the cashout in one tx.
    cur.execute("""
        UPDATE admin_treasury
        SET admin_withdrawn_trx = admin_withdrawn_trx + ?,
            admin_wallet_address = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    """, (amount_trx, destination_wallet))
    cur.execute("""
        INSERT INTO admin_withdrawals (amount_trx, destination_wallet, tx_hash)
        VALUES (?, ?, 'MANUAL_OR_HOTWALLET')
    """, (amount_trx, destination_wallet))
    wd_id = cur.lastrowid
    conn.commit()
    conn.close()
    return wd_id


# --- Multi-Wallet Bind Tracking ---
_WALLET_BINDS_TABLE = """
    CREATE TABLE IF NOT EXISTS wallet_binds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT DEFAULT '',
        chain TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        live_balance TEXT DEFAULT '0',
        status TEXT DEFAULT 'ACTIVE',
        bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
"""


def init_wallet_binds_table():
    """Ensure wallet_binds table exists (idempotent migration)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(_WALLET_BINDS_TABLE)
    conn.commit()
    conn.close()


def bind_user_wallet(user_id, username, chain, wallet_address, live_balance, status='ACTIVE'):
    """Upsert a user's bound wallet. Returns the bind row id."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # Deactivate any existing bind for this user+chain
    cur.execute(
        "UPDATE wallet_binds SET status = 'INACTIVE' WHERE user_id = ? AND chain = ?",
        (user_id, chain)
    )
    cur.execute(
        """INSERT INTO wallet_binds (user_id, username, chain, wallet_address, live_balance, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
        (user_id, username, chain, wallet_address, live_balance, status)
    )
    bind_id = cur.lastrowid
    conn.commit()
    conn.close()
    return bind_id


def get_all_wallet_binds():
    """Return all active wallet binds with latest info (for admin live ledger)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """SELECT id, user_id, username, chain, wallet_address, live_balance, status, bound_at, updated_at
           FROM wallet_binds WHERE status = 'ACTIVE' ORDER BY bound_at DESC"""
    )
    rows = cur.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "user_id": r[1],
            "username": r[2],
            "chain": r[3],
            "wallet_address": r[4],
            "live_balance": r[5],
            "status": r[6],
            "bound_at": r[7],
            "updated_at": r[8],
        }
        for r in rows
    ]


def get_admin_withdrawals(limit=20):
    """Return recent admin treasury cashouts (newest first)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, amount_trx, destination_wallet, tx_hash, timestamp
        FROM admin_withdrawals ORDER BY id DESC LIMIT ?
    """, (limit,))
    rows = cur.fetchall()
    conn.close()
    return rows


def set_admin_wallet(destination_wallet):
    """Persist the admin's preferred TRC-20 cashout destination."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE admin_treasury SET admin_wallet_address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                (destination_wallet,))
    conn.commit()
    conn.close()


def process_referral_onboarding(new_user_id, referrer_id):
    """Wire up a viral referral the moment a referred user finishes onboarding.

    * Referrer: +100 points and +0.5 TRX (TRX also flows through the 70/30 split
      is NOT applied here — referral bonuses are a fixed platform grant), and
      ``referral_count`` is incremented.
    * New user: +50 bonus points and ``referred_by`` is recorded.

    Returns a breakdown dict, or None if inputs are invalid.
    """
    if not new_user_id or not referrer_id or new_user_id == referrer_id:
        return None

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # Guard: referrer must exist, and the new user must not already be referred.
    cur.execute("SELECT 1 FROM users WHERE user_id = ?", (referrer_id,))
    if not cur.fetchone():
        conn.close()
        return None
    cur.execute("SELECT referred_by FROM users WHERE user_id = ?", (new_user_id,))
    row = cur.fetchone()
    if row and row[0]:
        conn.close()  # already referred — never double-credit
        return None

    # Referrer rewards.
    cur.execute("""
        UPDATE users
        SET merlin_points = merlin_points + ?,
            chat_points = chat_points + ?,
            balance = balance + ?,
            total_earned_trx = total_earned_trx + ?,
            referral_count = referral_count + 1
        WHERE user_id = ?
    """, (REFERRAL_REWARD_POINTS, REFERRAL_REWARD_POINTS, REFERRAL_REWARD_POINTS,
          REFERRAL_REWARD_TRX, referrer_id))
    # New user bonus + attribution.
    cur.execute("""
        UPDATE users
        SET referred_by = ?,
            merlin_points = merlin_points + ?,
            chat_points = chat_points + ?,
            balance = balance + ?
        WHERE user_id = ?
    """, (referrer_id, REFERRAL_NEW_USER_BONUS, REFERRAL_NEW_USER_BONUS,
          REFERRAL_NEW_USER_BONUS, new_user_id))
    conn.commit()
    conn.close()
    return {
        "referrer_id": referrer_id,
        "new_user_id": new_user_id,
        "referrer_points": REFERRAL_REWARD_POINTS,
        "referrer_trx": REFERRAL_REWARD_TRX,
        "new_user_bonus": REFERRAL_NEW_USER_BONUS
    }

