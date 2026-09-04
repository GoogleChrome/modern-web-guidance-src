# Agent Harness Architecture

This document covers the internal architecture of the evaluation harness agent runners. It's intended for engineers adding new agents or debugging harness behavior.

## Overview

Each agent harness (e.g., `gemini-cli-agent.ts`, `pi-agent.ts`) is a wrapper that executes a coding agent CLI in an isolated environment, captures its trajectory, and exports results for grading.

## Directory Structure

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

## Execution Flow

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
│ pi/gemini/      │
│ claude binary   │
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

## Model Configuration

The harness does **not** centrally configure which model each agent uses. Instead, each agent harness reads the model from **environment variables**.

### Environment Variables by Agent

| Agent | Environment Variable | Example Value | Notes |
|-------|---------------------|---------------|-------|
| **Gemini CLI** | `GEMINI_MODEL` | `gemini-2.5-flash` | Read directly by Gemini CLI |
| **Pi** | `PI_MODEL` or `PROMPT_MODEL` | `anthropic/claude-sonnet` | `PROMPT_MODEL` is fallback |
| **Codex CLI** | `CODEX_MODEL` | `gpt-5` | Read directly by Codex CLI |
| **Jetski CLI** | `JETSKI_MODEL` | `Gemini 2.5 Flash` | Read directly by Jetski CLI |
| **Claude Code** | `ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250929` | Via Vertex AI config |
| **Jetski (IDE)** | `JETSKI_MODEL` | `Gemini 2.5 Flash` | Same as CLI |

### Usage Examples

```bash
# Run Pi withClaude Sonnet
PI_MODEL=anthropic/claude-sonnet node --experimental-strip-types harness/quick-smoke.ts pi

# Run Gemini CLI with Flash
GEMINI_MODEL=gemini-2.5-flash node --experimental-strip-types harness/quick-smoke.ts gemini-cli

# Run Codex with GPT-5
CODEX_MODEL=gpt-5 node --experimental-strip-types harness/quick-smoke.ts codex-cli

# Run Jetski CLI with specific model
JETSKI_MODEL='Gemini 2.5 Flash' node --experimental-strip-types harness/quick-smoke.ts jetski-cli

# Run full eval suite with Pi and specific model
PI_MODEL=google/gemini-2.5-flash GD_SUITE_CONFIG='{"agent":"pi","serving":"skills_cli"}' \
  node --experimental-strip-types harness/run_suite.ts <task>
```

### How It Works in the Harness

Each agent harness passes the model to the CLI binary:

```typescript
// harness/agents/pi-agent.ts
const piModel = process.env.PI_MODEL || process.env.PROMPT_MODEL;
const modelArg = piModel ? ['--model', piModel] : [];
const commandArgs = ['-p', '--no-session', '--offline', ...modelArg, userPrompt];

// harness/agents/codex-cli-agent.ts
const model = process.env.CODEX_MODEL;
const commandArgs = ['-p', ...(model ? ['--model', model] : []), userPrompt];

// harness/agents/jetski-cli-agent.ts
const model = process.env.JETSKI_MODEL;
const commandArgs = ['-p', ...(model ? ['--model', model] : []), userPrompt];
```

### Fallback Behavior

If no model env var is set:
- **Pi**: Uses the model from `~/.pi/agent/settings.json` (`defaultModel`)
- **Gemini CLI**: Uses the model from `~/.gemini/settings.json` or prompts
- **Codex CLI**: Uses default model (configurable via `codex settings`)
- **Jetski CLI**: Uses default model from Jetski config
- **Claude Code**: Uses model from Vertex AI project config

### Token Efficiency Tips

For development testing, use cheaper/faster models:

```bash
# Use fast model for smoke tests
PI_MODEL=qwen/qwen3.5-plus node --experimental-strip-types harness/quick-smoke.ts pi

# Use expensive model only for final evals
PI_MODEL=anthropic/claude-opus GD_SUITE_CONFIG='...' node --experimental-strip-types harness/run_suite.ts
```

---

## Key Design Patterns

### 1. Isolated HOME Directory

Each test run gets a fresh temp directory as HOME to prevent:
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

**Why `/tmp/` instead of `os.tmpdir()`?**
On macOS, `os.tmpdir()` can return paths that are too long for Unix socket paths, causing issues for some agents (JetSki/VS Code components).

### 2. Auth Credential Copying

Each agent has different auth file locations:

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

Guided runs inject modern-web-guidance via two approaches:

**Skills CLI** (copies guide files):
```typescript
copySkills(tempHome, Agents.PI, cli: true, skillsToEnable);
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

Each agent outputs trajectory in different formats:

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

The harness tracks which guides the agent retrieved/read:

```typescript
// harness/lib/guidance_validation.ts
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

## Adding a New Agent

### Step 1: Create Agent Harness

Copy an existing harness (e.g., `pi-agent.ts`) and update:

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

