#!/bin/bash
set -euo pipefail

usage() {
  cat << EOF
Usage: $0 [OPTIONS]
Runs the nightly evaluation for the specified agent.

Options:
  --help        Show this help message and exit.
  --agent       The agent to run (required).
                Valid agents: jetski_cli, claude_code, codex_cli
  --workers     The number of concurrent workers to use (optional).

Examples:
  $0 --agent jetski_cli
  $0 --agent jetski_cli --workers 10
EOF
}

# Parse flags
AGENT=""
WORKERS=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --agent)
      if [[ -z "${2:-}" ]]; then echo "Error: --agent requires an argument"; exit 1; fi
      AGENT="$2"
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

if [[ -z "$AGENT" ]]; then
  echo "❌ Error: --agent is required."
  usage
  exit 1
fi

USER_LDAP=$(whoami)
# AGENT is already set above

# Initialization & State Reset
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || { echo "Failed to locate repo root"; exit 1; }

INITIAL_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo '')"
INITIAL_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

# Setup variables
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
SUITE_ID="nightly-${TIMESTAMP}-${AGENT}-${USER_LDAP}"
DASHBOARD_URL="http://go/guidance-evals/dashboard.html?testId=${SUITE_ID}&source=remote"
EVAL_EXIT_CODE=0
FAIL_REASON=""
UPLOAD_EXIT_CODE=0
EVAL_RAN=false
STAGE="Initialization"

# 1. Idempotent State Resolution (Trap)
# This guarantees that the repo is left clean regardless of success or failure.
cleanup() {
  local exit_code=$?
  set +e
  local CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  
  if [ -n "${TEMP_CONFIG_FILE:-}" ] && [ -f "$TEMP_CONFIG_FILE" ]; then
    rm -f "$TEMP_CONFIG_FILE"
  fi

  if [ "$CURRENT_BRANCH" = "$SUITE_ID" ]; then
    echo "Running cleanup: ensuring all changes are committed to leave a clean working directory."
    git add -A
    git commit -m "chore: final state of nightly workflow ${SUITE_ID}" || true
  fi

  if [ -n "$INITIAL_BRANCH" ] && [ "$INITIAL_BRANCH" != "HEAD" ]; then
    git checkout "$INITIAL_BRANCH" || true
  elif [ -n "$INITIAL_COMMIT" ]; then
    git checkout "$INITIAL_COMMIT" || true
  fi

  local body
  if [ "$exit_code" -eq 0 ]; then
    echo "Run completed successfully. Deleting isolation branch ${SUITE_ID}..."
    git branch -D "$SUITE_ID" || true

    body="✅ Nightly run for agent ${AGENT} completed successfully.\nSuite ID: ${SUITE_ID}\n\nResults have been uploaded to the dashboard: ${DASHBOARD_URL}"
  else
    body="❌ Nightly run for agent ${AGENT} failed unexpectedly with exit code ${exit_code}. Last stage: ${STAGE}.\nSuite ID: ${SUITE_ID}\n"
    if [ "$EVAL_EXIT_CODE" -ne 0 ]; then
      body="${body}\n\nEvaluation step (gd eval) failed with exit code ${EVAL_EXIT_CODE}."
    fi
    if [ -n "$FAIL_REASON" ]; then
      body="${body}\n\nReason: ${FAIL_REASON}"
    fi
  fi

  if [ "$EVAL_RAN" = "true" ]; then
    body="${body}\n\nLocal results path: ${REPO_ROOT}/harness/results/${SUITE_ID}"
  fi

  if [ "${NIGHTLY_GUIDANCE_RUN:-0}" = "1" ]; then
    printf "%b\n\n----------------------------------------\n\n" "$body" >> "${SUMMARY_FILE:-$SCRIPT_DIR/nightly_summary.txt}"
  else
    printf "\n=== STANDALONE RUN SUMMARY ===\n%b\n==============================\n\n" "$body"
  fi
}
trap cleanup EXIT

STAGE="Pre-flight Check"
# 2. Strict Pre-flight Check (Fail Fast)
if [ -n "$(git status --porcelain)" ]; then
  FAIL_REASON="Uncommitted changes detected. Please commit or stash your work before running this workflow."
  echo "Error: $FAIL_REASON"
  exit 1
fi

STAGE="Branch Isolation"
# 3. Branch Isolation (Bypass Local main)
git fetch origin
git checkout -B "$SUITE_ID" origin/main

STAGE="Setup Dependencies"
# Install dependencies and setup Playwright
pnpm install
pnpm setup:playwright

STAGE="Configuration Setup"
# Update Configuration
case "$AGENT" in
  "jetski_cli") AGENT_ENUM="JETSKI_CLI" ;;
  "claude_code") AGENT_ENUM="CLAUDE_CODE" ;;
  "codex_cli")  AGENT_ENUM="CODEX_CLI" ;;
  *) echo "Unknown agent: $AGENT"; exit 1 ;;
esac

TEMP_CONFIG_FILE="nightly_config_${SUITE_ID}.ts"
cp config.ts.example "$TEMP_CONFIG_FILE"

# Append direct object mutations to override the defaults safely
cat <<EOF >> "$TEMP_CONFIG_FILE"

// Nightly Run Overrides
customConfig.agent = Agents.$AGENT_ENUM;
customConfig.name = "$SUITE_ID";
delete customConfig.tasks;
EOF

if [ -n "$WORKERS" ]; then
  echo "customConfig.workerCount = $WORKERS;" >> "$TEMP_CONFIG_FILE"
fi

STAGE="Evaluation"
# Execute Evaluation
set +e
EVAL_RAN=true
pnpm exec gd eval --config "$TEMP_CONFIG_FILE"
EVAL_EXIT_CODE=$?
set -euo pipefail

if [ "$EVAL_EXIT_CODE" -ne 0 ]; then
  echo "Evaluation completed with failures (exit code ${EVAL_EXIT_CODE}). Skipping upload step."
  FAIL_REASON="Evaluation failed (exit code ${EVAL_EXIT_CODE}). Upload skipped."
  exit $EVAL_EXIT_CODE
fi

STAGE="Upload Results"
# Upload Results
set +e
pnpm exec gd upload "$SUITE_ID"
UPLOAD_EXIT_CODE=$?
set -euo pipefail

# Fail the script if upload failed
if [ "$UPLOAD_EXIT_CODE" -gt 0 ]; then
  FAIL_REASON="Evaluation succeeded, but uploading results to the dashboard failed."
  exit "$UPLOAD_EXIT_CODE"
fi

exit 0