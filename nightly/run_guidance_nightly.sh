#!/bin/bash
set -euo pipefail

LOG_DIR="$HOME/.guidance_logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/nightly_$(date +%Y%m%d_%H%M%S).log"
if [ -t 1 ]; then
  echo "Logging output to: $LOG_FILE"
fi
exec > "$LOG_FILE" 2>&1

USER_LDAP=$(whoami)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

die() {
  echo "$1"
  if [ -n "${SUMMARY_FILE:-}" ] && [ -f "$SUMMARY_FILE" ]; then
    printf "❌ Nightly Script Error: %s\n" "$1" >> "$SUMMARY_FILE"
  fi
  exit 1
}

SUMMARY_FILE=$(mktemp "/tmp/nightly_summary.XXXXXX") || die "Failed to create temp file"
export SUMMARY_FILE
FAILED=0

send_summary_email() {
  local exit_code=$?
  set +e
  
  local sendgmr_cmd="/google/bin/releases/gws-sre/files/sendgmr/sendgmr"
  local subject="Guidance Nightly Eval Completed Successfully"
  
  if [ "$FAILED" -ne 0 ] || [ "$exit_code" -ne 0 ]; then
    subject="Guidance Nightly Eval FAILED"
  fi

  {
    printf "Guidance Nightly run results:\n\n"
    if [ -s "$SUMMARY_FILE" ]; then
      cat "$SUMMARY_FILE"
    else
      printf "❌ Catastrophic failure occurred before any agent results could be recorded.\n"
    fi
    printf "\nDashboard: go/guidance-evals\n"
  } | timeout 100s $sendgmr_cmd --subject="$subject" --to="${USER_LDAP}@google.com" || echo "Warning: Failed to send email via sendgmr"
  
  rm -f "$SUMMARY_FILE"
}
trap send_summary_email EXIT

REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)" || die "Failed to determine repo root"
cd "$REPO_ROOT" || die "Failed to locate repo root"

# Run agents sequentially
export NIGHTLY_GUIDANCE_RUN=1

run_agent() {
  local agent="$1"
  "$SCRIPT_DIR/run_agent.sh" "$agent" || { 
    echo "Error running $agent"
    if ! grep -qF "Nightly run for agent ${agent}" "$SUMMARY_FILE"; then
      printf "❌ Nightly run for agent %s failed completely.\n\n----------------------------------------\n\n" "$agent" >> "$SUMMARY_FILE"
    fi
    FAILED=1 
  }
}

run_agent "jetski_cli"
run_agent "claude"
run_agent "codex"

echo "Guidance nightly run completed."
if [ "$FAILED" -ne 0 ]; then
  exit 1
fi