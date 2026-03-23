# Releasing Skills

To release updates to our AI Skills infrastructure (Claude Code, Gemini CLI, vanilla and VS Code Extensions), we leverage the `dist/` bundler that collapses web-guidelines into a lightweight distribution pack.

### Release Steps
1. Make all source code changes locally or via PR in the `guidance` repo.
2. Run `pnpm run dist-gen` from the `serving/` folder to build executable tools and populate the `dist/` folder. This generates:
   - Extension metadata files (`gemini-extension.json`, `package.json`, `.claude-plugin/marketplace.json`)
   - Bundled entrypoints (`esbuild` transpilation) alongside scoped local databases
   - Overruling `README.md` containing installation commands.
3. Copy the contents of the generated `dist/` directory and commit them directly (or via a CI/CD automated push) to the `GoogleChrome/skills-alpha` repository.

Since Claude Code and Gemini CLI ingest plugin setups directly from the filesystem repository root, simply pushing the new `dist/` contents to `GoogleChrome/skills-alpha` instantly acts as the live deployment!
