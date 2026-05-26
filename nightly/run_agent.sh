#!/bin/bash
set -euo pipefail

usage() {
  cat << EOF
Usage: $0 [OPTIONS]
Runs the evaluation for the specified agent.

Options:
  --help        Show this help message and exit.
  --agent       The agent to run (required).
                Valid agents: jetski_cli, claude_code, codex_cli
  --prefix      Specify the prefix name of this periodic run (default: "nightly").
  --local       Run using local committed repository HEAD instead of origin/main (optional).
  --workers     The number of concurrent workers to use (optional).

Examples:
  $0 --agent jetski_cli
  $0 --agent jetski_cli --prefix "weekly" --local --workers 10
EOF
}

# Parse flags
AGENT=""
WORKERS=""
PREFIX="nightly"
RUN_LOCAL="false"
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
    --prefix)
      if [[ -z "${2:-}" ]]; then echo "Error: --prefix requires an argument"; exit 1; fi
      PREFIX="$2"
      shift 2
      ;;
    --local)
      RUN_LOCAL="true"
      shift 1
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
SUITE_ID="${PREFIX}-${TIMESTAMP}-${AGENT}-${USER_LDAP}"
DASHBOARD_URL="http://go/guidance-evals/dashboard.html?testId=${SUITE_ID}&source=remote"
DISPLAY_NAME="$(echo "${PREFIX}" | sed 's/./\U&/')"
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
    git commit -m "chore: final state of ${PREFIX} workflow ${SUITE_ID}" || true
  fi

  if [ -n "$INITIAL_BRANCH" ] && [ "$INITIAL_BRANCH" != "HEAD" ]; then
    git checkout "$INITIAL_BRANCH" || true
  elif [ -n "$INITIAL_COMMIT" ]; then
    git checkout "$INITIAL_COMMIT" || true
  fi

  # Always delete the isolation branch if it exists to ensure a clean repository status
  if [ -n "${SUITE_ID:-}" ] && git show-ref --verify --quiet "refs/heads/${SUITE_ID}"; then
    echo "Deleting isolation branch ${SUITE_ID} to ensure a clean repository status..."
    git branch -D "${SUITE_ID}" || true
  fi

  # Parse evaluation data to get details
  local has_generation_errors=false
  local generation_errors_count=0
  local has_data=true

  if [ -f "${RESULTS_JSON:-}" ]; then
    has_data=$(node --experimental-strip-types "$SCRIPT_DIR/analyze_results.ts" "$RESULTS_JSON" has-data)
    generation_errors_count=$(node --experimental-strip-types "$SCRIPT_DIR/analyze_results.ts" "$RESULTS_JSON" errors-count)
    if [ "$generation_errors_count" -gt 0 ]; then
      has_generation_errors=true
    fi
  fi

  local body
  if [ "$exit_code" -eq 0 ]; then
    body="✅ ${DISPLAY_NAME} run for agent ${AGENT} completed successfully.\nSuite ID: ${SUITE_ID}\n\nResults have been uploaded to the dashboard: ${DASHBOARD_URL}"
  elif [ "$exit_code" -eq 3 ]; then
    body="❌ ${DISPLAY_NAME} run for agent ${AGENT} FAILED due to CATASTROPHIC GENERATION ERRORS. Upload skipped.\nSuite ID: ${SUITE_ID}\n"
    if [ -n "$FAIL_REASON" ]; then
      body="${body}\nReason: ${FAIL_REASON}"
    fi
  elif [ "$exit_code" -eq 2 ] || [ "$has_data" = "false" ]; then
    body="❌ ${DISPLAY_NAME} run for agent ${AGENT} completed but generated NO DATA. Upload skipped.\nSuite ID: ${SUITE_ID}\n"
    if [ -n "$FAIL_REASON" ]; then
      body="${body}\nReason: ${FAIL_REASON}"
    fi
  else
    body="❌ ${DISPLAY_NAME} run for agent ${AGENT} failed unexpectedly with exit code ${exit_code}. Last stage: ${STAGE}.\nSuite ID: ${SUITE_ID}\n"
    if [ "$EVAL_EXIT_CODE" -ne 0 ]; then
      body="${body}\n\nEvaluation step (gd eval) failed with exit code ${EVAL_EXIT_CODE}."
    fi
    if [ -n "$FAIL_REASON" ]; then
      body="${body}\n\nReason: ${FAIL_REASON}"
    fi
  fi

  # Append generation errors ONLY if results were NOT uploaded successfully (exit_code != 0)
  if [ "$exit_code" -ne 0 ] && [ -f "${RESULTS_JSON:-}" ] && [ "$has_generation_errors" = "true" ]; then
    local errors_text
    errors_text=$(node --experimental-strip-types "$SCRIPT_DIR/analyze_results.ts" "$RESULTS_JSON" text)
    body="${body}\n\n${errors_text}"
  fi

  if [ "$EVAL_RAN" = "true" ] && [ "${NIGHTLY_GUIDANCE_RUN:-0}" != "1" ]; then
    body="${body}\n\nLocal results path: ${REPO_ROOT}/harness/results/${SUITE_ID}"
  fi

  if [ "${NIGHTLY_GUIDANCE_RUN:-0}" = "1" ]; then
    printf "%b\n\n----------------------------------------\n\n" "$body" >> "${SUMMARY_FILE:-$SCRIPT_DIR/${PREFIX}_summary.txt}"
    
    # Delete the local results to save disk space in nightly runs
    if [ -d "${REPO_ROOT}/harness/results/${SUITE_ID}" ]; then
      echo "Deleting ${PREFIX} local results directory ${SUITE_ID} to save disk space..."
      rm -rf "${REPO_ROOT}/harness/results/${SUITE_ID}"
    fi
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
if [ "$RUN_LOCAL" = "true" ]; then
  echo "Isolating from local branch commit ${INITIAL_COMMIT}..."
  git checkout -B "$SUITE_ID" "$INITIAL_COMMIT"
