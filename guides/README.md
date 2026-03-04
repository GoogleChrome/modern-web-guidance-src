## Testing Guides

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
```sh
pnpm generate-negative <path/to/guide_dir>
# e.g. pnpm generate-negative guides/performance/content-vis
```

This will create a `negative-demo.html` file in the guide directory.

5. Generate grader:
```sh
pnpm generate-grader <path/to/guide_dir>
```

This will create a `grader.ts` file in the guide directory.

6. Once the grader is generated, run it on the `demo.html` and `negative-demo.html` with:
```sh
pnpm grade <path/to/demo_file_or_directory>
```

If you pass a specific `.html` file, it will grade it and auto-open the interactive visual HTML report.

If you pass the **guide directory**, it will run a rapid meta-calibration suite to ensure the grader correctly passes `demo.html` at 100% and correctly fails `negative-demo.html` at 0%. If the grader fails either constraint, it will output a CLI summary and provide copy-paste links directly to the generated HTML reports so you can explore in detail.


## Testing with an Agent

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

```sh
pnpm run-agent <path/to/guide_dir>/test-app/ "<prompt>"
```

This will create a `test-app-result` directory in the `<path/to/guide_dir>` folder with the results of the run.

5. Run the grader and see the results on the generated file:

```sh
pnpm grade <path/to/guide_dir>/test-app-result/index.html
```

Use the results to validate guide quality, and make changes as needed. A useful sanity check is to examine the result of the agent run *without* guide access.
