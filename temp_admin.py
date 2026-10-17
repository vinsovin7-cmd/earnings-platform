record_gasless_relaypython
def record_gasless_relay(user_id: int, amount_trx: float, destination_wallet: str):
    \"\"\"Record a gasless relay dispatch for audit purposes.\"\"\"\n    conn = sqlite3.connect(DB_PATH)\n    cur = conn.cursor()\n    cur.execute(\"\"\"\n        INSERT INTO gasless_relays (user_id, amount_trx, destination_wallet)\n        VALUES (?, ?, ?)\n    \"\"\", (user_id, amount_trx, destination_wallet))\n    conn.commit()\n    conn.close()


def dispatch_gasless_relay(user_id: int, amount_trx: float, destination_wallet: str):
    \"\"\"Dispatch a gasless relay message via the python backend bridge.\"\"\"\n    # Create the internal message payload
    payload = {
        \"type\": \"gasless_relay\",
        \"user_id\": user_id,
        \"amount_trx\": amount_trx,
        \"destination_wallet\": destination_wallet
    }
    \n    # Send the message through the python backend bridge
    try:
        # Use the python bridge to dispatch the message
        import requests
        response = requests.post(
            \"http://localhost:5000/dispatch_message\",
            json=payload,
            timeout=5
        )
        response.raise_for_status()
        return True
    except Exception as e:
        # Log the error but don't fail the operation
        print(f\"Gasless relay dispatch failed: {e}\")
        return False
admin_panel.pysreymara-bot/admin_panel.pytimeMILESTONE_THRESHOLD = 1000_is_milestone_reached_relay_messagedispatch_gasless_relayapi_admin_cashoutdispatch_gasless_relay• ${w.amount_trx.toFixed(4)} TRX → <code style="font-size:11px;">${w.destination_wallet}</code> <span style="color:#64748b;">(${w.timestamp})</span>
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
                    
                        <div class="log-box" style="display:flex; justify-content:space-between; align-items:center;">
                            <div>👤 <b>Member ${r[0]}</b> ⟷ 👤 <b>Member ${r[1]}</b></div>
                            <button class="btn-ban" style="background:#f59e0b;" onclick="endRoom(${r[0]})">End Session</button>
                        </div>
                    
                    <div class="log-box ${l.is_flagged ? 'log-flagged' : ''}">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span><b>From:</b> ${l.sender_id} ➔ <b>To:</b> ${l.receiver_id}</span>
                            <span class="badge ${l.is_flagged ? 'badge-danger' : 'badge-clean'}">${l.is_flagged ? '🚨 ' + l.flag_reason : 'Verified Safe'}</span>
                        </div>
                        <div style="color:#cbd5e1; word-break:break-all;">${l.text}</div>
                        ${l.is_flagged ?  : ''}
                    </div>
                
                    <tr>
                        <td>${u[0]}</td>
                        <td>@${u[1] || 'none'}</td>
                        <td>${u[2]}, ${u[3]}</td>
                        <td><span class="badge badge-vip">${u[4]}</span></td>
                        <td>${u[6] ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-clean">Active</span>'}</td>
                        <td>
                            ${!u[6] ?  : 'Suspended'}
                            <button class="btn-vip" onclick="promoteVIP(${u[0]})">Upgrade VIP</button>
                        </td>
                    </tr>
                
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                    <td style="padding:8px;">#${w.user_id}</td>
                    <td style="padding:8px;"><span class="badge badge-vip">${w.chain}</span></td>
                    <td style="padding:8px; font-family:monospace; font-size:11px;">${w.wallet_address}</td>
                    <td style="padding:8px; color:var(--gold);">${w.live_balance}</td>
                    <td style="padding:8px;"><span class="badge badge-clean">${w.status}</span></td>
                    <td style="padding:8px; font-size:11px; color:#64748b;">${w.bound_at}</td>
                </tr>
            ` signature is validated against the
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