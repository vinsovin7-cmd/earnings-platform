from aiohttp import web
import database as db

HTML_DASHBOARD = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sreymara Luxury Admin Suite</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        :root {
            --bg: #090d16;
            --card: rgba(18, 26, 43, 0.7);
            --border: rgba(255, 215, 0, 0.18);
            --gold: #f59e0b;
            --accent: #38bdf8;
            --danger: #f43f5e;
            --success: #10b981;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: #f8fafc; padding: 24px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        h1 { font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #fbbf24, #f59e0b, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .metric-card h3 { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .metric-value { font-size: 28px; font-weight: 700; color: #fff; }
        .gold-val { color: var(--gold); }
        .danger-val { color: var(--danger); }
        .main-grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 20px; }
        @media(max-width: 900px) { .main-grid { grid-template-columns: 1fr; } }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; backdrop-filter: blur(12px); margin-bottom: 24px; }
        .card h2 { font-size: 17px; margin-bottom: 14px; color: #cbd5e1; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; }
        .log-box { background: rgba(10, 15, 26, 0.8); border-radius: 10px; padding: 12px; margin-bottom: 10px; font-size: 13px; border: 1px solid rgba(255,255,255,0.05); }
        .log-flagged { border-left: 4px solid var(--danger); background: rgba(244, 63, 94, 0.1); }
        .badge { padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
        .badge-vip { background: linear-gradient(135deg, #d97706, #b45309); color: #fff; }
        .badge-clean { background: rgba(16, 185, 129, 0.2); color: var(--success); }
        .badge-danger { background: rgba(244, 63, 94, 0.2); color: var(--danger); }
        button { border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; }
        .btn-ban { background: var(--danger); color: white; }
        .btn-ban:hover { opacity: 0.85; }
        .btn-vip { background: var(--gold); color: #000; margin-left: 6px; }
        .btn-vip:hover { opacity: 0.9; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        th { color: #94a3b8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>👑 Sreymara Luxury Command Center</h1>
        <div style="font-size:12px; color:#64748b;">Live Socket Polling • Port 8080</div>
    </div>

    <div class="metrics-grid">
        <div class="metric-card">
            <h3>Registered Members</h3>
            <div id="mUsers" class="metric-value">0</div>
        </div>
        <div class="metric-card">
            <h3>Active Live Rooms</h3>
            <div id="mRooms" class="metric-value gold-val">0</div>
        </div>
        <div class="metric-card">
            <h3>Intercepted Scams / Leaks</h3>
            <div id="mLeaks" class="metric-value danger-val">0</div>
        </div>
        <div class="metric-card">
            <h3>Platform Gift Volume</h3>
            <div id="mRev" class="metric-value" style="color:#10b981;">0 TRX</div>
        </div>
    </div>

    <div class="main-grid">
        <div class="card">
            <h2>Active Anonymous Sessions</h2>
            <div id="roomsContainer">Loading sessions...</div>
        </div>

        <div class="card">
            <h2>Real-Time Interceptor Feed</h2>
            <div id="logsContainer">Listening to streams...</div>
        </div>
    </div>

    <div class="card">
        <h2>Members & VIP Management</h2>
        <table>
            <thead>
                <tr><th>User ID</th><th>Username</th><th>Gender/Age</th><th>VIP Tier</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody id="usersTable"></tbody>
        </table>
    </div>

    <script>
        let lastFlaggedCount = 0;
        const alertTone = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

        async function updateDashboard() {
            try {
                const res = await fetch('/api/data');
                const data = await res.json();

                // Metrics
                document.getElementById('mUsers').innerText = data.metrics.total_users;
                document.getElementById('mRooms').innerText = data.metrics.active_pairs;
                document.getElementById('mLeaks').innerText = data.metrics.flagged_leaks;
                document.getElementById('mRev').innerText = data.metrics.total_revenue + ' TRX';

                // Sound trigger on new scam interception
                if (data.metrics.flagged_leaks > lastFlaggedCount && lastFlaggedCount !== 0) {
                    alertTone.play().catch(() => {});
                }
                lastFlaggedCount = data.metrics.flagged_leaks;

                // Rooms
                const rCont = document.getElementById('roomsContainer');
                if (data.rooms.length === 0) {
                    rCont.innerHTML = '<p style="color:#64748b; font-size:13px;">No active pairs right now.</p>';
                } else {
                    rCont.innerHTML = data.rooms.map(r => `
                        <div class="log-box" style="display:flex; justify-content:space-between; align-items:center;">
                            <div>👤 <b>Member ${r[0]}</b> ⟷ 👤 <b>Member ${r[1]}</b></div>
                            <button class="btn-ban" style="background:#f59e0b;" onclick="endRoom(${r[0]})">End Session</button>
                        </div>
                    `).join('');
                }

                // Logs
                const lCont = document.getElementById('logsContainer');
                lCont.innerHTML = data.logs.map(l => `
                    <div class="log-box ${l.is_flagged ? 'log-flagged' : ''}">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span><b>From:</b> ${l.sender_id} ➔ <b>To:</b> ${l.receiver_id}</span>
                            <span class="badge ${l.is_flagged ? 'badge-danger' : 'badge-clean'}">${l.is_flagged ? '🚨 ' + l.flag_reason : 'Verified Safe'}</span>
                        </div>
                        <div style="color:#cbd5e1; word-break:break-all;">${l.text}</div>
                        ${l.is_flagged ? `<div style="margin-top:8px;"><button class="btn-ban" onclick="banUser(${l.sender_id})">Ban Scammer (${l.sender_id})</button></div>` : ''}
                    </div>
                `).join('');

                // Users
                const uCont = document.getElementById('usersTable');
                uCont.innerHTML = data.users.map(u => `
                    <tr>
                        <td>${u[0]}</td>
                        <td>@${u[1] || 'none'}</td>
                        <td>${u[2]}, ${u[3]}</td>
                        <td><span class="badge badge-vip">${u[4]}</span></td>
                        <td>${u[6] ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-clean">Active</span>'}</td>
                        <td>
                            ${!u[6] ? `<button class="btn-ban" onclick="banUser(${u[0]})">Ban</button>` : 'Suspended'}
                            <button class="btn-vip" onclick="promoteVIP(${u[0]})">Upgrade VIP</button>
                        </td>
                    </tr>
                `).join('');
            } catch (err) {
                console.error(err);
            }
        }

        async function banUser(uid) {
            if (confirm('Ban member ' + uid + '?')) {
                await fetch('/api/ban?user_id=' + uid, { method: 'POST' });
                updateDashboard();
            }
        }

        async function promoteVIP(uid) {
            await fetch('/api/vip?user_id=' + uid + '&tier=Diamond', { method: 'POST' });
            updateDashboard();
        }

        async function endRoom(uid) {
            await fetch('/api/end?user_id=' + uid, { method: 'POST' });
            updateDashboard();
        }

        setInterval(updateDashboard, 2500);
        updateDashboard();
    </script>
</body>
</html>
"""

async def index(request):
    return web.Response(text=HTML_DASHBOARD, content_type='text/html')

async def api_data(request):
    metrics = db.get_platform_metrics()
    rooms = db.get_active_rooms()
    raw_logs = db.get_recent_logs(30)
    users = db.get_all_users()
    
    logs = [
        {"id": l[0], "sender_id": l[1], "receiver_id": l[2], "text": l[3], "is_flagged": bool(l[4]), "flag_reason": l[5], "timestamp": l[6]}
        for l in raw_logs
    ]
    return web.json_response({
        "metrics": metrics,
        "rooms": rooms,
        "logs": logs,
        "users": users
    })

async def api_ban(request):
    uid = int(request.query.get("user_id", 0))
    if uid:
        db.ban_user(uid)
    return web.json_response({"status": "ok"})

async def api_vip(request):
    uid = int(request.query.get("user_id", 0))
    tier = request.query.get("tier", "Diamond")
    if uid:
        db.set_vip_tier(uid, tier)
    return web.json_response({"status": "ok"})

async def api_end(request):
    uid = int(request.query.get("user_id", 0))
    if uid:
        db.end_chat(uid)
    return web.json_response({"status": "ok"})

def create_admin_app():
    app = web.Application()
    app.router.add_get('/', index)
    app.router.add_get('/api/data', api_data)
    app.router.add_post('/api/ban', api_ban)
    app.router.add_post('/api/vip', api_vip)
    app.router.add_post('/api/end', api_end)
    return app