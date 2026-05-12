# Candidate Proposal: Should we enable AI_AGENT for vercel skills CLI?

## Context & Upstream Discovery

Recent deep-dive research into the upstream `vercel-labs/skills` core repository reveals an internal mode triggered by the environment variable [`AI_AGENT=true`](https://www.npmjs.com/package/@vercel/detect-agent?activeTab=readme). When present, [`isRunningInAgent()`](https://github.com/vercel-labs/skills/blob/c99a72b371b5b4da865f5afa87c5a686f3a46766/src/detect-agent.ts) evaluates to `true`, automatically applying the following optimizations:

## Behavior Changes (Empirical Mechanics)

Enabling the internal agent runtime mode fundamentally shifts the execution strategy of the CLI from an interactive, human-centric wizard to a predictable, strict headless engine. Below is the granular, empirical breakdown of the underlying behavior changes:

### 1. Scope Routing
* **Standard Baseline**: The CLI evaluates local directory configurations or relies on interactive terminal prompts to determine whether to install skills globally (mutating user-level configurations) or locally.
* **Optimized Agent Runtime**: Execution strictly defaults to the local **Project scope only** (`installGlobally = false`). User-level and global OS configuration paths (e.g., home directory files) are completely bypassed. This isolation guarantees that autonomous runs do not produce cross-project side-effects or globally overwrite shared settings on the host machine. Global scope mutation is only permitted if the execution arguments explicitly provide the `-g` or `--global` override flag.

### 2. Skill Selection
* **Standard Baseline**: When processing multi-skill repositories, the CLI renders interactive selection components (such as multi-select checkbox lists) to allow manual pruning of targeted skills.
* **Optimized Agent Runtime**: Because autonomous agents cannot interactively answer terminal selection prompts, enabling `AI_AGENT` automatically switches the selection resolver into an **"install all"** strategy. The engine resolves and extracts every valid skill discovered within the repository manifest by default. To target a singular skill or a filtered subset within non-interactive scripts, the caller must explicitly append the skill suffix syntax (e.g., `vercel-labs/skills@specific-skill`).

### 3. Target Agents
* **Standard Baseline**: The integration linker automatically maps downloaded skills to all supported IDEs and assistant runtimes configured locally on the physical machine.
* **Optimized Agent Runtime**: Resolution delegates entirely to the `@vercel/detect-agent` package to derive the execution context, adapting file linking dynamically based on the explicit content of the environment variable:
  * **Scenario A (Specific Agent Override)**: If the environment variable contains an explicit target string (e.g., `AI_AGENT=cursor`), resolution strictly routes to that single identified host agent alongside the standard base of **13 Universal Agents** (such as standard MCP servers or generic wrappers). Unrelated specialized hosts are ignored.
  * **Scenario B (Generic Enablement)**: If configured with a generic flag (e.g., `AI_AGENT=true`), the detection engine scans local system signatures to resolve all active specialized host agents present on the workstation, targeting them in tandem with the **13 Universal Agents**.

### 4. Installation Method
* **Standard Baseline**: File placement behavior depends on manual selection, OS capabilities, or elevated administrator permissions to toggle between copying and linking.
* **Optimized Agent Runtime**: To guarantee sandbox safety and prevent broken cross-device reference links inside containers, the engine dynamically splits default file operations based on the resolved target host class:
  * **Universal Hosts**: Forces a static **deep copy** (`copy`). This ensures that headless CI runners, ephemeral containers, and detached agent sandboxes retain independent, immutable files without broken symlink dependencies across storage volumes.
  * **Specialized Hosts**: Forces **symbolic linking** (`symlink`). Local specialized desktop installations receive direct relative links to optimize local disk usage and maintain live file updates with the underlying repository source files.

### 5. Workspace Clutter Guardrail
* **Standard Baseline**: Standard initializations aggressively generate required dotfolders (e.g., `.cursor/`, `.claude/`) within the target destination to ensure path structures exist prior to configuration injection.
* **Optimized Agent Runtime**: When performing project-level symlinking, the installer applies a strict preflight existence verification check against the target base directory. If the corresponding agent-specific root folder does not natively exist in the project workspace, the linking engine intelligently **skips generating the dotfolder**. This acts as a definitive guardrail against filesystem clutter, preventing hidden folder scaffolding for IDEs or assistants that the project does not actively utilize.

---

## UX Impact Analysis

| Dimension | Autonomous Agents | Human Developers |
| :--- | :--- | :--- |
| **Execution Flow** | **Non-blocking & Deterministic**: Eliminates interactive prompts, UI spinners, and manual confirmation blocks that cause pipeline execution timeouts or unhandled input hangs. | **Preserves Intent**: Avoids surprising human operators with unexpected global state changes or accidental hidden directory scaffolds during local test runs. |
| **Workspace Hygiene** | **Strictly Contained**: Guarantees project-scoped isolation by default, preventing rogue multi-agent runs from corrupting shared environment settings or host registries. | **Zero Clutter**: Prevents silent accumulation of unsupported agent dotfolders across local source trees, maintaining clean version control paths. |
| **Flexibility** | **Fully Automated Discovery**: Fetches and exposes entire repository capabilities out-of-the-box without requiring granular path arguments. | **Explicit Control**: Maintains complete configuration control via transparent, standardized command overrides (`-g`, `@skill` syntax). |

---

## Proposed Implementation Options

To adopt and expose this internal capability safely within the CLI ecosystem, we propose three candidate strategies:

### Option A: Always Enable by Default (Implicit Headless)
Automatically apply the `AI_AGENT=true` optimizations internally whenever the execution runtime detects a non-interactive environment, without requiring explicit user configuration.
* **Pros**: Zero integration friction. Immediate compatibility for containerized environments, automation scripts, and agent task execution loops.
* **Cons**: Implicit behavior changes can violate the principle of least surprise for engineers executing local background scripts who expect standard global default behaviors.

### Option B: Heuristic Detection via `isTTY` / CI Flags
Dynamically enable the optimizations if the process output stream evaluates to non-interactive (`process.stdout.isTTY === false`) or if standard continuous integration environment signatures (e.g., `CI=true`, `GITHUB_ACTIONS`) are detected.
* **Pros**: Cleanly differentiates local manual human invocations from scripted workflows and remote build platforms without requiring argument modifications.
* **Cons**: Suboptimal reliability. Autonomous agents executing commands inside allocated pseudo-terminals (PTYs) will trick the `isTTY` heuristic into assuming a human operator, failing to activate the necessary bypass mechanisms.

### Option C: Explicit CLI Flag Override (`--agent` / `--ai-agent`)
Preserve the standard interactive mode as the absolute baseline, requiring callers to append an explicit argument flag (e.g., `vercel-skills install --agent`) or pass the `AI_AGENT` environment variable manually.
* **Pros**: Exceptionally deterministic, transparent, and backward-compatible. Avoids any unexpected heuristic edge cases.
* **Cons**: Places the integration and configuration burden entirely onto the invoking framework or wrapper agent to ensure the correct runtime flag is appended.

---

## Recommendation

We recommend implementing **Option C** as the initial baseline to guarantee stability and deterministic control, alongside clear external documentation guiding wrapper integrations to set `AI_AGENT=true` globally within their runtime sandbox setups.
