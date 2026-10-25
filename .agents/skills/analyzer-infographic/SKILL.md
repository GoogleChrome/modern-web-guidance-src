---
name: analyzer-infographic
description: Update and maintain the visual Modern Web Guidance Analyzer pipeline infographic (analyzer-pipeline-infographic.html) using collected snapshot data. Adapts the visual storytelling to highlight current breakthroughs, architectural milestones, and active bottlenecks.
---

# Analyzer Visual Pipeline Infographic Skill

This skill maintains and updates the visual Modern Web Guidance Analyzer pipeline infographic (`analyzer-pipeline-infographic.html`). It ensures leadership, contributors, and agents can immediately understand the current state of the 6-step modernization pipeline, the two-split corpus architecture, and empirical held-out precision benchmarks.

## Core Operational Invariants

1. **100% Terminology Parity with `src/analyzing/LEXICON.md`:**
   - **Canonical 6-Step Pipeline Names:**
     1. `Guide Triage` (single-shot LLM triage of catalog guides into `detectable`, `ui-recipe-multi-part`, or `skip-no-old-way`; never "Gate 0" or "Stage 0").
     2. `Guide Triage` (explicit `replaces` vs. `doesNotReplace` scope definition + 4,000-shard GitMirror screening before rule authoring; never "Brownfield Rubric" or "Legacy Pattern Spec").
     3. `Static Matcher` (deterministic AST, DOM, CSS, or `package.json` pattern scanner; never "Phase 1" or "Detector").
     4. `LLM Verifier` (runtime contextual verification filter via `keepWhen` / `dropWhen`; never "Phase 2" or "Phase 2 Filter").
     5. `Detection Eval Judge` (offline evaluation rater grading blind finding cards using 3-pass consensus; never "Detective" or "Phase 2 Judge").
     6. `Update Eval` (offline modernization simulation with bad-patch rejection; never "Milestone 4" or "Gate 1/2/3" or "Fix Smoke Test").
   - **Corpus Splits:**
     - Must strictly use the two hyphenated splits: **`rule-writing`** and **`held-out`**.
     - Never use deprecated split names (`grading-only`, `tune`, `final`, `local-93`, `gitmirror-grading-only`).
   - **Rule States:**
     - `Experimental Rule` (in `ALL_RULES`, available under `--experimental`).
     - `Qualified Rule` (in `QUALIFIED_GUIDE_IDS`, shipped by default in `npx modern-web-guidance analyze` after clearing `wilson95.lower >= 0.90` at $n \ge 35$ on held-out evaluation).
     - `Retired Guide` (candidate guides removed from ruleset due to missing 1-to-1 legacy equivalent).

2. **Strict Metric Parity with `analyzer-internal/PROGRESS.md` & Scorecards:**
   - Every number, confidence interval, and sample size displayed in the infographic must be derived directly from verified JSON artifacts in `analyzer-internal/findings/` or `infographic-snapshot.json`. Never hand-fabricate or round metrics inconsistently.

3. **Non-Invasive Data Architecture:**
   - The data collection script `analyzer-internal/scripts/collect-infographic-data.ts` reads existing JSON and Markdown artifacts in `analyzer-internal/` and `~/.cache/analyzer-gitmirror/manifest.json`. It never imports, modifies, or couples with core pipeline runtime files in `src/analyzing/`.

---

## 3-Step Execution Workflow

### Step 1: Collect Fresh Snapshot Data

Run the non-invasive data collector to refresh `analyzer-internal/findings/infographic-snapshot.json`:

```bash
node analyzer-internal/scripts/collect-infographic-data.ts
```

Read `analyzer-internal/PROGRESS.md` and `analyzer-internal/PLAN.md` to identify the most recent operational changes, newly admitted components, and current sprint goals.

### Step 2: Adaptive Visual Storytelling (Not a Rigid Template)

The infographic is a **living visual narrative, not a static schema**. Each time it is updated, adapt the visual emphasis, charts, and callouts to highlight:
- **Recent Architectural Breakthroughs:**
  - For example: How introducing **`Guide Triage`** + 4,000-shard GitMirror screen eliminated dead-on-arrival rules upfront and propelled held-out precision on `DIRECT-TOKEN / STRUCTURAL-AST` rules to **`99.2%` (242/244)** (compared to `72.0%` on pre-spec Batches 1–3).
- **Corpus Consolidation:**
  - Highlight the two unified hyphenated splits: **`rule-writing`** (`115` local repos + `7,048` GitMirror files across `5,320` repos, `MOD = 0`) and **`held-out`** (`93` local repos + `7,137` GitMirror files across `5,258` repos, `MOD = 1`).
- **Admitted Evaluation Rater:**
  - Highlight that the **`Detection Eval Judge`** (`gemini-3.8-flash:detective-v6-spec22-c3f54b90`) is officially **ADMITTED** on Paul Irish's 95 active scored calibration cards (**Gwet's $\text{AC}_1 = 0.703 \ge 0.70$**, **3-Pass Stability = `96.5%` $\ge 95\%$**, **Canary TNR = `100.0%`**).
- **Zero-API-Key Runtime Verification:**
  - Emphasize how `verifierRubric.keepWhen` and `verifierRubric.dropWhen` emitted in CLI and `--json` turn the developer's existing coding agent (Claude, Gemini, Cursor) into the runtime `LLM Verifier` at zero additional API key, quota, or latency cost.
- **Active Bottlenecks & Next Priorities:**
  - Scaling GitMirror sampling from 800 to 8,000+ shards to lift sample-constrained high-precision guides (like `responsive-table` at 33/33 100%, `autofill-address-form`, `branded-select-styling`) past the $n \ge 35$ qualification threshold.

### Step 3: Render Visual Charts & Output Artifacts

- **Visual Design Rules:**
  - Use genuine visual components: SVG/CSS funnel bars, side-by-side cohort comparison cards, forest plots with horizontal whisker bars for 95% Wilson confidence intervals, and metric gauge bars. Avoid dense, unformatted tables.
  - Maintain clean, dark-mode-first aesthetic using CSS variables compatible with Antigravity / Tailwind (`--background`, `--foreground`, `--card`, `--border`, `--muted-foreground`, `--primary`).
  - Support responsive single-column layouts (narrow max-width, ~768px–900px) that render cleanly in previews, markdown embeds, and web views.
- **Output Targets:**
  Render the complete, standalone HTML infographic to both locations:
  1. `/usr/local/google/home/paulirish/.gemini/jetski/brain/<conversation-id>/analyzer-pipeline-infographic.html`
  2. `/usr/local/google/home/paulirish/code/guidance/.worktrees/analyzer/analyzer-internal/findings/analyzer-pipeline-infographic.html`
- **Verification:**
  Verify that the HTML parses cleanly and contains zero leftover deprecated terminology (`grading-only`, `tune`, `final`, `Phase 1`, `Gate 0`).
