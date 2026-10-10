#!/usr/bin/env bash
# Persistent Cinema Mini App Development Server
# Ensures reliable background operation without tunnel drops or 502 errors
# Usage: bash scripts/start-cinema-server.sh [port]
# Default port: 4173 (cinema preview)

set -euo pipefail

PORT="${1:-4173}"

# Check if port is available
if command -v ss &>/dev/null; then
  if ss -tlnp "tcp:$PORT" | grep -q "LISTEN"; then
    echo "Error: Port $PORT is already in use."
    echo "Try a different port or kill the existing process."
    exit 1
  fi
elif command -v netstat &>/dev/null; then
  if netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
    echo "Error: Port $PORT is already in use."
    exit 1
  fi
fi

# Check for pnpm
if ! command -v pnpm &>/dev/null; then
  echo "Error: pnpm is not installed."
  exit 1
fi

# Check for vite
if ! pnpm exec vite --version &>/dev/null; then
  echo "Error: vite is not installed. Run 'pnpm install' first."
  exit 1
fi

echo "Starting Urban Cinema Mini App development server on port $PORT..."
echo "Server will run in background and auto-restart on crashes."
echo "Access at: http://localhost:$PORT/cinema"
echo "Press Ctrl+C to stop."

# Function to start the server with auto-restart
start_server() {
  while true; do
    TWEB_PREVIEW=1 pnpm exec vite dev --host 0.0.0.0 --port "$PORT" --strictPort --clearScreen false \
      && break || {
        echo "Server crashed. Restarting in 2 seconds..."
        sleep 2
      }
  done
}

# Trap Ctrl+C to exit gracefully
trap 'echo "Shutting down Cinema server..."; exit 0' SIGINT SIGTERM

# Start the server
start_server
