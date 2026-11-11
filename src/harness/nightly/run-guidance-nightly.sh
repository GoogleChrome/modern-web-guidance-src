#!/bin/bash
set -euo pipefail

usage() {
  cat << EOF
Usage: $0 [OPTIONS]
Run the guidance evaluation sequence.

Options:
  --help        Show this help message and exit.
  --prefix      Specify the prefix name of this periodic run (default: "nightly").
                e.g. "weekly", "nightly", "daily".
  --local       Run using local committed repository HEAD instead of origin/main (optional).
                Highly useful for testing orchestration script updates locally.
  --agents      Specify a space-separated list of agents to run
                (default: "antigravity_cli claude_code codex_cli").
                Valid agents: antigravity_cli, claude_code, codex_cli
  --workers     The number of concurrent workers to use (optional).

Examples:
  $0
  $0 --prefix "weekly"
  $0 --prefix "weekly" --local
  $0 --agents "antigravity_cli" --workers 10
EOF
}

# Default values
PREFIX="nightly"
AGENTS_TO_RUN="antigravity_cli claude_code codex_cli"
WORKERS=""
RUN_LOCAL="false"

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --prefix)
      if [[ -z "${2:-}" ]]; then echo "Error: --prefix requires an argument"; exit 1; fi
      PREFIX="$2"
      shift 2
      ;;
    --local)
      RUN_LOCAL="true"
      shift 1
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
LOG_FILE="$LOG_DIR/${PREFIX}_$(date +%Y%m%d_%H%M%S).log"
if [ -t 1 ]; then
  echo "Logging output to: $LOG_FILE"
fi
exec > "$LOG_FILE" 2>&1

USER_LDAP=$(whoami)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPLAY_NAME="$(echo "${PREFIX}" | sed 's/./\U&/')"

die() {
  echo "$1"
  if [ -n "${SUMMARY_FILE:-}" ] && [ -f "$SUMMARY_FILE" ]; then
    printf "❌ %s Script Error: %s\n" "${DISPLAY_NAME}" "$1" >> "$SUMMARY_FILE"
  fi
  exit 1
}

SUMMARY_FILE=$(mktemp "/tmp/guidance_summary.XXXXXX") || die "Failed to create temp file"
export SUMMARY_FILE
FAILED=0

send_summary_email() {
  local exit_code=$?
  set +e
  
  local sendgmr_cmd="/google/bin/releases/gws-sre/files/sendgmr/sendgmr"
  local subject="Guidance ${DISPLAY_NAME} Eval Completed Successfully"
  
  if [ "$FAILED" -ne 0 ] || [ "$exit_code" -ne 0 ]; then
    subject="Guidance ${DISPLAY_NAME} Eval FAILED"
  fi

  {
    printf "Guidance %s run results:\n\n" "${DISPLAY_NAME}"
    if [ -s "$SUMMARY_FILE" ]; then
      cat "$SUMMARY_FILE"
    else
      printf "❌ Catastrophic failure occurred before any agent results could be recorded.\n"
    fi
  } | timeout 100s $sendgmr_cmd --subject="$subject" --to="${USER_LDAP}@google.com" || echo "Warning: Failed to send email via sendgmr"
  
  rm -f "$SUMMARY_FILE"
}
trap send_summary_email EXIT

REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)" || die "Failed to determine repo root"
cd "$REPO_ROOT" || die "Failed to locate repo root"

# Preflight check: if this run meets the conditions to publish public evals at the end,
# verify that gh CLI is installed and authenticated upfront, failing fast before evals run.
if [ "$RUN_LOCAL" != "true" ] && [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] && [ -z "$(git status --porcelain)" ] && [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main 2>/dev/null)" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    die "gh CLI is required to publish public evals after nightly runs, but is not installed or not in PATH."
  fi
  if ! gh auth status >/dev/null 2>&1; then
    die "gh is not authenticated. Please run 'gh auth login' (with workflow scope) to allow dispatching the Pages deployment after nightly evals."
  fi
fi

# Run agents sequentially
export NIGHTLY_GUIDANCE_RUN=1

run_agent() {
  local agent="$1"
  
  local cmd_args=("--agent" "$agent" "--prefix" "$PREFIX")
  if [ -n "$WORKERS" ]; then
    cmd_args+=("--workers" "$WORKERS")
  fi
  if [ "$RUN_LOCAL" = "true" ]; then
    cmd_args+=("--local")
  fi

  "$SCRIPT_DIR/run-agent.sh" "${cmd_args[@]}" || { 
    echo "Error running $agent"
    if ! grep -qF "${DISPLAY_NAME} run for agent ${agent}" "$SUMMARY_FILE"; then
      printf "❌ %s run for agent %s failed completely.\n\n----------------------------------------\n\n" "${DISPLAY_NAME}" "$agent" >> "$SUMMARY_FILE"
    fi
    FAILED=1 
  }
}

for agent in $AGENTS_TO_RUN; do
  run_agent "$agent"
done

# Mirror the newly uploaded suites to the public dashboard. Only from a clean
# `main` checkout that matches origin/main: a --local run, a feature branch, or
# local edits would push a local allowlist and scrubber to the live site.
publish_public_evals() {
  if [ "$RUN_LOCAL" = "true" ] || [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ] || [ -n "$(git status --porcelain)" ] || [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main 2>/dev/null)" ]; then
    printf "Public evals not published: requires a clean main checkout synced with origin/main without --local.\n\n" >> "$SUMMARY_FILE"
    return
  fi
  local out status=0
  out=$(timeout 30m pnpm public:publish 2>&1) || status=$?
  printf '%s\n' "$out"
  local summary
  summary=$(printf '%s\n' "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -Ev '^(skipped|FAILED| ) ' || true)
  if [ "$status" -eq 0 ]; then
    printf "Public evals published.\n%s\n\n" "$(echo "$summary" | tail -2)" >> "$SUMMARY_FILE"
  else
    printf "Public evals publish FAILED (exit %s).\n%s\n\n" "$status" "$(echo "$summary" | tail -10)" >> "$SUMMARY_FILE"
    FAILED=1
  fi
}
publish_public_evals

echo "Guidance ${PREFIX} run completed."
if [ "$FAILED" -ne 0 ]; then
  exit 1
fi
