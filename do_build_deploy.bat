@echo off
cd /d "%~dp0"
pnpm run build
npx vercel --prod --yes