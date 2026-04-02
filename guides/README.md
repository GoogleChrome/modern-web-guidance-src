# Authoring and Testing Guides

This README details how to use the `gd` CLI to test and calibrate your guides as they progress through the 3-stage workflow.

**Prerequisite Setup:**
Before using the `gd` CLI, ensure it's linked globally:

```bash
pnpm install
pnpm link --global && gd setup-completion
```
*Note: For the auto-completion to take effect, you must refresh your shell (e.g., open a new terminal or source your config).*

### Stage 3 Pipeline: `gd dev`

Once you reach **Stage 3 (Needs evals)**—meaning `guide.md`, `demo.html`, and `expectations.md` are completely written—you can use `gd dev` to automatically generate all missing evaluation artifacts and calibrate the grader in one command:

```bash
gd dev <path/to/guide_dir>

# e.g. gd dev guides/performance/content-vis
```

This will automatically:
1. Inventory existing artifacts and ensure prerequisites are met
2. Generate `negative-demo.html` based on the guidance (via Gemini CLI)
3. Generate `grader.ts` Playwright test based on your expectations
4. Calibrate the grader (ensures `demo.html` passes 100% and `negative-demo.html` fails 100%)
5. If calibration fails, it will read the build logs, regenerate the grader with the failure context, and retry (up to 2 retries)

Agent tests run automatically after successful calibration by default. To skip the agent E2E test, add `--no-test`:

```bash
gd dev <path/to/guide_dir> --no-test
```

To batch-process all guides that have their prerequisites written but are lacking evals:

```bash
gd dev-all
```

### Checking Status: `gd audit`

You can use `gd audit` to see exactly where every guide sits in the Kanban board pipeline:

```bash
gd audit
```

This will output a categorized table sorted into the 4 workflow states (`Needs use cases`, `Needs guidance`, `Needs evals`, `Done`), along with recommended next steps.

### Manual Piece-wise execution 

Occasionally, you may want to generate or test specific pieces of the pipeline manually.
Ensure `GEMINI_API_KEY` and `GEMINI_MODEL` environment variables are in `guidance/.env`:

```sh
GEMINI_API_KEY=api-key
GEMINI_MODEL=gemini-3.1-pro-preview
```

Setup Playwright before testing:
```sh
pnpm install
pnpm setup:playwright
```

Generate *only* the negative demo:
```bash
gd dev <path/to/guide_dir> --gen-negative
```

Generate *only* the grader:
```bash
gd dev <path/to/guide_dir> --gen-grader
```

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

1. **Generate `tasks/task.md`** if missing — uses Gemini CLI to create a set of developer-facing prompts derived from the guide and adds `base_app: daily-grind` frontmatter.
2. **Grade the base app as-is** (pre-score) — establishes a baseline before any agent runs
3. **Run the agent** in both `unguided` (no guide access) and `guided` (with MCP guide access) modes against the base app
4. **Grade both outputs** and print a comparison:

```
Agent test results:
  Base app (pre):   1/9 checks passed (11%)
  Unguided:         3/9 checks passed (33%)
  Guided:           8/9 checks passed (89%)
  Guide impact:     +56% (vs unguided)
```

The agent is selected from the specified [config](../config.ts) if it exists, otherwise uses default in the [harness config](../harness/config.ts).
The base app is selected from the generated `tasks/task.md` file (which defaults to `daily-grind`).

### Negative Suite

To verify that guides improve agent performance starting from a "bad" implementation, you can run a **Negative Suite**. Simply set `negative: true` in your `config.ts`, and run `gd eval`. The harness will use `negative-demo.html` on the fly as the base app for each guide.
   Ensure your local configuration (`guidance/config.ts`) has `negative: true`, then run:
   ```bash
   gd eval
   ```
   *(Alternatively, you can specify a custom config with `gd eval --config my_negative_config.ts`)*

### Manual Steps

If you need more control, you can run each step individually:

1. Configure the following settings for your run in the [harness config](../harness/config.ts):

```
mcpServersToEnable: ['modern-web'],
serving: Serving.MCP,
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
