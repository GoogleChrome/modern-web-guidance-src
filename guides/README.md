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

Once you reach **Stage 3 (Needs evals)**—meaning `guide.md` and `expectations.md` are completely written—you can use `gd dev` to automatically generate all evaluation artifacts, calibrate graders, run evaluations, and generate an evaluation diagnostic report in one command:

```bash
gd dev <path/to/guide_dir>

# e.g. gd dev guides/css/size-aware-styling
```

This will automatically execute the 5-step pipeline:
1. **Solutions Generation**: Generates golden solution patches and zero-passrate baseline patches across target base applications (`daily-grind`, `devtools-times`).
2. **Grader Generation**: Generates `grader.ts` Playwright tests based on `expectations.md` and your guide.
3. **Grader Calibration**: Calibrates the grader (ensures golden patches pass 100% and zero-passrate baseline fails 100%).
4. **Agent Evaluations**: Executes guided and unguided agent runs against the target apps to measure pass rates and guidance tool consumption.
5. **Evaluation Report (`report.md`)**: Invokes an evaluator agent to analyze failed assertions, diagnose root causes, and output actionable recommendations into `<guide_dir>/test-app-results/report.md`.

To skip agent evaluations and report generation after calibration, add `--no-test`:

```bash
gd dev <path/to/guide_dir> --no-test
```

### Submitting a Pull Request: `gd pr`

Once `gd dev` completes and generates `test-app-results/report.md`, you can create a Pull Request directly from your terminal:

```bash
gd pr <path/to/guide_dir>

# e.g. gd pr guides/css/size-aware-styling
```

This will automatically:
1. Stage and commit any uncommitted changes for the guide.
2. Push your feature branch to `origin`.
3. Analyze `report.md` to automatically detect and apply PR labels:
   - **`gd-dev-content`**: Attached if recommendations include modifications to `guide.md` or `expectations.md`.
   - **`gd-dev-eval`**: Attached if recommendations include modifications to `task.md` or `grader.ts`.
4. Open the GitHub Pull Request with the full evaluation report (`report.md`) as the PR body description.

### Checking Status: `gd audit`

You can use `gd audit` to see exactly where every guide sits in the Kanban board pipeline:

```bash
gd audit
```

This will output a categorized table sorted into the 6 maturity stages (`Stub`, `Incomplete`, `Needs expectations`, `Needs calibration`, `Needs test`, `Eval-ready`), along with recommended next steps.

### Manual Piece-wise execution

Occasionally, you may want to generate or test specific pieces of the pipeline manually.
Ensure `GEMINI_API_KEY` and `GEMINI_MODEL` environment variables are in `modern-web-guidance-src/.env`:

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

The agent is selected from the `config.ts` if it exists (see [config.ts.example](../config.ts.example) for setup), otherwise uses default in the [harness config](../harness/config.ts).
The base app is selected from the generated `tasks/task.md` file (which defaults to `daily-grind`).

### Negative Evals

To verify that guides improve agent performance starting from a "bad" implementation, you can run against the `negative-demo.html`.

```bash
gd eval <guideName>/negative
```

### Manual Steps

If you need more control, you can run each step individually:

1. Configure the following settings for your run in the [harness config](../harness/config.ts):

```
mcpServersToEnable: ['modern-web-guidance'],
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
