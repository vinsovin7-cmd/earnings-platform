# Sreymara Paradise — Universal Master Web App

The root `/` and `/miniapp` routes serve the luxury "Heavenly Paradise" cinema
shell (see `vercel.json`). It is a standalone public-domain sample player with
wallet connection UI.

Checkout buttons are disabled. The legacy `/api/mock-purchase` route returns
HTTP 410 and never reports payment success. Connecting a wallet does not make a
payment.

## Tabs

1. 🍿 **Merlin Cinema Series** — hero banner + on-demand HLS playlist + watch-to-earn.
2. 📡 **Al Jazeera English 24/7 Live** — live HLS news stream.
3. 💎 **VIP Lounge & Srey AI** — chat overlay proxied (HMAC-verified) to Gemini.
4. 👑 **Owner & Admin 70% Vault** — gated client-side to the platform owner ID
   (`8522820906`) and always server-guarded on the API.

## Watch-to-Earn (server-verified, 70/30 split)

The watch-to-earn timer pings the backend every 60 seconds.

**Trust boundary.** Earnings are never computed or stored in the browser. While
earning is active, the client POSTs the signed Telegram `initData` string to
`/api/watch-ping`. The backend:

1. Verifies the `initData` HMAC signature against the bot token
   (`sreymara-bot/webapp_auth.py`).
2. Applies the **70/30 split** (`database.credit_split_earnings`): 30% of gross
   TRX to the watching user, 70% silently to the `admin_treasury` ledger.
3. Returns the user's authoritative 30% balance, which the client renders in the
   header telemetry badges.

A ping without a valid signature is rejected with HTTP 401 and nothing is
credited. No browser-local balance is trusted (see below).

## Owner Vault cashout

The vault tab reads `/api/treasury` and posts `/api/admin-cashout`. Both are
admin-only on the server; the client gate is a UX convenience, never the
security boundary.

Production earnings require a server-verified Telegram identity, persistent
task ledger, independently verified viewing/task evidence, and a funded payout
service. These must not be replaced by browser-local balances or client
assertions.

### Client configuration

- `window.Telegram.WebApp.initDataUnsafe.user` populates the user handle/ID.
- `window.API_BASE` (or legacy `window.WATCH_API_BASE`) points the pings at the
  bot's aiohttp server; it defaults to same-origin `/api/*`.
- Critical above-the-fold CSS is inlined in `index.html` for a 0-second cold
  start; the full theme lives in `styles.css`.