export function collectMyAgentGuidesFromTrajectory(dirPath: string) {
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

**run_suite.ts** - Agent script mapping:
```typescript
function getAgentScript(agent: string): string {
  return path.join(harnessDir, 'agents',
    agent === Agents.MY_AGENT ? 'my-agent.ts' :
    // ... other agents
    'jetski-agent.ts'
  );
}
```

**lib/collection.ts** - Model and token extraction:
```typescript
export function extractModelFromResults(resultsDir: string): string {
  // Reads model from trajectory_summary.json
}

export function extractTokenUsageFromResults(resultsDir: string) {
  // Reads token usage from trajectory_summary.json
}
```

**lib/guidance_validation.ts** - Guide/tool collection:
```typescript
export async function collectGuidesUsed(dirPath: string) {
  // Reads retrieved and read guides from trajectory_summary.json
}

export async function collectGuidanceToolsUsed(dir: string) {
  // Reads tools used from trajectory_summary.json
}
```

### Step 4: Add Smoke Test

**Option A: Use the agent-agnostic quick-smoke.ts** (recommended)

The `quick-smoke.ts` script supports all registered agents:

```bash
# Usage: node quick-smoke.ts [agent] [guided|unguided]
node --experimental-strip-types quick-smoke.ts pi unguided
node --experimental-strip-types quick-smoke.ts gemini-cli guided
node --experimental-strip-types quick-smoke.ts # defaults to pi

# Or via environment variable
SMOKE_AGENT=claude-code node --experimental-strip-types quick-smoke.ts
```

**Option B: Create agent-specific smoke test** (if you need custom validation)

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

  // Verify output...
}
```

### Step 5: Document in EVALS.md

Add agent configuration instructions to `EVALS.md` under the **Agents** section.

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

Not all agents support both modes. Pi explicitly doesn't support MCP (per their philosophy docs). Document limitations:

```typescript
if (approach === Serving.MCP) {
  console.warn('Warning: MCP mode is not supported by this agent.');
}
```

## Debugging Tips

### Check Isolated HOME Contents

```bash
# Temporarily disable cleanup to inspect isolated HOME
# Add this to agent harness before cleanupIsolatedHome():
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

## Token Efficiency

For development/testing:

1. **Use `--no-session` or `--ephemeral`** flags to avoid saving sessions
2. **Use `--offline`** to disable update checks
3. **Use cheaper models** via environment variables:
   ```bash
   PI_MODEL=cheap/fast-model node pi-smoke.ts
   ```
4. **Run smoke tests** instead of full suites
5. **Limit `numRuns`** in suite config (default is 1 for smoke, 2+ for real evals)

## Testing

### Quick Smoke Test

Use the agent-agnostic smoke test for quick validation:

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

For agent-specific validation logic, create `harness/<agent>-smoke.ts` following the pattern in existing smoke tests.

## Related Documentation

- [EVALS.md](../EVALS.md) - Agent configuration and environment setup
- [eval-results.md](./eval-results.md) - Results storage and GCS upload
- [CONTEXT.md](../CONTEXT.md) - High-level architecture
- [agent-shared.ts](./lib/agent-shared.ts) - Shared utility functions

## Testing the Pi Agent Harness

### Unit Tests

Run the Pi trajectory parsing unit tests:

```bash
cd harness
node --test --experimental-strip-types tests/pi-parsing.test.ts
```

Tests cover:
- Tool call extraction (filtering built-in tools)
- Guide extraction from file reads
- Guide extraction from retrieve commands  
- Mixed session handling
- Empty/missing session handling

### Integration Test (Smoke Test)

```bash
# Quick validation that Pi harness works end-to-end
node --experimental-strip-types quick-smoke.ts pi

# Or specify agent explicitly
node --experimental-strip-types quick-smoke.ts pi unguided
```

### Manual Trajectory Inspection

To inspect actual Pi trajectories from a run:

```bash
# Run with sessions enabled (not ephemeral)
PI_NO_SESSION=false GD_SUITE_CONFIG='{"agent":"pi","serving":"skills_cli"}' \
  node --experimental-strip-types harness/run_suite.ts <task>

# Sessions are saved to the isolated HOME, then exported to results dir
# Inspect the JSONL format
cat results/<suite>/<run>/<task>/guided/*.jsonl | head -100
```

### Adding New Tests

When adding trajectory parsing tests:
1. Use realistic mock data matching Pi's actual session format
2. Test both the `message` wrapper and inner `content` array structure
3. Remember Pi uses `path` not `file_path` in tool arguments
4. Test edge cases: empty sessions, malformed JSON, missing fields

Example test structure:

```typescript
test('collectPiGuidesFromTrajectory extracts guide reads', async () => {
  const tempDir = createTempDir();
  const sessionLines = [
    JSON.stringify({
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: { path: '/skills/modern-web-guidance/guides/forms/dialog/guide.md' }
          }
        ]
      }
    })
  ];
  fs.writeFileSync(path.join(tempDir, 'session.jsonl'), sessionLines.join('\n'));
  
  const guides = await collectPiGuidesFromTrajectory(tempDir);
  assert.deepStrictEqual(guides.fileReadGuides, ['dialog']);
});
```

## Running Evaluations with `gd eval`

The `gd` CLI provides a convenient wrapper around the eval harness:

```bash
# Run with default agent (Gemini CLI)
gd eval <task-name>

# Run with Pi agent
gd eval --config harness/config-pi.ts <task-name>

# Run with custom model
PI_MODEL=anthropic/claude-sonnet gd eval --config harness/config-pi.ts <task-name>

# Run multiple specific tasks
gd eval --config harness/config-pi.ts task1 task2 task3

# Run full suite (all discovered tasks)
gd eval --config harness/config-pi.ts
```

The `--config` flag accepts either:
- A path to a config file (e.g., `harness/config-pi.ts`)
- A JSON string via `GD_SUITE_CONFIG` environment variable (less convenient)

See `harness/config-pi.ts` for an example configuration.
