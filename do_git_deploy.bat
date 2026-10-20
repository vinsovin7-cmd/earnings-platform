@echo off
git add .
git commit -m "Deploy current build to production"
git push origin main
npx vercel --prod --yes