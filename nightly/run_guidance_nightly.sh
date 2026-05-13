#!/bin/bash
set -euo pipefail

usage() {
  cat << EOF
Usage: $0 [OPTIONS]
Run the guidance nightly evaluation sequence.

Options:
  --help        Show this help message and exit.
  --agents      Specify a space-separated list of agents to run
                (default: "jetski_cli claude_code codex_cli").
                Valid agents: jetski_cli, claude_code, codex_cli
  --workers     The number of concurrent workers to use (optional).

Examples:
  $0
  $0 --agents "jetski_cli codex_cli"
  $0 --agents "jetski_cli" --workers 10
EOF
}

# Default values
AGENTS_TO_RUN="jetski_cli claude_code codex_cli"
WORKERS="20"

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --agents)
      if [[ -z "${2:-}" ]]; then echo "Error: --agents requires an argument"; exit 1; fi
      AGENTS_TO_RUN="$2"
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
  
  local cmd_args=("--agent" "$agent")
  if [ -n "$WORKERS" ]; then
    cmd_args+=("--workers" "$WORKERS")
  fi

  "$SCRIPT_DIR/run_agent.sh" "${cmd_args[@]}" || { 
    echo "Error running $agent"
    if ! grep -qF "Nightly run for agent ${agent}" "$SUMMARY_FILE"; then
      printf "❌ Nightly run for agent %s failed completely.\n\n----------------------------------------\n\n" "$agent" >> "$SUMMARY_FILE"
    fi
    FAILED=1 
  }
}

for agent in $AGENTS_TO_RUN; do
  run_agent "$agent"
done

echo "Guidance nightly run completed."
if [ "$FAILED" -ne 0 ]; then
  exit 1
fi
