@echo off
REM ============================================================
REM  Sreymara Bot runner (Windows)
REM  Starts the admin dashboard + Mini App API on 0.0.0.0:8080.
REM  Requires Python 3.14 + a venv; uses ONLY pre-built wheels
REM  (aiohttp cp314, pydantic-core cp314) so NO C++ compiler is
REM  needed.  Copies of this file live in the repo root.
REM ============================================================

setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "VENV=venv"
set "PYEXE=%VENV%\Scripts\python.exe"
set "BOT=sreymara-bot\bot.py"

echo ============================================
echo  Sreymara Bot / Mini App API runner
echo ============================================
echo [1/3] Checking virtual environment (%VENV%)...
if not exist "%PYEXE%" (
    echo [1/3]   venv not found -> creating with "python -m venv %VENV%"
    python -m venv "%VENV%"
    if errorlevel 1 (
        echo [1/3]   ERROR: could not create venv. Install Python 3.11/3.12/3.13
        echo [1/3]   (preferred) or 3.14 and retry. && exit /b 1
    )
    set "PYEXE=%VENV%\Scripts\python.exe"
)
if not exist "%PYEXE%" (
    echo [1/3]   ERROR: venv python not found after creation. && exit /b 1
)
echo [1/3]   OK -> %PYEXE%

echo [2/3] Ensuring wheel-compatible packages in the venv...
"%PYEXE%" -m pip install --upgrade --progress-bar off --only-binary=:all: ^
    "aiogram>=3.16,<4" ^
    "aiohttp>=3.11" ^
    "pydantic>=2.10" ^
    "python-dotenv" ^
    "google-genai==1.0.0" ^
    "google-auth" ^
    "requests" ^
    "websockets" ^
    "pyasn1-modules" ^
    "cryptography"
if errorlevel 1 (
    echo [2/3]   ERROR: dependency install failed. See output above. && exit /b 1
)
echo [2/3]   OK -> aiogram, aiohttp (cp314 wheel), pydantic-core (cp314 wheel)

echo [3/3] Config check: sreymara-bot\.env
if not exist "sreymara-bot\.env" (
    echo [3/3]   WARNING: sreymara-bot\.env not found. Copy sreymara-bot\.env.example -> sreymara-bot\.env
    echo [3/3]   and fill in BOT_TOKEN, ADMIN_ID, GEMINI_API_KEY before starting.
)

echo [3/3] Starting Sreymara bot + Admin / Mini App API on 0.0.0.0:8080...
echo [3/3]   Open http://0.0.0.0:8080 in Telegram or a browser.
echo [3/3]   Press Ctrl+C to stop.

"%PYEXE%" "sreymara-bot\bot.py"
if errorlevel 1 (
    echo.
    echo [3/3]   Bot exited with error. This is usually expected when BOT_TOKEN is a
    echo [3/3]   placeholder: the aiohttp Admin/Mini-App API server on :8080 runs
    echo [3/3]   fine, but Telegram polling needs the REAL token from @BotFather.
)
endlocal
