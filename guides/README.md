## Testing Guides

1. Create a `guide.md`, `expectations.md`, and `demo.html` in the desired guide directory.
2. Set `GEMINI_API_KEY` and `GEMINI_MODEL` environment variables in `guidance/.env`.

.env:
```
GEMINI_API_KEY=api-key
GEMINI_MODEL=gemini-3-pro-preview
```

3. From `guidance/` root:

Setup:
```
pnpm install
pnpm setup:playwright
```

Generate negative demo:
```
pnpm generate-negative <path/to/guide_dir>
# e.g. pnpm generate-negative guides/performance/content-vis
```

This will create a `negative-demo.html` file in the guide directory.

Generate grader:
```
pnpm generate-grader <path/to/guide_dir>
```

This will create a `grader.ts` file in the guide directory.

4. Once the grader is generated, run it on the `demo.html` and `negative-demo.html` with:

```
pnpm grade <path/to/guide_dir>/demo.html
pnpm grade <path/to/guide_dir>/negative-demo.html
```

The test should pass at 100% for `demo.html`, and 0% for `negative-demo.html`. Make the necessary updates until this is reliably true.

## Testing with an Agent

1. Configure the following settings for your run in the [config](../harness/config.ts):

```
mcpServersToEnable: ['modern-web'],
enableSkills: false,
agent: <agent>
```

1. Build the MCP index with the guide:

```
pnpm build:mcp <path/to/guide_dir>
```

2. Create a `test-app` directory in the `<guide_dir>`:

```
mkdir <path/to/guide_dir>/test-app/
```

Within this folder, create a base app (e.g. `index.html`) that you want the agent to modify (or, leave the folder empty for a completely blank slate).

3. Run the agent on the test app with a prompt:

```
pnpm run-agent <path/to/guide_dir>/test-app/ "<prompt>"
```

This will create a `results` directory in the `<path/to/guide_dir>/test-app/` folder with the results of the run.

4. Run the grader on the generated result:

```
pnpm grade <path/to/guide_dir>/test-app-result/index.html
```
