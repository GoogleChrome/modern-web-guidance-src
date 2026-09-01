# Evaluation Harness & Stage 3 Testing

This directory contains the prompt benchmarking harness, base applications, agent runners, and evaluation orchestration tools for Modern Web Guidance.


## Overview

The evaluation harness measures how effectively AI coding agents adopt modern web platform guidance. It executes real-world coding benchmarks across supported agent runners and verifies output against Playwright test assertions (`grader.ts`).

Supported agents and canonical configurations are defined in [`harness/config.ts`](./config.ts).


## Agent Configuration & Setup

Configure API keys and environment variables in a `.env` file at the repository root:

### 1. Antigravity / Jetski
Antigravity (`jetski_cli`) is the default agent used by guide development workflows (`gd dev`).
```bash
JETSKI_MODEL='gemini-3.6-flash'
```

### 2. Gemini CLI
Gemini CLI (`gemini_cli`) is supported for evaluation harness runs and can be used in `gd dev` via `GD_DEV_USE_GEMINI`:
```bash
GEMINI_API_KEY='your_api_key_here'
GEMINI_MODEL='gemini-3-flash-preview'
GD_DEV_USE_GEMINI=1  # Required to use Gemini CLI for 'gd dev'
```

### 3. Claude Code (Vertex AI)
Implemented via [Claude Code on Vertex AI](https://code.claude.com/docs/en/google-vertex-ai):
```bash
gcloud config set project <YOUR-GCP-PROJECT-ID>

# Set in your .env:
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global
ANTHROPIC_VERTEX_PROJECT_ID=<YOUR-GCP-PROJECT-ID>
ANTHROPIC_MODEL=<enabled-model-in-vertex>
```

### 4. Codex CLI
```bash
CODEX_MODEL='gpt-5.5'
```

### 5. Pi
```bash
PI_MODEL='anthropic/claude-sonnet'
```


## Stage 3 Guide Development: `gd dev`

Once `guide.md`, `demo.html`, and `expectations.md` are authored, use `gd dev` to automatically generate evaluation capsules, calibrate graders, and run evaluations:

```bash
# Full auto-generation, calibration, and evaluation run:
gd dev guides/<category>/<use-case-slug>

# Verify grader calibration only (100% pass on golden demo, 0% on negative baseline):
gd dev guides/<category>/<use-case-slug> --test-grader

# Skip evaluation and report generation after calibration:
gd dev guides/<category>/<use-case-slug> --no-test
```

### The 5-Step `gd dev` Pipeline:
1. **Solutions Generation**: Generates golden solution patches and zero-passrate baseline patches across target base applications (`daily-grind`, `devtools-times`).
2. **Grader Generation**: Generates Playwright test assertions in `grader.ts` based on `expectations.md`.
3. **Grader Calibration**: Calibrates the grader (ensures golden patches pass 100% and zero-passrate baseline fails 100%).
4. **Agent Evaluations**: Executes guided and unguided agent runs against target apps to measure pass rates and guidance tool usage.
5. **Evaluation Report (`report.md`)**: Invokes an evaluator agent to analyze failed assertions and output recommendations into `<guide_dir>/test-app-results/report.md`.

* **Normative Specification & Rules**: See [`.agents/skills/project-evals/SKILL.md`](../.agents/skills/project-evals/SKILL.md).


## Running Multi-Agent Benchmarks: `gd eval`

Run prompt benchmarking matrices across agents and serving modes:

```bash
# Run evaluations across default configuration:
gd eval

# Run with custom configuration override:
gd eval --config custom_config.ts

# Run with Pi agent:
gd eval --config harness/config-pi.ts <task-name>

# Run multiple specific tasks:
gd eval task1 task2 task3
```

### Configuration Profiles:
To override suite parameters without modifying `harness/config.ts` directly, copy the example template from the **repository root**:
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
Or start the dashboard dev server directly:
```bash
pnpm --filter eval-view dev
```

---

## Agent Harness Internal Architecture

This section covers the internal architecture of the evaluation harness agent runners for engineers adding new agents or debugging runner behavior.

### Directory Structure

```
harness/
  agents/                    # Agent-specific runners
    gemini-cli-agent.ts
    claude-code-agent.ts
    codex-cli-agent.ts
    jetski-cli-agent.ts
    pi-agent.ts
  lib/
    agent-shared.ts          # Common utilities (isolation, MCP config, etc.)
    collection.ts            # Results aggregation
    guidance_validation.ts   # Guide/tool usage extraction
  config.ts                  # Suite configuration
  run_suite.ts               # Orchestrator
  evaluate.ts                # Evaluation reporting
```

### Execution Flow

```
┌─────────────────┐
│  run_suite.ts   │  (orchestrator)
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
| **Antigravity / Jetski CLI** | `JETSKI_MODEL` | `gemini-3.6-flash` | Read directly by Jetski CLI |
| **Gemini CLI** | `GEMINI_MODEL` | `gemini-3-flash-preview` | Read directly by Gemini CLI |
| **Pi** | `PI_MODEL` or `PROMPT_MODEL` | `anthropic/claude-sonnet` | `PROMPT_MODEL` is fallback |
| **Codex CLI** | `CODEX_MODEL` | `gpt-5.5` | Read directly by Codex CLI |
| **Claude Code** | `ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250929` | Via Vertex AI config |

#### Fallback Behavior
If no model env var is set:
- **Pi**: Uses the model from `~/.pi/agent/settings.json` (`defaultModel`)
- **Gemini CLI**: Uses the model from `~/.gemini/settings.json` or prompts
- **Codex CLI**: Uses default model (configurable via `codex settings`)
- **Jetski CLI**: Uses default model from Jetski config
- **Claude Code**: Uses model from Vertex AI project config

#### Token Efficiency Tips
For development testing, use cheaper/faster models:
```bash
# Fast model for smoke tests
PI_MODEL=qwen/qwen3.5-plus node --experimental-strip-types harness/quick-smoke.ts pi

# Use expensive model only for final evals
PI_MODEL=anthropic/claude-opus GD_SUITE_CONFIG='...' node --experimental-strip-types harness/run_suite.ts
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
// harness/lib/agent-shared.ts
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

Example for Pi:
```typescript
// harness/agents/pi-agent.ts
const piDestAgent = path.join(tempHome, '.pi', 'agent');
fs.mkdirSync(piDestAgent, { recursive: true });

copyFileIfExists(
  path.join(os.homedir(), '.pi', 'agent', 'auth.json'),
  path.join(piDestAgent, 'auth.json')
);
```

### 3. Skills/MCP Configuration

Guided runs inject `modern-web-guidance` via two serving approaches:

**Skills CLI** (copies guide files):
```typescript
copySkills(tempHome, Agents.PI, true, skillsToEnable);
```

**MCP** (configures MCP server):
```typescript
updateMcpConfig(
  path.join(piDest, 'agent', 'mcp_servers.json'),
  ['modern-web-guidance'],
  config.environment.modernWebServerPath,
  config.environment.mcpApiKey,
  Agents.PI
);
```

### 4. Trajectory Capture

Each agent outputs trajectories in distinct formats:

| Agent | Format | Location | Parser |
|-------|--------|----------|--------|
| Gemini CLI | JSON/JSONL | `.gemini/tmp/*/chats/*.json` | `JSON.parse()` |
| Pi | JSONL | `.pi/agent/sessions/*.jsonl` | Line-by-line JSON |
| Claude Code | JSON | `~/.claude/projects/*/sessions/` | `JSON.parse()` |
| Codex CLI | TOML config + JSONL | `~/.codex/` | Custom parser |
| Jetski CLI | Protocol Buffers | `.gemini/jetski/conversations/*.pb` | `protobuf` lib |

Example extraction for Pi:
```typescript
// harness/agents/pi-agent.ts
export function extractPiTokenUsage(dir: string) {
  const sessionFiles = fs.globSync('*.jsonl', { cwd: dir });
  let total = 0;
  
  for (const file of sessionFiles) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const msg = JSON.parse(line);
      if (msg.usage) {
        total += msg.usage.total_tokens || 0;
      }
    }
  }
  
  return { total };
}
```

### 5. Guide Usage Tracking

The harness tracks which guides the agent retrieved or read:

```typescript
// harness/lib/guidance_validation.ts
export async function collectGuidesUsed(
  dirPath: string,
  serving: Serving,
  agent: string
): Promise<GuidedUsage> {
  if (agent === Agents.PI) {
    return collectPiGuidesFromTrajectory(dirPath, serving);
  }
  // ... other agents
}
```

This scans trajectories for:
- `get_best_practices` tool calls with `use_case_id`
- `read_file` calls to paths containing `/skills/` or `guide.md`
- Shell commands with `--retrieve` flags

### 6. Failure Handling

Agents can fail at multiple stages. The harness captures failures for grading:

```typescript
// harness/lib/agent-shared.ts
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

---

## Adding a New Agent Runner

### Step 1: Create Agent Harness

Copy an existing harness (e.g., `harness/agents/pi-agent.ts`) and create `harness/agents/<agent>-agent.ts`:

```typescript
// harness/agents/my-agent.ts
import config, { Agents, Serving } from '../config.ts';
import { ... } from '../lib/agent-shared.ts';

function setupIsolatedWorkDir(templateDir: string, runType: string, targetDir?: string): string {
  const tempHome = createIsolatedHome('ghh-my-agent', targetDir);
  const workDir = createWorkDir(templateDir, tempHome, runType);
  
  // Copy agent-specific auth/config files
  const agentDest = path.join(tempHome, '.my-agent');
  fs.mkdirSync(agentDest, { recursive: true });
  
  copyFileIfExists(
    path.join(os.homedir(), '.my-agent', 'config.json'),
    path.join(agentDest, 'config.json')
  );
  
  process.env.HOME = tempHome;
  process.env.MY_AGENT_CONFIG_DIR = agentDest;
  
  // Copy skills for guided runs
  if (runType === 'guided') {
    const suiteConfig = getSuiteConfig();
    if (suiteConfig.serving === Serving.SKILLS_CLI) {
      copySkills(tempHome, Agents.MY_AGENT, true, suiteConfig.skillsToEnable);
    }
  }
  
  return workDir;
}

async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('my-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType, targetDir);
  
  const command = config.environment.myAgentBin;
  const commandArgs = [
    '-p',        // non-interactive mode
    userPrompt
  ];
  
  await runCliAgentCommand(command, commandArgs, workDir, targetDir, 'My Agent');
  
  // Export trajectories
  const sessionsDir = path.join(path.dirname(workDir), '.my-agent', 'sessions');
  exportTrajectories(sessionsDir, '*.jsonl', targetDir);
}

export function extractMyAgentModel(resultsDir: string): string {
  // Parse trajectory files to extract model name
}

export function extractMyAgentTokenUsage(dir: string) {
  // Parse trajectory files to extract token usage
}

export function collectMyAgentToolsFromTrajectory(dir: string): string[] {
  // Parse trajectory files to extract tools used
}

export function collectMyAgentGuidesFromTrajectory(dirPath: string, serving: string) {
  // Parse trajectory files to extract guides retrieved
}

if (isMain) {
  run();
}
```

### Step 2: Update Config

```typescript
// harness/config.ts
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

**`run_suite.ts`** - Agent script mapping:
```typescript
function getAgentScript(agent: string): string {
  return path.join(harnessDir, 'agents',
    agent === Agents.MY_AGENT ? 'my-agent.ts' :
    // ... other agents
    'jetski-agent.ts'
  );
}
```

**`lib/collection.ts`** - Model and token extraction:
```typescript
import { extractMyAgentModel, extractMyAgentTokenUsage } from '../agents/my-agent.ts';

export function extractModelFromResults(resultsDir: string, agent: string): string {
  if (agent === Agents.MY_AGENT) {
    return extractMyAgentModel(resultsDir);
  }
  // ... other agents
}

export function extractTokenUsageFromResults(resultsDir: string, agent: string) {
  if (agent === Agents.MY_AGENT) {
    return extractMyAgentTokenUsage(resultsDir) ?? null;
  }
  // ... other agents
}
```

**`lib/guidance_validation.ts`** - Guide and tool usage collection:
```typescript
import { collectMyAgentGuidesFromTrajectory, collectMyAgentToolsFromTrajectory } from '../agents/my-agent.ts';

export async function collectGuidesUsed(dirPath: string, serving: Serving, agent: string) {
  if (agent === Agents.MY_AGENT) {
    return collectMyAgentGuidesFromTrajectory(dirPath, serving);
  }
  // ... other agents
}

export async function collectGuidanceToolsUsed(dir: string, serving: Serving, agent: string) {
  if (agent === Agents.MY_AGENT) {
    return collectMyAgentToolsFromTrajectory(dir);
  }
  // ... other agents
}
```

### Step 4: Add Smoke Test

The `quick-smoke.ts` script supports all registered agents:
```bash
node --experimental-strip-types quick-smoke.ts my-agent unguided
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

### 5. MCP vs Skills Mode
Not all agents support both modes. If an agent does not support MCP, document limitations:
```typescript
if (approach === Serving.MCP) {
  console.warn('Warning: MCP mode is not supported by this agent.');
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

### Test MCP Server Independently
```bash
# Run MCP server directly to verify it works
node serving/mcp-server/index.ts
```

### Check Guide Validation
```bash
# Verify guides are "eval-ready" before running suite
node --experimental-strip-types lib/guide-validation.ts
```

---

## Harness Testing & Smoke Tests

### Quick Smoke Test
Use the agent-agnostic smoke test for fast validation:

```bash
# Test Pi (default)
node --experimental-strip-types quick-smoke.ts

# Test specific agent
node --experimental-strip-types quick-smoke.ts <agent> [guided|unguided]

# Available agents: jetski, jetski-cli, gemini-cli, claude-code, codex-cli, pi
node --experimental-strip-types quick-smoke.ts pi unguided
node --experimental-strip-types quick-smoke.ts gemini-cli guided

# Or via environment
export SMOKE_AGENT=pi
node --experimental-strip-types quick-smoke.ts
```

### Custom Smoke Tests
For agent-specific validation logic, create `harness/<agent>-smoke.ts`:

```typescript
// harness/my-agent-smoke.ts
import { spawnSync } from 'child_process';

export async function runMyAgentSmokeTest() {
  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agent-smoke-test-'));
  const prompt = "Please create a file named 'hello.txt' containing exactly 'hello world'.";
  
  const suiteConfig = {
    name: 'smoke-test',
    numRuns: 1,
    tasks: [],
    mcpServersToEnable: [],
    skillsToEnable: [],
    serving: 'skills_cli',
    agent: 'my_agent'
  };
  
  const result = spawnSync('node', [
    '--experimental-strip-types',
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
cd harness
node --test --experimental-strip-types tests/pi-parsing.test.ts
```

#### Manual Trajectory Inspection
```bash
# Run with sessions enabled (not ephemeral)
PI_NO_SESSION=false GD_SUITE_CONFIG='{"agent":"pi","serving":"skills_cli"}' \
  node --experimental-strip-types harness/run_suite.ts <task>

# Sessions are saved to the isolated HOME, then exported to results dir
# Inspect the JSONL format
cat results/<suite>/<run>/<task>/guided/*.jsonl | head -100
```
