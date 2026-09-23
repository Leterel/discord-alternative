#!/usr/bin/env bash
# Local integration only: bind coturn and all relay allocations to loopback.
# Needs Linux, Node, coturn, npm ci and a Playwright-compatible Chromium.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != '--external' ]; }; then
  printf 'Usage: bash test/turn-relay.sh [--external]\n' >&2
  exit 2
fi
TURN_EXECUTABLE="${TURN_BIN:-turnserver}"
command -v "$TURN_EXECUTABLE" >/dev/null
export TEST_TURN_URLS='turn:127.0.0.1:34789?transport=udp'
export TEST_TURN_SECRET
TEST_TURN_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
export TEST_OUTPUT_DIR="${TEST_OUTPUT_DIR:-test-results/turn}"
mkdir -p "$TEST_OUTPUT_DIR"
"$TURN_EXECUTABLE" --listening-ip=127.0.0.1 --relay-ip=127.0.0.1 \
  --listening-port=34789 --min-port=34800 --max-port=34850 \
  --use-auth-secret --static-auth-secret="$TEST_TURN_SECRET" \
  --realm=local.sofafunk.test --allow-loopback-peers --no-multicast-peers \
  --no-tls --no-dtls --no-cli --relay-threads=1 \
  --pidfile="$TEST_OUTPUT_DIR/coturn.pid" \
  --log-file="$TEST_OUTPUT_DIR/coturn.log" --simple-log \
  > "$TEST_OUTPUT_DIR/coturn-console.log" 2>&1 &
relay_pid=$!
trap 'kill "$relay_pid" 2>/dev/null || true; wait "$relay_pid" 2>/dev/null || true' EXIT
sleep 1
kill -0 "$relay_pid"
if [ "${1:-}" = '--external' ]; then
  node test/remote-loopback.mjs
else
  node test/rtc.mjs
fi
