#!/bin/bash
set -euo pipefail

usage() {
  cat << EOF
Usage: $0 [OPTIONS]
Setup a cron job to run the guidance nightly evaluation.

Options:
  --help        Show this help message and exit.
  --schedule    Specify the cron schedule (default: "0 2 * * *").
                Make sure to quote the schedule string.
  --agents      Specify a space-separated list of agents to run
                (default: "jetski_cli claude_code codex_cli").
  --workers     The number of concurrent workers to use (optional).

Examples:
  $0
  $0 --schedule "30 3 * * *"
  $0 --agents "jetski_cli codex_cli"
  $0 --schedule "0 1 * * *" --agents "claude_code"
  $0 --workers 10
EOF
}

# Default values
SCHEDULE="0 2 * * *"
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
CRON_CMD="PATH=\"$PATH\" \"$SCRIPT_DIR/run_guidance_nightly.sh\" --agents \"$AGENTS\""
if [ -n "$WORKERS" ]; then
  CRON_CMD="$CRON_CMD --workers \"$WORKERS\""
fi
CRON_JOB="$SCHEDULE $CRON_CMD"

# Capture current crontab, ignoring errors if it doesn't exist yet
CURRENT_CRON=$(crontab -l 2>/dev/null || true)

# Check if an active (uncommented) cron job exists
EXISTING_JOB=$(awk '$0 !~ /^[[:space:]]*#/ && /run_guidance_nightly\.sh/' <<< "$CURRENT_CRON")

if [ -n "$EXISTING_JOB" ]; then
  echo "An active cron job for this repository is already installed:"
  echo "$EXISTING_JOB"
  echo ""
  echo "To change the schedule or remove it, please run 'crontab -e'."
else
  # Append to crontab
  if { [ -n "$CURRENT_CRON" ] && printf "%s\n" "$CURRENT_CRON"; printf "%s\n" "$CRON_JOB"; } | crontab -; then
    echo "✅ Successfully installed cron job:"
    echo "$CRON_JOB"
  else
    echo "❌ Failed to install cron job. Please check your schedule syntax: '$SCHEDULE'"
    exit 1
  fi
fi
