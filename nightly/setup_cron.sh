#!/bin/bash
set -euo pipefail

usage() {
  cat << EOF
Usage: $0 [OPTIONS]
Setup a cron job to run the weekly or nightly guidance evaluation.

Options:
  --help        Show this help message and exit.
  --schedule    Specify the cron schedule (default: "0 2 * * *").
                Make sure to quote the schedule string.
  --prefix      Specify the prefix name of this periodic run (default: "nightly").
                e.g. "weekly", "nightly", "daily".
  --agents      Specify a space-separated list of agents to run
                (default: "jetski_cli claude_code codex_cli").
  --workers     The number of concurrent workers to use (optional).

Examples:
  $0
  $0 --schedule "30 3 * * *"
  $0 --schedule "0 22 * * 0" --prefix "weekly"
  $0 --agents "jetski_cli codex_cli"
  $0 --workers 10
EOF
}

# Default values
SCHEDULE="0 2 * * *"
PREFIX="nightly"
AGENTS="jetski_cli claude_code codex_cli"
WORKERS="20"

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --schedule)
      if [[ -z "${2:-}" ]]; then echo "Error: --schedule requires an argument"; exit 1; fi
      SCHEDULE="$2"
      shift 2
      ;;
    --prefix)
      if [[ -z "${2:-}" ]]; then echo "Error: --prefix requires an argument"; exit 1; fi
      PREFIX="$2"
      shift 2
      ;;
    --agents)
      if [[ -z "${2:-}" ]]; then echo "Error: --agents requires an argument"; exit 1; fi
      AGENTS="$2"
      shift 2
      ;;
    --workers)
      if ! [[ "${2:-}" =~ ^[0-9]+$ ]]; then echo "Error: --workers requires a numeric argument"; exit 1; fi
      WORKERS="$2"
      shift 2
      ;;
    *)
      echo "❌ Error: Unknown option or positional argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [ $(echo "$SCHEDULE" | wc -w) -ne 5 ]; then
  echo "❌ Error: Invalid cron schedule format: '$SCHEDULE' (must have 5 fields)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_CMD="PATH=\"$PATH\" \"$SCRIPT_DIR/run_guidance_nightly.sh\" --prefix \"$PREFIX\" --agents \"$AGENTS\""
if [ -n "$WORKERS" ]; then
  CRON_CMD="$CRON_CMD --workers \"$WORKERS\""
fi
CRON_JOB="$SCHEDULE $CRON_CMD"

# Capture current crontab, ignoring errors if it doesn't exist yet
CURRENT_CRON=$(crontab -l 2>/dev/null || true)

# Clean out any old/existing runs of this evaluation script from the crontab to perform a clean update
CLEANED_CRON=$(echo "$CURRENT_CRON" | grep -v -E "run_guidance_nightly\.sh|# Guidance .* evaluation" || true)

# Remove trailing and duplicate newlines in the existing cron block safely
CLEANED_CRON=$(echo "$CLEANED_CRON" | tr -s '\n')

# Append new job with its descriptive comment
NEW_CRON_ENTRY=$(printf "# Guidance %s evaluation\n%s" "$PREFIX" "$CRON_JOB")

if [ -n "$CURRENT_CRON" ] && echo "$CURRENT_CRON" | grep -q "run_guidance_nightly.sh"; then
  echo "🔄 Updating existing cron job for this repository..."
else
  echo "📥 Installing new cron job..."
fi

if { [ -n "$CLEANED_CRON" ] && printf "%s\n" "$CLEANED_CRON"; printf "%s\n" "$NEW_CRON_ENTRY"; } | crontab -; then
  echo "✅ Successfully registered cron job:"
  echo "$NEW_CRON_ENTRY"
else
  echo "❌ Failed to install cron job. Please check your schedule syntax: '$SCHEDULE'"
  exit 1
fi
