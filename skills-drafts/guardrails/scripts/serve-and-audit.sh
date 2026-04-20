#!/usr/bin/env bash
# serve-and-audit.sh
# Serves a directory on a local port and runs Lighthouse CLI against it.
# Outputs the Lighthouse JSON report to a specified path.
#
# Usage: ./serve-and-audit.sh <directory> <output-path> [port]
#
# Arguments:
#   directory   — the directory to serve (e.g., dist/, build/, or project root)
#   output-path — where to write the Lighthouse JSON report
#   port        — local port to use (default: 8765)
#
# Prerequisites:
#   - Node.js and npm
#   - lighthouse (npm package)
#   - http-server (npm package)
#   - Chrome or Chromium installed

set -euo pipefail

SERVE_DIR="${1:?Usage: serve-and-audit.sh <directory> <output-path> [port]}"
OUTPUT_PATH="${2:?Usage: serve-and-audit.sh <directory> <output-path> [port]}"
PORT="${3:-8765}"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Validate serve directory exists
if [ ! -d "$SERVE_DIR" ]; then
  echo "Error: Directory '$SERVE_DIR' does not exist." >&2
  exit 1
fi

# Check for Chrome/Chromium (including macOS application paths)
CHROME_BIN=""
for candidate in google-chrome chromium-browser chromium chrome; do
  if command -v "$candidate" &>/dev/null; then
    CHROME_BIN="$candidate"
    break
  fi
done

# macOS: Chrome is not in $PATH by default
if [ -z "$CHROME_BIN" ] && [ "$(uname)" = "Darwin" ]; then
  for mac_candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"; do
    if [ -x "$mac_candidate" ]; then
      CHROME_BIN="$mac_candidate"
      break
    fi
  done
fi

if [ -n "$CHROME_BIN" ]; then
  export CHROME_PATH="$CHROME_BIN"
  echo "Using Chrome: $CHROME_BIN"
else
  echo "Warning: No Chrome/Chromium binary found in PATH or standard locations." >&2
  echo "Lighthouse will attempt to use its bundled Chromium." >&2
fi

# Check if port is already in use
if lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
  echo "Warning: Port $PORT is already in use. Picking a random available port..." >&2
  PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()' 2>/dev/null || echo "0")
  if [ "$PORT" = "0" ]; then
    echo "Error: Could not find an available port." >&2
    exit 1
  fi
  echo "Using port $PORT instead."
fi

# Start local server
echo "Starting server on port $PORT, serving '$SERVE_DIR'..."
npx http-server "$SERVE_DIR" -p "$PORT" --silent -c-1 &
SERVER_PID=$!

# Wait for server to be ready (up to 10 seconds)
echo "Waiting for server to be ready..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null -w "" "http://localhost:$PORT" 2>/dev/null; then
    echo "Server is ready."
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "Error: Server failed to start within 10 seconds." >&2
    exit 1
  fi
  sleep 0.5
done

# Run Lighthouse
echo "Running Lighthouse audit..."
CHROME_FLAGS="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage"

LH_STDERR="$(mktemp)"
LH_EXIT=0
npx lighthouse "http://localhost:$PORT" \
  --output=json \
  --output-path="$OUTPUT_PATH" \
  --chrome-flags="$CHROME_FLAGS" \
  --only-categories=best-practices,accessibility,performance \
  --quiet \
  2>"$LH_STDERR" || LH_EXIT=$?

if [ -f "$OUTPUT_PATH" ]; then
  echo "Lighthouse report saved to $OUTPUT_PATH"
else
  echo "Error: Lighthouse exited with code $LH_EXIT" >&2
  if [ -s "$LH_STDERR" ]; then
    echo "Lighthouse stderr:" >&2
    cat "$LH_STDERR" >&2
  fi
  rm -f "$LH_STDERR"
  exit 1
fi
rm -f "$LH_STDERR"

echo "Done. Server stopped."