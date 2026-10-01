#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONCURRENCY="${CONCURRENCY:-4}"
MAX_TURNS="${MAX_TURNS:-2}"
CATEGORY_PARALLELISM="${CATEGORY_PARALLELISM:-3}"
EVAL_AUDITS_DIR="$ROOT_DIR/harness/results/eval-audits"
mkdir -p "$EVAL_AUDITS_DIR"

# Locate a Node.js v22.6+ binary with TypeScript stripping support for running the index builder
find_ts_node() {
  if command -v node >/dev/null 2>&1 && node --experimental-strip-types "$ROOT_DIR/bin/gd.ts" --version >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  shopt -s nullglob
  local candidates=(
    "$HOME"/.local/share/pnpm/bin/node
    "$HOME"/.local/share/pnpm/node
    "$HOME"/.local/share/pnpm/nodejs/2[2-9]*/bin/node
    "$HOME"/.nvm/versions/node/v2[2-9]*/bin/node
    "$HOME"/*/.nvm/versions/node/v2[2-9]*/bin/node
    "$HOME"/.local/share/fnm/node-versions/v2[2-9]*/installation/bin/node
    "$HOME"/.volta/tools/image/node/2[2-9]*/bin/node
  )
  shopt -u nullglob
  for c in "${candidates[@]}"; do
    if [ -x "$c" ] && "$c" --experimental-strip-types "$ROOT_DIR/bin/gd.ts" --version >/dev/null 2>&1; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

TS_NODE="$(find_ts_node)"

# Seed audit-expectations-css from our existing full CSS run if available so we don't re-run completed CSS capsules
if [ -d "$EVAL_AUDITS_DIR/audit-2026-09-23T22-12-35/items" ] && [ ! -d "$EVAL_AUDITS_DIR/audit-expectations-css/items" ]; then
  echo "♻️  Seeding audit-expectations-css from existing CSS audit run (audit-2026-09-23T22-12-35)..."
  mkdir -p "$EVAL_AUDITS_DIR/audit-expectations-css/items"
  cp -a "$EVAL_AUDITS_DIR/audit-2026-09-23T22-12-35/items/." "$EVAL_AUDITS_DIR/audit-expectations-css/items/"
fi

# Discover all subdirectories under guides/ that contain at least one expectations.md file
CATEGORIES=()
for dir in "$ROOT_DIR"/guides/*/; do
  [ -d "$dir" ] || continue
  cat_name="$(basename "$dir")"
  if compgen -G "${dir}*/expectations.md" >/dev/null || compgen -G "${dir}*/*/expectations.md" >/dev/null; then
    CATEGORIES+=("$cat_name")
  fi
done

echo "================================================================================"
echo "🚀 Running Expectations Coverage Audit across ${#CATEGORIES[@]} guide subdirectories"
echo "   Subdirectories: ${CATEGORIES[*]}"
echo "   Per-Subdirectory Concurrency: ${CONCURRENCY} | Subdirectory Parallelism: ${CATEGORY_PARALLELISM} | Max Turns: ${MAX_TURNS}"
echo "================================================================================"

run_category_audit() {
  local category="$1"
  local run_id="audit-expectations-${category}"
  local log_file="$EVAL_AUDITS_DIR/${run_id}.log"

  echo "▶️  [START] Subdirectory: guides/${category}/ (Run ID: ${run_id})"
  ./bin/gd audit-evals "${category}/*" \
    --expectations-only \
    --resume \
    --run-id "${run_id}" \
    --concurrency "${CONCURRENCY}" \
    --max-turns "${MAX_TURNS}" >"$log_file" 2>&1

  echo "✅ [DONE]  Subdirectory: guides/${category}/ -> harness/results/eval-audits/${run_id}/SUMMARY_AUDIT_EVALS.html"
  "$TS_NODE" --experimental-strip-types "$ROOT_DIR/scripts/build-multirun-expectations-index.ts" >/dev/null 2>&1 || true
}

active_jobs=0
for category in "${CATEGORIES[@]}"; do
  run_category_audit "$category" &
  active_jobs=$((active_jobs + 1))
  if [ "$active_jobs" -ge "$CATEGORY_PARALLELISM" ]; then
    wait -n || true
    active_jobs=$((active_jobs - 1))
  fi
done

wait

echo ""
echo "================================================================================"
echo "📊 Building Final Multi-Run Expectations Audit HTML Index..."
echo "================================================================================"
"$TS_NODE" --experimental-strip-types "$ROOT_DIR/scripts/build-multirun-expectations-index.ts"
