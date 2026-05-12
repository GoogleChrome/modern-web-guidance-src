# Should we enable AI_AGENT for vercel skills CLI?

Recent deep-dive research into the upstream `vercel-labs/skills` core repository reveals an internal mode triggered by the environment variable [`AI_AGENT=true`](https://www.npmjs.com/package/@vercel/detect-agent?activeTab=readme). When present, [`isRunningInAgent()`](https://github.com/vercel-labs/skills/blob/c99a72b371b5b4da865f5afa87c5a686f3a46766/src/detect-agent.ts) evaluates to `true`, automatically applying the following optimizations:

### Behavior Changes
* **Forces `--yes`**: Automatically confirms all prompts.
* **Suppresses UI**: Disables interactive menus, animations, and spinners.
* **Defaults Scope**: Targets the project scope automatically.

### UX Impact
* **Autonomous Agents**: Eliminates stdin blocks, saves tokens.
* **Human Developers**: Fast setup, but removes interactive control and hides security warnings.

### Proposed Options
* **Option A (Always enable)**: Set `AI_AGENT=true` by default for all executions.
* **Option B (Heuristic detect)**: Auto-enable via `isTTY` or `CI` environment checks.
* **Option C (CLI flag override)**: Require an explicit command-line flag to activate agent mode.
