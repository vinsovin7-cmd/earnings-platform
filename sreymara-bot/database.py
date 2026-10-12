import sqlite3

DB_PATH = "sreymara-bot/sreymara.db"

def init_db():
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
            is_banned INTEGER DEFAULT 0
        )
    """)
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
    conn.commit()
    conn.close()

def save_user(user_id, username, gender, age, pref, photo_id, bio):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users (user_id, username, gender, age, pref, photo_id, bio, vip_tier, balance, is_banned)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Standard', 50, 0)
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