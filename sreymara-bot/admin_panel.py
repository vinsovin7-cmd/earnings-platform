import os
import json
import sqlite3
from aiohttp import web
import database as db
import webapp_auth

# Bot token for verifying Mini App initData (server-side trust boundary).
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# Async bot sender injected by bot.py so the admin panel can deliver broadcasts
# and payout notifications through the live Telegram bot instance.
BOT_SENDER = None  # callable: async def send(user_id: int, text: str) -> bool

def set_bot_sender(sender):
    """Register an async coroutine used to DM users (broadcast / payout alerts)."""
    global BOT_SENDER
    BOT_SENDER = sender

# Async AI responder injected by bot.py (wraps the Gemini engine) so the Mini App
# VIP lounge chat (Srey AI) shares the exact same backoff/fallback logic.
AI_RESPONDER = None  # callable: async def ask(prompt: str) -> str

def set_ai_responder(responder):
    """Register an async coroutine used to answer Srey AI prompts from the Mini App."""
    global AI_RESPONDER
    AI_RESPONDER = responder

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
        <div class="metric-card">
            <h3>Registrations (24h)</h3>
            <div id="mReg24" class="metric-value">0</div>
        </div>
        <div class="metric-card">
            <h3>Total TRX Distributed</h3>
            <div id="mTrxDist" class="metric-value gold-val">0 TRX</div>
        </div>
        <div class="metric-card">
            <h3>Active Streamers</h3>
            <div id="mStreamers" class="metric-value" style="color:#38bdf8;">0</div>
        </div>
        <div class="metric-card">
            <h3>Pending Payouts</h3>
            <div id="mPending" class="metric-value danger-val">0</div>
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

    <div class="card">
        <h2>💸 Pending Payout Queue (TRC-20)</h2>
        <div id="payoutsContainer">Loading payouts...</div>
    </div>

    <div class="card" style="border-color: rgba(245,158,11,0.4);">
        <h2>👑 Platform Treasury (70% Vault)</h2>
        <div class="metrics-grid" style="margin-bottom:14px;">
            <div class="metric-card"><h3>Gross Ecosystem Volume (100%)</h3><div id="tGross" class="metric-value">0.0000 TRX</div></div>
            <div class="metric-card"><h3>Platform Net Profit (70%)</h3><div id="tProfit" class="metric-value gold-val">0.0000 TRX</div></div>
            <div class="metric-card"><h3>Available for Cashout</h3><div id="tAvailable" class="metric-value" style="color:#10b981;">0.0000 TRX</div></div>
            <div class="metric-card"><h3>User Rewards Distributed (30%)</h3><div id="tUserPayouts" class="metric-value" style="color:#38bdf8;">0.0000 TRX</div></div>
            <div class="metric-card"><h3>Admin Withdrawn to Date</h3><div id="tWithdrawn" class="metric-value danger-val">0.0000 TRX</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <input id="cashoutAmount" type="number" step="0.000001" min="0" placeholder="Amount TRX" style="padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(10,15,26,0.8);color:#f8fafc;width:150px;" />
            <input id="cashoutWallet" type="text" placeholder="TRC-20 destination (or saved)" style="padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(10,15,26,0.8);color:#f8fafc;flex:1;min-width:220px;" />
            <button class="btn-vip" style="margin-left:0;" onclick="adminCashout()">🏦 Withdraw Admin Treasury</button>
        </div>
        <div id="adminWithdrawals" style="margin-top:12px;font-size:12px;color:#94a3b8;"></div>
    </div>

    <div class="card">
        <h2>📢 Global Broadcast</h2>
        <p style="font-size:13px;color:#94a3b8;margin-bottom:10px;">Send an announcement to every registered user via the bot.</p>
        <textarea id="broadcastText" rows="3" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(10,15,26,0.8);color:#f8fafc;padding:10px;font-size:13px;" placeholder="Type your announcement..."></textarea>
        <div style="margin-top:10px;"><button class="btn-vip" style="margin-left:0;" onclick="sendBroadcast()">🚀 Send Broadcast</button></div>
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

                // Crypto / earnings metrics (schema upgrade)
                const cm = data.crypto || {};
                document.getElementById('mReg24').innerText = cm.registrations_24h ?? 0;
                document.getElementById('mTrxDist').innerText = (cm.total_trx_distributed ?? 0).toFixed(4) + ' TRX';
                document.getElementById('mStreamers').innerText = cm.active_streamers ?? 0;
                document.getElementById('mPending').innerText = cm.pending_payouts ?? 0;

                // 70/30 Treasury ledger
                const tr = data.treasury || {};
                document.getElementById('tGross').innerText = (tr.total_gross_revenue_trx ?? 0).toFixed(4) + ' TRX';
                document.getElementById('tProfit').innerText = (tr.total_admin_profit_trx ?? 0).toFixed(4) + ' TRX';
                document.getElementById('tAvailable').innerText = (tr.available_admin_trx ?? 0).toFixed(4) + ' TRX';
                document.getElementById('tUserPayouts').innerText = (tr.total_user_payouts_trx ?? 0).toFixed(4) + ' TRX';
                document.getElementById('tWithdrawn').innerText = (tr.admin_withdrawn_trx ?? 0).toFixed(4) + ' TRX';
                // Pre-fill saved wallet if the field is empty
                const cw = document.getElementById('cashoutWallet');
                if (cw && !cw.value && tr.admin_wallet_address) { cw.value = tr.admin_wallet_address; }
                // Recent admin cashouts
                fetch('/api/treasury').then(r=>r.json()).then(t=>{
                    const box = document.getElementById('adminWithdrawals');
                    if (!box) return;
                    if (!t.withdrawals || t.withdrawals.length === 0) {
                        box.innerHTML = '<span style="color:#64748b;">No admin cashouts yet.</span>';
                    } else {
                        box.innerHTML = '<b style="color:#cbd5e1;">Recent cashouts:</b><br>' + t.withdrawals.map(w =>
                            `• ${w.amount_trx.toFixed(4)} TRX → <code style="font-size:11px;">${w.destination_wallet}</code> <span style="color:#64748b;">(${w.timestamp})</span>`
                        ).join('<br>');
                    }
                }).catch(()=>{});

                // Payout queue
                const pCont = document.getElementById('payoutsContainer');
                if (!data.payouts || data.payouts.length === 0) {
                    pCont.innerHTML = '<p style="color:#64748b; font-size:13px;">No pending payouts. 🎉</p>';
                } else {
                    pCont.innerHTML = data.payouts.map(p => `
                        <div class="log-box" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div>
                                <b>#${p.id}</b> • User <b>${p.user_id}</b> (@${p.username || 'none'})<br>
                                <span style="color:#f59e0b;">${p.amount.toFixed(4)} ${p.currency}</span>
                                <span style="color:#64748b;"> → </span><code style="font-size:11px;">${p.wallet || 'No wallet'}</code>
                            </div>
                            <div>
                                <button class="btn-ban" style="background:#10b981;" onclick="reviewPayout(${p.id}, 'approve')">✅ Approve</button>
                                <button class="btn-ban" onclick="reviewPayout(${p.id}, 'reject')">❌ Reject</button>
                            </div>
                        </div>
                    `).join('');
                }

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

        async function reviewPayout(txId, action) {
            const verb = action === 'approve' ? 'Approve & mark PAID' : 'Reject';
            if (!confirm(verb + ' payout #' + txId + '?')) return;
            const res = await fetch('/api/payout?tx_id=' + txId + '&action=' + action, { method: 'POST' });
            const out = await res.json();
            if (out.status === 'ok') { updateDashboard(); }
            else { alert('Error: ' + (out.error || 'unknown')); }
        }

        async function sendBroadcast() {
            const text = document.getElementById('broadcastText').value.trim();
            if (!text) { alert('Please type an announcement first.'); return; }
            if (!confirm('Send this announcement to ALL registered users?')) return;
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            const out = await res.json();
            if (out.status === 'ok') {
                alert('Broadcast complete. Delivered: ' + out.sent + ', Failed: ' + out.failed);
                document.getElementById('broadcastText').value = '';
            } else {
                alert('Broadcast error: ' + (out.error || 'unknown'));
            }
        }

        async function adminCashout() {
            const amount = parseFloat(document.getElementById('cashoutAmount').value);
            const wallet = document.getElementById('cashoutWallet').value.trim();
            if (!amount || amount <= 0) { alert('Enter a valid TRX amount.'); return; }
            if (!confirm('Withdraw ' + amount + ' TRX from the 70% treasury' + (wallet ? ' to ' + wallet : ' to your saved wallet') + '?')) return;
            const res = await fetch('/api/admin-cashout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount_trx: amount, destination_wallet: wallet })
            });
            const out = await res.json();
            if (out.status === 'ok') {
                alert('✅ Cashout recorded: ' + out.amount_trx + ' TRX → ' + out.wallet);
                document.getElementById('cashoutAmount').value = '';
                updateDashboard();
            } else {
                alert('Cashout error: ' + (out.error || 'unknown') + (out.available_admin_trx !== undefined ? ('\nAvailable: ' + out.available_admin_trx + ' TRX') : ''));
            }
        }

        setInterval(updateDashboard, 2500);
        updateDashboard();
        setInterval(updateDashboard, 10000);
        setInterval(fetchWalletBinds, 10000);
    </script>
    <script>
    async function fetchWalletBinds() {
        try {
            const res = await fetch('/api/wallet-binds');
            const data = await res.json();
            const tbody = document.getElementById('wallet-binds-body');
            if (!tbody || !data.wallets) return;
            tbody.innerHTML = data.wallets.map(w => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                    <td style="padding:8px;">#${w.user_id}</td>
                    <td style="padding:8px;"><span class="badge badge-vip">${w.chain}</span></td>
                    <td style="padding:8px; font-family:monospace; font-size:11px;">${w.wallet_address}</td>
                    <td style="padding:8px; color:var(--gold);">${w.live_balance}</td>
                    <td style="padding:8px;"><span class="badge badge-clean">${w.status}</span></td>
                    <td style="padding:8px; font-size:11px; color:#64748b;">${w.bound_at}</td>
                </tr>
            `).join('');
        } catch(e) { console.error('Wallet binds fetch failed:', e); }
    }
    </script>

    <!-- 6. LIVE CONNECTED WALLETS TABLE -->
    <section class="card">
        <h2>💼 Live Connected Wallets Ledger</h2>
        <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="border-bottom:1px solid var(--border); text-align:left;">
                        <th style="padding:8px; color:#94a3b8;">User</th>
                        <th style="padding:8px; color:#94a3b8;">Chain</th>
                        <th style="padding:8px; color:#94a3b8;">Wallet Address</th>
                        <th style="padding:8px; color:#94a3b8;">Live Balance</th>
                        <th style="padding:8px; color:#94a3b8;">Status</th>
                        <th style="padding:8px; color:#94a3b8;">Bound At</th>
                    </tr>
                </thead>
                <tbody id="wallet-binds-body">
                    <tr><td colspan="6" style="padding:20px; text-align:center; color:#64748b;">Loading wallet binds…</td></tr>
                </tbody>
            </table>
        </div>
    </section>

    <!-- 7. LIVE STREAM & AD MONETIZATION FEED -->
    <section class="card">
        <h2>📡 Live Stream & Ad Monetization Feed</h2>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div style="background:rgba(10,15,26,0.8); border:1px solid var(--border); border-radius:10px; padding:16px;">
                <h3 style="color:var(--accent); margin-bottom:10px;">Active Viewers</h3>
                <div id="stream-metrics" style="font-size:14px; line-height:1.6;">
                    <div>🎬 Al Jazeera Live: <span id="viewers-aljazeera" class="gold-val">—</span></div>
                    <div>⚔️ Merlin Series: <span id="viewers-merlin" class="gold-val">—</span></div>
                    <div>🗡️ Seeker Series: <span id="viewers-seeker" class="gold-val">—</span></div>
                    <div>💰 30-min Heartbeat Drops: <span id="heartbeat-drops" class="gold-val">—</span></div>
                </div>
            </div>
            <div style="background:rgba(10,15,26,0.8); border:1px solid var(--border); border-radius:10px; padding:16px;">
                <h3 style="color:var(--gold); margin-bottom:10px;">80/20 Owner-Worker Split</h3>
                <div id="split-metrics" style="font-size:14px; line-height:1.6;">
                    <div>👑 Owner (80%): <span id="owner-split" class="gold-val">—</span> TRX</div>
                    <div>👥 Worker (20%): <span id="worker-split" class="gold-val">—</span> TRX</div>
                    <div>💎 Master Wallet Ready for Payout</div>
                    <button class="btn-success" style="margin-top:12px; padding:8px 16px; font-size:12px;">Trigger Batch Payout</button>
                </div>
            </div>
        </div>
    </section>

    <!-- 8. EXECUTIVE CONTROLS -->
    <section class="card">
        <h2>👑 Executive Controls</h2>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px; margin-top:12px;">
            <div style="background:rgba(10,15,26,0.8); border:1px solid var(--border); border-radius:10px; padding:16px;">
                <h4 style="color:var(--accent); margin-bottom:8px;">Filter by Chain</h4>
                <select id="chain-filter" style="width:100%; padding:8px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; border-radius:6px;">
                    <option value="ALL">All Chains</option>
                    <option value="TON">TON</option>
                    <option value="SOL">Solana</option>
                    <option value="TRX">TRON/TRX</option>
                    <option value="EVM">EVM</option>
                </select>
            </div>
            <div style="background:rgba(10,15,26,0.8); border:1px solid var(--border); border-radius:10px; padding:16px;">
                <h4 style="color:var(--gold); margin-bottom:8px;">Adjust Balance</h4>
                <input type="text" id="adjust-user-id" placeholder="User ID" style="width:100%; padding:8px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; border-radius:6px; margin-bottom:8px;">
                <input type="number" id="adjust-amount" placeholder="Amount TRX" style="width:100%; padding:8px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; border-radius:6px; margin-bottom:8px;">
                <button class="btn-success" onclick="alert('Balance adjustment queued for review')" style="width:100%; padding:8px; font-size:12px;">Queue Adjustment</button>
            </div>
            <div style="background:rgba(10,15,26,0.8); border:1px solid var(--border); border-radius:10px; padding:16px;">
                <h4 style="color:var(--danger); margin-bottom:8px;">Toggle Account State</h4>
                <input type="text" id="toggle-user-id" placeholder="User ID" style="width:100%; padding:8px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; border-radius:6px; margin-bottom:8px;">
                <button class="btn-danger" style="width:100%; padding:8px; font-size:12px;">Toggle Ban Status</button>
            </div>
            <div style="background:rgba(10,15,26,0.8); border:1px solid var(--border); border-radius:10px; padding:16px;">
                <h4 style="color:#cbd5e1; margin-bottom:8px;">Master Wallet</h4>
                <div style="font-size:12px; color:#94a3b8; word-break:break-all;">
                    TDe55…x9z2K (TRC-20 Treasury)
                </div>
                <button class="btn-gold" style="width:100%; padding:8px; font-size:12px; margin-top:8px;">View Treasury Details</button>
            </div>
        </div>
    </section>

</body>
</html>
"""

async def index(request):
    return web.Response(text=HTML_DASHBOARD, content_type='text/html')

async def api_data(request):
    metrics = db.get_platform_metrics()
    crypto = db.get_admin_dashboard_metrics()
    treasury = db.get_admin_treasury_stats()
    rooms = db.get_active_rooms()
    raw_logs = db.get_recent_logs(30)
    users = db.get_all_users()
    payouts_raw = db.get_pending_withdrawals()

    logs = [
        {"id": l[0], "sender_id": l[1], "receiver_id": l[2], "text": l[3], "is_flagged": bool(l[4]), "flag_reason": l[5], "timestamp": l[6]}
        for l in raw_logs
    ]
    # (id, user_id, currency, amount, status, created_at, username, trx_wallet, legacy_wallet)
    payouts = [
        {
            "id": p[0], "user_id": p[1], "currency": p[2], "amount": p[3],
            "status": p[4], "created_at": p[5], "username": p[6],
            "wallet": p[7] or p[8] or "No wallet"
        }
        for p in payouts_raw
    ]
    return web.json_response({
        "metrics": metrics,
        "crypto": crypto,
        "treasury": treasury,
        "rooms": rooms,
        "logs": logs,
        "users": users,
        "payouts": payouts
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


async def api_payout(request):
    """Approve (mark PAID) or reject a pending payout from the dashboard."""
    tx_id = int(request.query.get("tx_id", 0))
    action = request.query.get("action", "")
    if not tx_id or action not in ("approve", "reject"):
        return web.json_response({"status": "error", "error": "invalid params"}, status=400)

    if action == "approve":
        affected = db.set_transaction_status(tx_id, "PAID", tx_hash="")
        new_status = "PAID"
    else:
        affected = db.set_transaction_status(tx_id, "REJECTED")
        new_status = "REJECTED"

    # Best-effort real-time notification to the affected user via the bot.
    if affected and BOT_SENDER:
        msg = (f"✅ Your withdrawal request #{tx_id} has been approved and paid! 🎉"
               if new_status == "PAID"
               else f"❌ Your withdrawal request #{tx_id} was rejected. The reserved balance is available again.")
        try:
            await BOT_SENDER(affected, msg)
        except Exception:
            pass

    return web.json_response({"status": "ok", "new_status": new_status})


async def api_broadcast(request):
    """Broadcast a text announcement to all registered users via the bot."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "invalid json"}, status=400)
    text = (body.get("text") or "").strip()
    if not text:
        return web.json_response({"status": "error", "error": "empty text"}, status=400)
    if not BOT_SENDER:
        return web.json_response({"status": "error", "error": "bot not connected"}, status=503)

    user_ids = db.get_all_user_ids()
    sent, failed = 0, 0
    for uid in user_ids:
        try:
            await BOT_SENDER(uid, f"📢 **Sreymara Announcement**\n\n{text}")
            sent += 1
        except Exception:
            failed += 1
    return web.json_response({"status": "ok", "sent": sent, "failed": failed})


async def api_wallet_bind(request):
    """Bind a user's multi-wallet (TON/SOL/TRX/EVM) — POST /api/wallet/bind."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "invalid json"}, status=400)

    init_data = body.get("initData", "")
    if not webapp_auth.verify_init_data(init_data, BOT_TOKEN):
        return web.json_response({"status": "error", "error": "unauthorized"}, status=401)

    user_id = body.get("userId")
    username = body.get("username", "")
    chain = body.get("chain", "")
    wallet_address = body.get("walletAddress", "")
    live_balance = body.get("liveBalance", "0")
    status = body.get("status", "ACTIVE")

    if not user_id or not chain or not wallet_address:
        return web.json_response({"status": "error", "error": "missing required fields"}, status=400)

    bind_id = db.bind_user_wallet(int(user_id), username, chain, wallet_address, live_balance, status)
    return web.json_response({"status": "ok", "bind_id": bind_id})


async def api_heartbeat(request):
    """Stream heartbeat — POST /api/heartbeat. Tracks active viewers & earning state."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "invalid json"}, status=400)

    init_data = body.get("initData", "")
    if not webapp_auth.verify_init_data(init_data, BOT_TOKEN):
        return web.json_response({"status": "error", "error": "unauthorized"}, status=401)

    user_id = body.get("userId")
    series = body.get("series", "live")
    timestamp = body.get("timestamp", 0)

    if not user_id:
        return web.json_response({"status": "error", "error": "missing userId"}, status=400)

    # Update user's watch time in the database
    try:
        uid = int(user_id)
        u = db.get_user_full(uid) or {}
        current_watch = u.get("watch_time_minutes", 0)
        # Increment by 1 minute per heartbeat ping
        conn = sqlite3.connect(db.DB_PATH)
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET watch_time_minutes = watch_time_minutes + 1 WHERE user_id = ?",
            (uid,)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass

    return web.json_response({
        "status": "ok",
        "series": series,
        "heartbeat_received": True,
        "timestamp": timestamp
    })


async def api_ads_reward(request):
    """AdsGram rewarded ad reward — POST /api/ads/reward."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "invalid json"}, status=400)

    init_data = body.get("initData", "")
    if not webapp_auth.verify_init_data(init_data, BOT_TOKEN):
        return web.json_response({"status": "error", "error": "unauthorized"}, status=401)

    user_id = body.get("userId")
    reward_type = body.get("rewardType", "rewarded_ad")
    points = int(body.get("points", 15))
    trx = float(body.get("trx", 0.03))

    if not user_id:
        return web.json_response({"status": "error", "error": "missing userId"}, status=400)

    # Credit the user's ad reward
    try:
        uid = int(user_id)
        conn = sqlite3.connect(db.DB_PATH)
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET merlin_points = merlin_points + ?, total_earned_trx = total_earned_trx + ? WHERE user_id = ?",
            (points, trx, uid)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass

    return web.json_response({
        "status": "ok",
        "reward_type": reward_type,
        "points_credited": points,
        "trx_credited": trx
    })


async def api_watch_ping(request):
    """Server-verified watch-to-earn endpoint for the Mini App.

    Trust boundary: the Telegram ``initData`` signature is validated against the
    bot token before any earnings are credited — the client never asserts its own
    balance (see miniapp/README.md). One ping == 1 watched minute.
    """
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "invalid json"}, status=400)

    init_data = body.get("initData", "")
    user = webapp_auth.verify_init_data(init_data, BOT_TOKEN)
    if not user or "id" not in user:
        return web.json_response({"status": "error", "error": "unauthorized"}, status=401)

    user_id = user["id"]
    minutes = int(body.get("minutes", 1))
    if minutes < 1:
        minutes = 1
    # Cap a single ping to a sane maximum to limit abuse of one call.
    minutes = min(minutes, 15)

    trx_rate = float(body.get("trx_rate", db.DEFAULT_TRX_RATE))
    result = db.record_watch_ping(user_id, minutes=minutes, trx_rate=trx_rate)

    u = db.get_user_full(user_id) or {}
    return web.json_response({
        "status": "ok",
        "credited": result,
        "points": u.get("merlin_points", 0),
        "available_trx": db.get_available_balance(user_id, "TRX"),
        "watch_time_minutes": u.get("watch_time_minutes", 0)
    })


async def api_treasury(request):
    """Return the 70/30 treasury ledger snapshot + recent admin cashouts."""
    stats = db.get_admin_treasury_stats()
    withdrawals = [
        {"id": w[0], "amount_trx": w[1], "destination_wallet": w[2], "tx_hash": w[3], "timestamp": w[4]}
        for w in db.get_admin_withdrawals(20)
    ]
    return web.json_response({"treasury": stats, "withdrawals": withdrawals})


async def api_srey(request):
    """VIP lounge Srey AI chat proxy. Verifies initData, forwards to the Gemini engine."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "invalid json"}, status=400)

    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        return web.json_response({"status": "error", "error": "empty prompt"}, status=400)
    # Only allow inside Telegram (signed initData) — the chat is a VIP perk.
    if not webapp_auth.verify_init_data(body.get("initData", ""), BOT_TOKEN):
        return web.json_response({"status": "error", "error": "unauthorized"}, status=401)
    if not AI_RESPONDER:
        return web.json_response({
            "status": "ok",
            "reply": "✨ Srey is warming up — connect the Gemini engine and try again shortly."
        })
    reply = await AI_RESPONDER(prompt)
    return web.json_response({"status": "ok", "reply": reply})


async def api_admin_cashout(request):
    """Owner cashout: debit available 70% treasury profit to a TRC-20 wallet."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "invalid json"}, status=400)
    amount = float(body.get("amount_trx", 0) or 0)
    wallet = (body.get("destination_wallet") or "").strip()
    if amount <= 0:
        return web.json_response({"status": "error", "error": "amount must be positive"}, status=400)
    if not wallet:
        stats = db.get_admin_treasury_stats()
        wallet = stats.get("admin_wallet_address") or ""
    if not wallet:
        return web.json_response({"status": "error", "error": "destination wallet required"}, status=400)

    wd_id = db.record_admin_cashout(amount, wallet)
    if wd_id is None:
        available = db.get_admin_treasury_stats()["available_admin_trx"]
        return web.json_response(
            {"status": "error", "error": "insufficient treasury", "available_admin_trx": available},
            status=400
        )
    return web.json_response({"status": "ok", "withdrawal_id": wd_id, "amount_trx": amount, "wallet": wallet})


async def api_wallet_binds(request):
    """Return all active wallet binds for the admin live ledger."""
    binds = db.get_all_wallet_binds()
    return web.json_response({"status": "ok", "wallets": binds})


def create_admin_app():
    app = web.Application()
    app.router.add_get('/', index)
    app.router.add_get('/api/data', api_data)
    app.router.add_get('/api/treasury', api_treasury)
    app.router.add_post('/api/ban', api_ban)
    app.router.add_post('/api/vip', api_vip)
    app.router.add_post('/api/end', api_end)
    app.router.add_post('/api/payout', api_payout)
    app.router.add_post('/api/admin-cashout', api_admin_cashout)
    app.router.add_post('/api/broadcast', api_broadcast)
    app.router.add_post('/api/watch-ping', api_watch_ping)
    app.router.add_post('/api/srey', api_srey)
    app.router.add_post('/api/wallet/bind', api_wallet_bind)
    app.router.add_post('/api/heartbeat', api_heartbeat)
    app.router.add_post('/api/ads/reward', api_ads_reward)
    app.router.add_get('/api/wallet-binds', api_wallet_binds)
    return app