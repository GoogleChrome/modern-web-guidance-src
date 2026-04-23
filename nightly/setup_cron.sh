#!/bin/bash
set -euo pipefail

if [ "$#" -gt 1 ]; then
  echo "❌ Error: Please quote the schedule string to prevent shell expansion."
  echo "Usage: $0 \"0 2 * * *\""
  exit 1
fi

# Default schedule is 2 AM every day
SCHEDULE="${1:-0 2 * * *}"

if [ $(echo "$SCHEDULE" | wc -w) -ne 5 ]; then
  echo "❌ Error: Invalid cron schedule format: '$SCHEDULE' (must have 5 fields)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_CMD="PATH=\"$PATH\" \"$SCRIPT_DIR/run_guidance_nightly.sh\""
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
