## Testing Guides

1. Create a `guide.md`, `expectations.md`, and `demo.html` in the desired guide directory (e.g. `guidance/guides/performance/content-vis/`).
2. Set `GEMINI_API_KEY` and `GEMINI_MODEL` environment variables in `guidance/.env`:

```
GEMINI_API_KEY=api-key
GEMINI_MODEL=gemini-3-pro-preview
```

Then, from `guidance/` root:

3. Setup:
```
pnpm install
pnpm setup:playwright
```

4. Generate negative demo:
```
pnpm generate-negative <path/to/guide_dir>
# e.g. pnpm generate-negative guides/performance/content-vis
```

This will create a `negative-demo.html` file in the guide directory.

5. Generate grader:
```
pnpm generate-grader <path/to/guide_dir>
```

This will create a `grader.ts` file in the guide directory.

6. Once the grader is generated, run it on the `demo.html` and `negative-demo.html` with:

```
pnpm grade <path/to/demo_file>

e.g. pnpm grade guides/performance/content-vis/demo.html
e.g. pnpm grade guides/performance/content-vis/negative-demo.html
```

On each `pnpm grade` run, a `grade-report` folder will be created in the same directory as the specified demo file, and the results will be displayed in a browser window.

The grader should pass at 100% for `demo.html`, and 0% for `negative-demo.html`. If needed, make changes to the files created in this folder (including `guide.md`), repeating any of the above steps, until this is reliably true.

## Testing with an Agent

1. Configure the following settings for your run in the [harness config](../harness/config.ts):

```
mcpServersToEnable: ['modern-web'],
enableSkills: false,
agent: Agents.GEMINI_CLI
```

> Note: to test the agent without any guide access, set `mcpServersToEnable` to `[]` (and step `2` can be skipped).

2. Build the MCP index with the guide:

```
pnpm build:mcp <path/to/guide_dir>
```

3. Create a `test-app` directory in the `<guide_dir>`:

```
mkdir <path/to/guide_dir>/test-app/
```

Within this folder, create a base app (e.g. `index.html`) that you want the agent to modify (or, leave the folder empty for a completely blank slate).

4. Run the agent on the test app with a prompt:

```
pnpm run-agent <path/to/guide_dir>/test-app/ "<prompt>"
```

This will create a `test-app-result` directory in the `<path/to/guide_dir>` folder with the results of the run.

5. Run the grader and see the results on the generated file:

```
pnpm grade <path/to/guide_dir>/test-app-result/index.html
```

Use the results to validate guide quality, and make changes as needed. A useful sanity check is to examine the result of the agent run *without* guide access.