else
  git fetch origin
  git checkout -B "$SUITE_ID" origin/main
fi

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

TEMP_CONFIG_FILE="config_${SUITE_ID}.ts"
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

# Allow non-zero exit codes if evals.json was successfully generated (meaning tests ran but had failures/low scores)
RESULTS_JSON="${REPO_ROOT}/harness/results/${SUITE_ID}/evals.json"
if [ "$EVAL_EXIT_CODE" -ne 0 ] && [ ! -f "$RESULTS_JSON" ]; then
  echo "Evaluation crashed catastrophically (exit code ${EVAL_EXIT_CODE}). Skipping upload step."
  FAIL_REASON="Evaluation crashed (exit code ${EVAL_EXIT_CODE}). Upload skipped."
  exit $EVAL_EXIT_CODE
fi

# Check if evals.json was generated and verify presence of data
if [ -f "$RESULTS_JSON" ]; then
  HAS_DATA=$(node --experimental-strip-types "$SCRIPT_DIR/analyze_results.ts" "$RESULTS_JSON" has-data)
  if [ "$HAS_DATA" = "false" ]; then
    echo "⚠️ Warning: No evaluation data was generated (0 tasks run). Skipping upload."
    FAIL_REASON="No evaluation data was generated (0 tasks run). Upload skipped."
    exit 2
  fi

  IS_CATASTROPHIC_FAILURE=$(node --experimental-strip-types "$SCRIPT_DIR/analyze_results.ts" "$RESULTS_JSON" is-catastrophic-failure)
  if [ "$IS_CATASTROPHIC_FAILURE" = "true" ]; then
    echo "❌ Error: Catastrophic generation failures (100% early failure rate). Skipping upload."
    FAIL_REASON="Catastrophic generation failures (100% early failure rate). Upload skipped."
    exit 3
  fi
else
  echo "❌ Error: evals.json was not generated."
  FAIL_REASON="evals.json was not generated. Upload skipped."
  exit 1
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