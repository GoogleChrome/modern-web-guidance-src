# Evaluation Harness & Stage 3 Testing

This directory contains the prompt benchmarking harness, base applications, agent runners, and evaluation orchestration tools for Modern Web Guidance.


## Overview

The evaluation harness measures how effectively AI coding agents adopt modern web platform guidance. It executes real-world coding benchmarks across supported agent runners and verifies output against Playwright test assertions (`grader.ts`).

Supported agents and canonical configurations are defined in [`src/harness/config.ts`](./config.ts). For agent installation, authentication, and `.env` configuration (Antigravity CLI, Jetski CLI, Gemini CLI, Claude Code, Codex CLI), see **[`docs/EVALS.md`](../../docs/EVALS.md)**.


## Stage 3 Guide Development: `gd dev`

Once `guide.md`, `demo.html`, and `expectations.md` are authored, use `gd dev` to automatically generate evaluation capsules, calibrate graders, and run evaluations:

```bash
# Full auto-generation, calibration, and evaluation run:
gd dev guides/<category>/<use-case-slug>

# Verify grader calibration only (100% pass on golden patches, 0% on zero-passrate baseline):
gd dev guides/<category>/<use-case-slug> --test-grader

# Skip evaluation and report generation after calibration:
gd dev guides/<category>/<use-case-slug> --no-test

# Run against only specific base applications (comma-separated):
gd dev guides/<category>/<use-case-slug> --targets daily-grind
```

### The 5-Step `gd dev` Pipeline:
1. **Solutions Generation**: Generates golden solution patches and zero-passrate baseline patches across target base applications (`daily-grind`, `devtools-times`).
2. **Grader Generation**: Generates Playwright test assertions in `grader.ts` based on `expectations.md`.
3. **Grader Calibration**: Calibrates the grader (ensures golden patches pass 100% and zero-passrate baseline fails 100%).
4. **Agent Evaluations**: Executes guided and unguided agent runs against target apps to measure pass rates and guidance tool usage.
5. **Evaluation Report (`report.md`)**: Invokes an evaluator agent to analyze failed assertions and output recommendations into `results/guides/<category>/<slug>/report.md`.

When run from `main`, `gd dev` first switches to a new `gd-dev/<guide-name>` branch and commits the generated artifacts and any post-report fixes as separate commits.

### Submitting a Pull Request: `gd pr`

Once `gd dev` completes and generates `results/guides/<category>/<slug>/report.md`, create a Pull Request directly from your terminal:

```bash
gd pr guides/<category>/<use-case-slug>
```

This automatically creates/switches to a `gd-dev/<guide-name>` branch, commits and pushes changes for the target guide directory, labels the PR (`gd-dev-content` and/or `gd-dev-eval`), and opens a new PR (or updates the existing PR description and syncs labels, removing `needs-dev-rerun`) with `report.md` as the description. It refuses to push a branch that still contains the commits of an already merged or closed PR; switch to a new branch off `main` instead.

### Fixing Missing Evals: `gd dev-gap`

`gd dev-gap` scans `guides/` on disk for non-draft guides that have populated `guide.md` and `expectations.md` but are missing evals (`grader.ts` or `task.md`, in legacy format or `targets/`), then runs `gd dev` (defaulting to `--targets daily-grind`) and `gd pr` for each guide in turn from a clean `main`. It also reruns open `gd pr` PRs labeled `needs-dev-rerun`:

```bash
gd dev-gap --dry-run                            # show which guides/PRs would run and why any are skipped
gd dev-gap --limit 1                            # process at most one guide
gd dev-gap --targets daily-grind,devtools-times # override target base apps (defaults to daily-grind)
gd dev-gap                                      # process all of them
```

It skips guides that already have an open `grader updates: <guide-name>` PR (unless labeled `needs-dev-rerun`) and guides whose `gd-dev/<guide-name>` branch still exists locally or on `origin` without an open PR (delete the branch to retry).

When an evaluation report in a PR is unhealthy, `gd dev` applies recommended fixes directly to the files in the PR (committed as a separate post-report commit from the initial target generation). Reviewers can inspect the file diffs in the PR, leave inline comments or push adjustments, and trigger the next automated pass by labeling the PR **`needs-dev-rerun`**. `gd dev` regenerates whatever changed since the solution patches were generated (`guide.md` or `expectations.md` wipes `targets/<target>/` and regenerates everything; `task.md` regenerates the solution patches and `grader.ts`; `grader.ts` alone re-runs calibration and agent evaluation).

