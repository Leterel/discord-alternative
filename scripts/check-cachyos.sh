#!/usr/bin/env bash
set -eu
# Read-only prerequisite check. Never installs packages or restarts services.
if [ "$#" -gt 1 ]; then
  printf 'Usage: bash scripts/check-cachyos.sh [path-to-SofaFunk-AppImage-or-binary]\n' >&2
  exit 2
fi
if [ "$#" -eq 1 ]; then
  exec "$1" --diagnose-linux
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/desktop/linux-diagnostics.cjs"
