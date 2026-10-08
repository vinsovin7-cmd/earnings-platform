Urban Cinema — Mini App

This folder is a standalone static Mini App intended to be deployed separately (or from the monorepo) to Vercel as a static site.

Quick overview:
- /miniapp/index.html — entrypoint (static)
- /miniapp/app.js — client logic: HLS player, TonConnect, Phantom connect, USD formatting, mock wallet-pay flow
- /api/mock-purchase.js — Vercel serverless endpoint (demo only) to simulate server-side receipts

How to deploy to Vercel (recommended flow):
1. In Vercel dashboard, "New Project" → select this repository (morethanwords/tweb).
2. In "Configure Project" set:
   - Root Directory: /miniapp
   - Build & Output Settings: Since this is a static folder with index.html, no build command is required.
   - Output Directory: leave empty (Vercel will serve the static files from the selected root)
3. Deploy.

If you prefer to use the Vercel CLI:
- Install Vercel globally: npm i -g vercel
- From repo root run: vercel --prod --confirm --cwd ./miniapp

Important follow-ups to complete before production:
- Replace the mock /api/mock-purchase endpoint with a real payment or chain-processing backend.
- For Telegram in-app purchases you must implement sendInvoice on your Bot server using the Bot API and provider_token where appropriate (Telegram Stars or physical goods flow). See https://core.telegram.org/bots/payments
- TonConnect/Phantom integration currently runs with CDN SDKs and is a connect-only demo — implement on-chain payments and secure backend off-chain verification scripts before real-money usage.
- Add CSP and other security headers via Vercel project settings or serverless functions.
