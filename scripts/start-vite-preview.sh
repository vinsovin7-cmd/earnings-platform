#!/usr/bin/env bash
set -euo pipefail

port="$1"
shift
if [[ "${1:-}" == "--" ]]; then
  shift
fi
exec pnpm exec vite dev --host 0.0.0.0 --port "$port" --strictPort "$@"
