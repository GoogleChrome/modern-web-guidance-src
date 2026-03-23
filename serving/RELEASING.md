# Releasing Guidance Skills

To release updates to our AI Skills infrastructure (Claude Code, Gemini CLI, vanilla and VS Code Extensions), we leverage the `dist/` bundler that collapses all our source guidance docs and tools into a lightweight distribution pack. This distribution pack is then published directly to our user-facing repository: `GoogleChrome/skills-alpha`.

## The Publishing Pipeline

1. **Make changes** locally or via PR in the `guidance` repo under `serving/`.
2. **Deploy** by running the automated publishing command from the `serving/` folder:
   ```bash
   pnpm run publish-skills
   ```
   *Under the hood, this script:*
   1. Increments the patch version across all AI extension manifests (`0.0.x`).
   2. Executes `dist-gen` to bundle all tools, local databases, and new extension metadata.
   3. Uses the `gh-pages` API to forcefully replicate the entirely newly bundled `dist/` envelope upward to the `main` branch of `git@github.com:GoogleChrome/skills-alpha.git`.

## GitHub Releases (Important for Gemini CLI)

When users run:
```bash
gemini extensions install https://github.com/GoogleChrome/skills-alpha
```
The Gemini CLI attempts to fetch an official GitHub Release by default, not just a git clone. If no releases exist via the API paths, users will see an error:
`Failed to fetch release data for GoogleChrome/skills-alpha at tag undefined: Request failed with status code 404.`
It will then prompt the user to fall back to a "git clone" installation.

**Note on Private Repositories:** 
If `GoogleChrome/skills-alpha` is kept private, the Gemini CLI must be able to authenticate. Users must have a `GITHUB_TOKEN` environment variable exported with the `repo` scope. Without this token, the API request will fail (often presenting as a 404 since GitHub hides private repos from unauthenticated requests), and the CLI will again fall back to `git clone`.

### Creating a Release in GoogleChrome/skills-alpha

To provide a seamless, error-free installation experience, we must manage releases formally on the published repository. 

1. Update the `version` field in `serving/skills-cli/gemini-extension.json`, `serving/skills-cli/.claude-plugin/plugin.json`, `serving/skills-cli/.claude-plugin/marketplace.json` and `serving/skills-cli/vscode-ext-package.json`.
2. Run the `dist-gen` build and deploy the updated `dist/` to `GoogleChrome/skills-alpha`.
3. Create a **GitHub Release** on `GoogleChrome/skills-alpha` via the UI or using the GitHub CLI:
   ```bash
   gh release create v1.0.1 --title "v1.0.1" --notes "Release notes here..."
   ```

When a GitHub Release is available and marked as "Latest", the Gemini CLI will download the archive corresponding to that release directly, bypassing the `404` error and the fallback prompt. This is significantly faster than a full git clone.

## Branches vs Releases for AI Tooling

- **Gemini CLI (Releases):** GitHub Releases are the primary, most robust way for the Gemini CLI to install extensions.
- **Gemini CLI (Fallback):** If users install directly from a branch (via the fallback), the CLI considers the `HEAD` commit as the latest version and will dynamically prompt them for updates when new commits are pushed to the branch.
- **Claude Code (Git Pull):** Claude Code does not query the GitHub Releases API. Instead, it relies strictly on the `version` field within `.claude-plugin/plugin.json` in the git repository. Bumping that version string in the `dist` bundle and pushing to `main` is the only way Claude Code detects that an update is available to pull.

By maintaining proper GitHub Releases and bumping versions in the JSON manifests, we support the 'happy path' for installation on the Gemini platform while seamlessly ensuring auto-updates function correctly for Claude Code users polling the main branch.

## Why a Single Bundled Plugin?

While Claude supports distributing multiple individual plugins via a `.claude-plugin/marketplace.json` catalog (allowing users to `marketplace add` and then pick and choose), `GoogleChrome/skills-alpha` intentionally operates as a **single bundled plugin** (`googlechrome-skills`) containing multiple agent skills natively underneath it. 

This approach was chosen because:

1. **Simplified Installation:** Users only install one plugin (`googlechrome-skills`) to instantly access the entire suite of curated skills, rather than sifting through a catalog and installing them one by one.
2. **Ecosystem Alignment:** The Gemini CLI and VS Code extension systems natively treat repositories as singular bundles. Standardizing the repo as a single Claude plugin ensures 1:1 structural parity across all 3 environments without the overhead of maintaining nested, disconnected manifests for every individual skill folder.
