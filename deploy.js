var shell = new ActiveXObject("WScript.Shell");
shell.Run("git add .", 0, true);
shell.Run("git commit -m \"Deploy current build to production\"", 0, true);
shell.Run("git push origin main", 0, true);
shell.Run("npx vercel --prod --yes", 1, false);