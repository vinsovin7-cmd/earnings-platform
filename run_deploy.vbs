Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c git add .", 0, True
shell.Run "cmd /c git commit -m ""Deploy current build to production""", 0, True
shell.Run "cmd /c git push origin main", 0, True
shell.Run "cmd /c npx vercel --prod --yes", 1, False