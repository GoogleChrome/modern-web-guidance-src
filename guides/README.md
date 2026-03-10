## Testing Guides

**Prerequisite Setup:**
Before using the `gd` CLI, ensure it's linked globally:

```bash
pnpm install
pnpm link --global && gd setup-completion
```
*Note: For the auto-completion to take effect, you must refresh your shell (e.g., open a new terminal or source your config).*

### Automated (Recommended)

Use `gd dev` to automatically generate missing artifacts and calibrate the grader in one command:

```bash
gd dev <path/to/guide_dir>

# e.g. gd dev guides/performance/content-vis
```

This will:
1. Inventory existing artifacts (`guide.md`, `demo.html`, `expectations.md`, `negative-demo.html`, `grader.ts`)
2. Generate `negative-demo.html` if missing (via Gemini CLI)
3. Generate `grader.ts` if missing (via Gemini CLI)
4. Calibrate the grader (demo.html should pass 100%, negative-demo.html should fail 100%)
5. If calibration fails, regenerate the grader with failure context and retry (up to 2 retries)

**Prerequisites:** The guide directory must contain `guide.md`, `demo.html`, and `expectations.md`.

Agent tests run automatically after calibration by default. To skip them, add `--no-test`:

```bash
gd dev <path/to/guide_dir> --no-test
```

To batch-process all incomplete guides:

```bash
gd dev-all
```

### Manual Steps

1. Create a `guide.md`, `expectations.md`, and `demo.html` in the desired guide directory (e.g. `guidance/guides/performance/content-vis/`).
2. Set `GEMINI_API_KEY` and `GEMINI_MODEL` environment variables in `guidance/.env`:

```sh
GEMINI_API_KEY=api-key
GEMINI_MODEL=gemini-3.1-pro-preview
```

Then, from `guidance/` root:

3. Setup:
```sh
pnpm install
pnpm setup:playwright
```

4. Generate negative demo:
```bash
gd dev <path/to/guide_dir> --gen-negative

# e.g. gd dev guides/performance/content-vis --gen-negative
```

This will create a `negative-demo.html` file in the guide directory.

5. Generate grader:
```bash
gd dev <path/to/guide_dir> --gen-grader
```

This will create a `grader.ts` file in the guide directory.

6. Once the grader is generated, run it on the `demo.html` and `negative-demo.html` with:
```bash
gd dev <path/to/demo_file> --grade

# e.g. gd dev guides/performance/content-vis/demo.html --grade
# e.g. gd dev guides/performance/content-vis/negative-demo.html --grade
```

On each `gd grade` run, a `grade-report` folder will be created in the same directory as the specified demo file, and the results will be displayed in a browser window.

If you pass the **guide directory**, it will run a rapid meta-calibration suite to ensure the grader correctly passes `demo.html` at 100% and correctly fails `negative-demo.html` at 0%. If the grader fails either constraint, it will output a CLI summary and provide copy-paste links directly to the generated HTML reports so you can explore in detail.


You can automatically verify that your grader is perfectly calibrated against both of these files by running:

```bash
gd dev <path/to/guide_dir> --test-grader

# e.g. gd dev guides/performance/content-vis --test-grader
```

## Testing with an Agent

### Automated (Recommended)

By default, `gd dev` runs a full agent evaluation after calibration:

```bash
gd dev <path/to/guide_dir>
```

This runs the following pipeline after the grader calibrates successfully:

1. **Generate `prompts.md`** if missing — uses Gemini CLI to create a set of developer-facing prompts derived from the guide
2. **Find or create a task file** in `harness/tasks/` — scans existing tasks for a matching `grader:` field, or creates `<guideName>-task.md` using the first prompt from `prompts.md` (defaults to `daily-grind` base app)
3. **Grade the base app as-is** (pre-score) — establishes a baseline before any agent runs
4. **Run the agent** in both `unguided` (no guide access) and `guided` (with MCP guide access) modes against the base app
5. **Grade both outputs** and print a comparison:

```
Agent test results:
  Base app (pre):   1/9 checks passed (11%)
  Unguided:         3/9 checks passed (33%)
  Guided:           8/9 checks passed (89%)
  Guide impact:     +56% (vs unguided)
```

The agent and base app are selected from the [harness config](../harness/config.ts) (`suite.agent` and the task's `base_app` field).

The generated task file is automatically included in future `gd eval suite` runs — the suite discovers all task files in `harness/tasks/` by default.

### Manual Steps

If you need more control, you can run each step individually:

1. Configure the following settings for your run in the [harness config](../harness/config.ts):

```
mcpServersToEnable: ['modern-web'],
enableSkills: false,
agent: Agents.GEMINI_CLI
```

> Note: to test the agent without any guide access, set `mcpServersToEnable` to `[]` (and step `2` can be skipped).

2. Build the MCP index with the guide:

```sh
pnpm build:mcp <path/to/guide_dir>
```

3. Create a `test-app` directory in the `<guide_dir>`:

```sh
mkdir <path/to/guide_dir>/test-app/
```

Within this folder, create a base app (e.g. `index.html`) that you want the agent to modify (or, leave the folder empty for a completely blank slate).

4. Run the agent on the test app with a prompt:

```bash
gd run <path/to/guide_dir>/test-app/ "<prompt>"
```

This will create a `test-app-result` directory in the `<path/to/guide_dir>` folder with the results of the run.

5. Run the grader and see the results on the generated file:

```bash
gd dev <path/to/guide_dir>/test-app-result/index.html --grade
```

Use the results to validate guide quality, and make changes as needed. A useful sanity check is to examine the result of the agent run *without* guide access.