### Pipeline Tracking

`src/ci/sync-pipeline-issue.ts` maintains the canonical [Content & Eval Pipeline issue (#1815)](https://github.com/GoogleChrome/modern-web-guidance-src/issues/1815), including flagging guides under **Stale evals** whenever `expectations.md` has substantive changes newer than `grader.ts` or `targets/`.

* **Normative Specification & Rules**: See [`.agents/skills/project-evals/SKILL.md`](../../.agents/skills/project-evals/SKILL.md).


## Running Multi-Agent Benchmarks: `gd eval`

Run prompt benchmarking matrices across agents and serving modes:

```bash
# Run evaluations across default configuration:
gd eval

# Run with custom configuration override:
gd eval --config custom_config.ts

# Run with Pi agent:
gd eval --config src/harness/config-pi.ts <task-name>

# Run multiple specific tasks:
gd eval task1 task2 task3
```

### Configuration Profiles:
To override suite parameters without modifying `src/harness/config.ts` directly, copy the example template from the **repository root**:
```bash
# From the repository root:
cp config.ts.example config.ts

# Pass custom config to gd eval:
gd eval --config config.ts
```


## Evaluation Results Dashboard

Inspect benchmark results, pass rate deltas, tool retrieval transcripts, and failed test assertions via the local dashboard:

```bash
gd dashboard
```

---

## Agent Harness Internal Architecture

This section covers the internal architecture of the evaluation harness agent runners for engineers adding new agents or debugging runner behavior.

### Directory Structure

```
src/harness/
  agents/                    # Agent-specific runners
    antigravity-cli-agent.ts
    gemini-cli-agent.ts
    claude-code-agent.ts
    codex-cli-agent.ts
    jetski-cli-agent.ts
    pi-agent.ts
  base-apps/                 # Base applications that agents modify
    daily-grind/
    devtools-times/
  lib/
    agent-shared.ts          # Common utilities (isolation, skills setup, etc.)
    collection.ts            # Results aggregation
    guide-usage.ts           # Guide/tool usage extraction
    sandbox.ts               # Filesystem isolation sandbox
    trajectory-normalizer.ts # Unified trajectory_summary.json generation
  nightly/                   # Nightly cron automation scripts
  config.ts                  # Suite configuration
  run-suite.ts               # Orchestrator
  evaluate.ts                # Evaluation reporting
```

### Execution Flow

```
┌─────────────────┐
│  run-suite.ts   │  (orchestrator)
└────────┬────────┘
         │ spawns
         ▼
┌─────────────────┐
│ *-agent.ts      │  (agent runner)
│  setupIsolated  │
│  WorkDir()      │
└────────┬────────┘
         │ creates
         ▼
┌─────────────────┐
│ /tmp/ghh-<rand> │  (isolated HOME)
│ ├── .gemini/    │  (agent-specific config)
│ ├── .pi/        │
│ └── .claude/    │
└────────┬────────┘
         │ executes
         ▼
┌─────────────────┐
│ CLI binary      │
│ (pi/gemini/etc) │
└────────┬────────┘
         │ writes
         ▼
┌─────────────────┐
│ trajectory      │  (JSON/JSONL/PB)
│ chat_log.txt    │
│ generation_     │
│ failed.json     │
└─────────────────┘
```

### Model Configuration

The harness does **not** centrally hardcode which model each agent uses. Instead, each agent runner reads the model from environment variables:

| Agent | Environment Variable | Example Value | Notes |
|-------|---------------------|---------------|-------|
| **Antigravity CLI** | `ANTIGRAVITY_MODEL` | `gemini-3.8-flash-medium` | Passed via `--model` to `agy` |
| **Jetski CLI** | `JETSKI_MODEL` | `Gemini 3.8 Flash (Medium)` | Read directly by Jetski CLI |
| **Gemini CLI** | `GEMINI_MODEL` | `gemini-3-flash-preview` | Read directly by Gemini CLI |
| **Pi** | `PI_MODEL` or `PROMPT_MODEL` | `anthropic/claude-sonnet` | `PROMPT_MODEL` is fallback |
| **Codex CLI** | `CODEX_MODEL` | `gpt-5.5` | Read directly by Codex CLI |
| **Claude Code** | `ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250929` | Via Vertex AI config |

#### Fallback Behavior
If no model env var is set:
- **Antigravity CLI**: Uses `agy`'s default model (override with `ANTIGRAVITY_MODEL`)
- **Jetski CLI**: Uses default model from Jetski config
- **Gemini CLI**: Uses the model from `~/.gemini/settings.json` or prompts
- **Codex CLI**: Uses default model (configurable via `codex settings`)
- **Claude Code**: Uses model from Vertex AI project config
- **Pi**: Uses the model from `~/.pi/agent/settings.json` (`defaultModel`)

#### Token Efficiency Tips
For development testing, use cheaper/faster models:
```bash
# Fast model for smoke tests
PI_MODEL=qwen/qwen3.5-plus node src/harness/quick-smoke.ts pi

# Use expensive model only for final evals
PI_MODEL=anthropic/claude-opus GD_SUITE_CONFIG='...' node src/harness/run-suite.ts
```

---

## Key Design Patterns

### 1. Isolated HOME Directory

Each test run gets a fresh temporary directory as `HOME` to prevent:
- Cross-test contamination
- Auth credential leakage between runs
- Config file race conditions
- Shell profile interference

```typescript
// src/harness/lib/agent-shared.ts
export function createIsolatedHome(prefix: string, targetDir?: string): string {
  const tempHome = `/tmp/${prefix}-${Math.random().toString(36).substring(7)}`;
  fs.mkdirSync(tempHome, { recursive: true });
  
  // Copy .npmrc for auth in isolated env
  copyFileIfExists(
    path.join(os.homedir(), '.npmrc'),
    path.join(tempHome, '.npmrc')
  );
  
  // Setup shell profiles to maintain PATH
  setupIsolatedShellProfiles(tempHome, targetDir);
  
  return tempHome;
}
```

> **Why `/tmp/` instead of `os.tmpdir()`?**
> On macOS, `os.tmpdir()` can return paths that are too long for Unix socket paths, causing issues for some agents (JetSki/VS Code components).

### 2. Auth Credential Copying

Each agent has different auth file locations copied to the isolated environment:

| Agent | Auth Files | Location |
|-------|-----------|----------|
| Gemini CLI | `oauth_creds.json`, `google_accounts.json`, `installation_id` | `~/.gemini/` |
| Pi | `auth.json`, `settings.json`, `trust.json` | `~/.pi/agent/` |
| Claude Code | GCP credentials via env | `gcloud` config |
| Codex CLI | OAuth via login flow | `~/.codex/` |
| Jetski CLI | `installation_id`, `user_settings.pb`; on macOS the OAuth token lives in the login Keychain, so `~/Library/Keychains` is symlinked into the isolated HOME | `~/.gemini/jetski/` |
| Antigravity CLI | `settings.json`, `antigravity-oauth-token` (Linux) or Keychain symlink (macOS) | `~/.gemini/antigravity-cli/` |

Example for Pi:
```typescript
// src/harness/agents/pi-agent.ts
const piDestAgent = path.join(tempHome, '.pi', 'agent');
fs.mkdirSync(piDestAgent, { recursive: true });

copyFileIfExists(
  path.join(os.homedir(), '.pi', 'agent', 'auth.json'),
  path.join(piDestAgent, 'auth.json')
);
```

### 3. Skills Configuration

Guided runs inject `modern-web-guidance` via the Skills CLI distribution:

```typescript
copySkills(tempHome, Agents.PI, skillsToEnable);
```

### 4. Trajectory Capture

Each agent outputs trajectories in distinct formats:

| Agent | Format | Location | Parser |
|-------|--------|----------|--------|
| Gemini CLI | JSON/JSONL | `.gemini/tmp/*/chats/*.json` | `JSON.parse()` |
| Pi | JSONL | `.pi/agent/sessions/*.jsonl` | Line-by-line JSON |
| Claude Code | JSON | `~/.claude/projects/*/sessions/` | `JSON.parse()` |
| Codex CLI | TOML config + JSONL | `~/.codex/` | Custom parser |
| Jetski CLI | Protocol Buffers / SQLite | `.gemini/jetski/conversations/*` | `parseJetskiCliSession` |
| Antigravity CLI | SQLite | `.gemini/antigravity-cli/conversations/*.db` | `parseJetskiCliSession` |

Each agent runner colocates a trajectory parser (`parse<Agent>Trajectory` and `load<Agent>Logs`) and calls `generateNormalizedTrajectory(targetDir, Agents.<AGENT>, userPrompt)` in its `finally` block to write a unified `trajectory_summary.json` in `targetDir`:

```typescript
// src/harness/agents/pi-agent.ts
exportPiTrajectories(workDir, targetDir);
await generateNormalizedTrajectory(targetDir, Agents.PI, userPrompt);
```

`src/harness/lib/collection.ts` and `src/harness/lib/guide-usage.ts` read `trajectory_summary.json` via `ensureFreshTrajectorySummarySync(runDir)` to extract the model identifier, token usage (`total` and `cached`), tool calls, and retrieved/read guides uniformly across all agents.

### 5. Guide Usage Tracking

The harness tracks which guides the agent retrieved or read:

```typescript
// src/harness/lib/guide-usage.ts
export async function collectGuidesUsed(
  dirPath: string
): Promise<GuideUsage> {
  // Reads from trajectory_summary.json
}
```

This scans trajectories for:
- `get_best_practices` tool calls with `use_case_id`
- `read_file` calls to paths containing `/skills/` or `guide.md`
- Shell commands with `--retrieve` flags

### 6. Failure Handling

Agents can fail at multiple stages. The harness captures failures for grading:

```typescript
// src/harness/lib/agent-shared.ts
if (exitCode !== 0) {
  fs.writeFileSync(
    path.join(targetDir, 'generation_failed.json'),
    JSON.stringify({
      agentName,
      exitCode,
      stderr,
      stdout
    }, null, 2)
  );
}
```

The grader reads this to distinguish:
- **Early failures**: Agent crashed, no output generated
- **Grader failures**: Agent generated code, but tests failed

### 7. Filesystem Sandbox

An isolated HOME alone doesn't stop an agent from finding this repo (e.g. via `$PATH` or `find /`) and reading `guides/`, `expectations.md` and `grader.ts`. `runCliAgentCommand()` therefore wraps every agent in an OS-level sandbox (`src/harness/lib/sandbox.ts`) that hides the repo root:

- **Linux**: `bwrap` (bubblewrap) mounts an empty tmpfs over the repo root. Requires `sudo apt install bubblewrap`.
- **macOS**: `sandbox-exec` denies file access under the repo root.

Only these paths are re-exposed:

| Path | Access | Why |
|------|--------|-----|
| `node_modules` | read-only | Agent CLI binaries |
| `dist/skills-cli` | read-only, guided only | The npx/pnpx shim runs the local skills CLI |
| isolated `HOME` (`/tmp/ghh-*`) | writable | Agent workspace, `.gd-bin` npx/pnpx/pnpm shims, and `modern-web.log` |

If no sandbox tool is available the run fails loudly. Set `GD_UNSAFE_NO_SANDBOX=1` to bypass for local debugging only. If an agent hits `EPERM`/`Operation not permitted` on a repo path the harness legitimately needs, add it to `buildSandboxPolicy()` rather than disabling the sandbox.

---

## Adding a New Agent Runner

### Step 1: Create Agent Harness

Copy an existing harness (e.g., `src/harness/agents/pi-agent.ts`) and create `src/harness/agents/<agent>-agent.ts`:

```typescript
// src/harness/agents/my-agent.ts
import config, { Agents } from '../config.ts';
import {
  cleanupIsolatedHome,
  copyFileIfExists,
  parseAgentArgs,
  runCliAgentCommand,
  setupIsolatedWorkDir,
} from '../lib/agent-shared.ts';
import {
  type TrajectorySummary,
  generateNormalizedTrajectory,
} from '../lib/trajectory-normalizer.ts';

export function setupMyAgentCredentials(tempHome: string): void {
  const agentDest = path.join(tempHome, '.my-agent');
  fs.mkdirSync(agentDest, { recursive: true });
  copyFileIfExists(
    path.join(os.homedir(), '.my-agent', 'config.json'),
    path.join(agentDest, 'config.json')
  );
  process.env.MY_AGENT_CONFIG_DIR = agentDest;
}

export function getMyAgentCommandAndArgs(prompt: string): { command: string; commandArgs: string[] } {
  const command = config.environment.myAgentBin || 'my-agent';
  return { command, commandArgs: ['-p', prompt] };
}

async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('my-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.MY_AGENT, templateDir, runType);

  try {
    const { command, commandArgs } = getMyAgentCommandAndArgs(userPrompt);
    try {
      await runCliAgentCommand(command, commandArgs, workDir, targetDir, 'My Agent', runType);
    } finally {
      exportMyAgentTrajectories(workDir, targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.MY_AGENT, userPrompt);
    }
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export function loadMyAgentLogs(dir: string) {
  // Load raw session logs from dir
}

export function parseMyAgentTrajectory(logData: any[]): TrajectorySummary {
  // Normalize steps, model, tokenUsage, toolsUsed, retrievedGuides, and fileReadGuides
}
```

### Step 2: Update Config

```typescript
// src/harness/config.ts
export const Agents = {
  // ... existing agents
  MY_AGENT: 'my_agent'
} as const;

export const environmentConfig: EnvironmentConfig = {
  // ... existing config
  myAgentBin: process.env.MY_AGENT_BIN || 'my-agent',
};

export interface EnvironmentConfig {
  // ... existing fields
  myAgentBin: string;
}
```

### Step 3: Wire Up Integrations

1. **`src/harness/lib/agent-shared.ts`** - Register `setupMyAgentCredentials` in `setupAgentCredentials()` and `getMyAgentCommandAndArgs` in `getAgentCommandAndArgs()`.
2. **`src/harness/lib/trajectory-normalizer.ts`** - Register `loadMyAgentLogs` and `parseMyAgentTrajectory` in `detectAgentForRun()` and `generateNormalizedTrajectorySync()`. (`lib/collection.ts` and `lib/guide-usage.ts` automatically read the resulting `trajectory_summary.json`).
3. **`src/harness/run-suite.ts`** - Map the agent enum to its script in `AGENT_SCRIPTS`:
   ```typescript
   const AGENT_SCRIPTS: Record<string, string> = {
     // ... other agents
     [Agents.MY_AGENT]: 'my-agent.ts',
   };
   ```

### Step 4: Add Smoke Test

Register the agent in `AGENT_CONFIGS` in `src/harness/quick-smoke.ts` and run a smoke test:
```bash
# Usage: node src/harness/quick-smoke.ts [agent] [guided|unguided]
node src/harness/quick-smoke.ts my-agent unguided
node src/harness/quick-smoke.ts gemini-cli guided
node src/harness/quick-smoke.ts # defaults to pi

# Or via environment variable
SMOKE_AGENT=claude-code node src/harness/quick-smoke.ts
```

---

## Common Pitfalls

### 1. PATH Interference
Agents may invoke login shells that reset PATH via `/usr/libexec/path_helper`. The harness creates shell profiles in the isolated HOME to maintain PATH:
```typescript
setupIsolatedShellProfiles(tempHome, targetDir);
```

### 2. Concurrent Writes
Multiple parallel runs may write to the same config files (e.g., `projects.json`). Pre-populate these files in `createIsolatedHome()`:
```typescript
const mockProjects = { projects: { [workDir]: 'work' } };
fs.writeFileSync(path.join(geminiDir, 'projects.json'), JSON.stringify(mockProjects));
```

### 3. Unix Socket Path Limits
On macOS, Unix socket paths have a ~100 character limit. Use `/tmp/` directly instead of `os.tmpdir()` for isolated HOME directories.

### 4. Trajectory Parsing
Different agents use different trajectory formats. Always handle:
- Missing files (graceful degradation)
- Parse errors (skip malformed entries)
- Multiple files per session (aggregate)

```typescript
try {
  const content = fs.readFileSync(sessionPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      // Process message
    } catch {
      // Skip malformed line
    }
  }
} catch {
  // Return empty/default if file unreadable
}
```

---

## Debugging & Diagnostics

### Check Isolated HOME Contents
```bash
# Temporarily disable cleanup to inspect isolated HOME:
console.log(`DEBUG: Isolated HOME at ${tempHome}`);
// Comment out: cleanupIsolatedHome(path.dirname(workDir));
```

### Inspect Trajectory Files
```bash
# Gemini CLI
cat /tmp/ghh-gemini-*/.gemini/tmp/*/chats/*.json | jq '.'

# Pi
cat /tmp/ghh-pi-*/.pi/agent/sessions/*.jsonl | jq '.'

# Check what guides were retrieved
grep -o '"use_case_id":"[^"]*"' trajectory.jsonl
```

### Test the Skills CLI Independently
```bash
# Run the skills CLI directly to verify it works
node src/cli/modern-web.ts search "address form"
```

### Check Guide Validation
```bash
# Verify guides are "eval-ready" before running suite
node src/core/guide-validation.ts
```

---

## Harness Testing & Smoke Tests

### Quick Smoke Test
Use the agent-agnostic smoke test for fast validation:

```bash
# Test Pi (default)
node src/harness/quick-smoke.ts

# Test specific agent
node src/harness/quick-smoke.ts <agent> [guided|unguided]

# Available agents: antigravity-cli, jetski-cli, gemini-cli, claude-code, codex-cli, pi
node src/harness/quick-smoke.ts pi unguided
node src/harness/quick-smoke.ts gemini-cli guided

# Or via environment
export SMOKE_AGENT=pi
node src/harness/quick-smoke.ts
```

### Custom Smoke Tests
For agent-specific validation logic, create `src/harness/<agent>-smoke.ts`:

```typescript
// src/harness/my-agent-smoke.ts
import { spawnSync } from 'child_process';

export async function runMyAgentSmokeTest() {
  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agent-smoke-test-'));
  const prompt = "Please create a file named 'hello.txt' containing exactly 'hello world'.";
  
  const suiteConfig = {
    name: 'smoke-test',
    numRuns: 1,
    tasks: [],
    skillsToEnable: [],
    agent: 'my_agent'
  };
  
  const result = spawnSync('node', [
    path.join(import.meta.dirname, 'agents/my-agent.ts'),
    prompt,
    'unguided',
    tempProjectDir,
    tempProjectDir
  ], {
    stdio: 'inherit',
    env: { ...process.env, GD_SUITE_CONFIG: JSON.stringify(suiteConfig) }
  });

  if (result.status !== 0) {
    console.error('❌ Agent harness failed to execute.');
    process.exit(1);
  }
}
```

### Testing the Pi Agent Harness

#### Unit Tests
Run the Pi trajectory parsing unit tests:
```bash
node --test src/harness/agents/pi-agent.test.ts
```

#### Manual Trajectory Inspection
```bash
# Run full eval suite with Pi (sessions enabled by default)
GD_SUITE_CONFIG='{"agent":"pi"}' \
  node src/harness/run-suite.ts <task>

# Sessions are saved to the isolated HOME, then exported to results dir
# Inspect the JSONL format
cat results/suites/<suite>/<run>/<task>/guided/*.jsonl | head -100
```

## Diagnosing Performance Variance with `gd compare`

The `gd compare` command compares two evaluation run directories to diagnose behavioral differences and performance variance between agent runs:

```bash
# Compare two local run directories
gd compare results/<suite-a>/<run-1>/<guide>/<task>/<run-type> results/<suite-b>/<run-2>/<guide>/<task>/<run-type>

# Example: Compare guided vs unguided runs
gd compare results/nightly-2026-08-10_17-00-02-jetski_cli/1/details-styling/task/guided results/nightly-2026-08-10_17-00-02-jetski_cli/1/details-styling/task/unguided

# Compare runs from remote GCS suites (automatically downloaded and cached locally)
gd compare nightly-2026-08-10_17-00-02-jetski_cli/1/details-styling/task/guided nightly-2026-08-11_17-00-02-jetski_cli/1/details-styling/task/guided
```

### Path Formats
Run directory paths can be:
- **Local repository paths**: Paths relative to repo root (e.g. `results/<suite-name>/<run-number>/<guide-name>/<task-name>/<run-type>`).
- **Results-relative or remote suite paths**: Paths relative to `results/` (e.g. `<suite-name>/<run-number>/<guide-name>/<task-name>/<run-type>`).
- **Remote GCS buckets**: If the specified run directory is not found locally, `gd compare` automatically downloads the run artifacts from Google Cloud Storage (`gs://guidance-evals/<suite-path>`) before launching analysis.

### Analysis Pipeline
The comparison runs in four steps:
1. **Loads both runs.** Missing runs are downloaded from GCS. If a `trajectory_summary.json` is missing or from an older normalizer version, it's rebuilt from the raw session logs.
2. **Pre-processes trajectories** into tagged milestone steps (skill search, guide retrieval, code mutation, noise) and counts error/retry loops.
3. **Runs one diagnostic prompt** with the configured solution agent CLI in an isolated temp workspace. The full guide, grader, diffs and trajectories are staged there as files. The agent may split the guide-compliance and code/friction audits across its own subagents.
4. **Writes a four-section markdown report** to `<Run A suite>/variance_diagnoses/<guide>-<task>-<runA>-vs-<runB>.md`. If Run A isn't in a recognizable suite folder, it falls back to Run B's suite, then to `results/variance_diagnoses/`.

---

## Related Documentation

- [`docs/EVALS.md`](../../docs/EVALS.md) - Agent configuration and environment setup
- [`docs/eval-results.md`](../../docs/eval-results.md) - Results storage and GCS upload
- [`docs/CONTEXT.md`](../../docs/CONTEXT.md) - High-level architecture
- [`agent-shared.ts`](./lib/agent-shared.ts) - Shared utility functions
