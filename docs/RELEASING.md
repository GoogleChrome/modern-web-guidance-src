# Releasing Modern Web Guidance Skills

To release updates for our AI skills (Claude Code, Gemini CLI / Antigravity, VS Code, Cursor, GitHub Copilot CLI, Grok, Kimi Code, and OpenAI Codex), we use an automated pipeline that bundles our source files into a lightweight distribution pack (`dist/skills-cli/`) and publishes it to `GoogleChrome/modern-web-guidance`.

## Automated CI/CD Publishing

Releases are published automatically via GitHub Actions:
* **Workflow**: [`.github/workflows/publish.yml`](../.github/workflows/publish.yml)
* **Schedule**: Runs every Monday at 14:50 UTC (6:50 AM PST / 7:50 AM PDT), publishing to the `latest` npm dist-tag and `main` branch of `GoogleChrome/modern-web-guidance`.
* **Manual Trigger (`workflow_dispatch`)**: Can be triggered manually via GitHub Actions **Run workflow** with:
  * `dist_tag`: `next` (default) or `latest` (also updates the `next` dist-tag and `main` branch of `GoogleChrome/modern-web-guidance`).
  * `version`: Optional explicit semver override (e.g. `1.0.0`); leave blank to auto-increment the patch version.

## Manual Publishing via CLI

To publish manually from your terminal:

```bash
# 1. Preview changes and release notes (dry run)
pnpm run publish-skills --dry-run

# 2. Publish to @latest (or pass --tag next / --version X.Y.Z)
pnpm run publish-skills
pnpm run publish-skills --tag next
pnpm run publish-skills --tag latest --version 1.0.0
```

**What the publishing pipeline does under the hood:**
1. Collects the latest nightly eval benchmark summary from GCS.
2. Resolves the target version (`vX.Y.Z`, either explicit `--version` or auto-incremented patch) and updates all distribution and plugin manifests.
3. Compiles source guides and skills into the distribution format (`dist/skills-cli/`).
4. Runs distribution validation and installation test suites.
5. Pushes the compiled `dist/skills-cli/` directory to the target branch (`main` for `latest`, `next` for `next`) of `GoogleChrome/modern-web-guidance`.
6. Tags the release `vX.Y.Z` (and marks `next` releases as GitHub pre-releases).
7. Generates consumer-facing release notes using Gemini and creates the official GitHub Release via `gh release create`.

## Generating & Previewing Release Notes

You can generate and preview release notes for any tag or diff using the `generate-release-notes` CLI:

```bash
# Preview notes comparing against the latest tag using Gemini
node --env-file=.env src/build/generate-release-notes.ts v0.0.185

# Test deterministic fallback (without API key)
node src/build/generate-release-notes.ts v0.0.185
```

### Release Notes Structure

The release notes automatically group changes into clear top-level sections:
* `## 🆕 New Guides`: High-level summary of newly introduced guides and their use cases.
* `## 🔄 Updated Guides`: Bullet points describing substantive guidance evolutions and API patterns.
* `## 🗑️ Removed Guides`: Deprecated or deleted guidance.
* `## 🌐 Browser Support Updates`: Grouped Baseline status shifts (`Widely available` → `Newly available` → `Limited availability`).
* `## 🔌 Plugins`: Updates to agent marketplace manifests and plugin definitions.
* `## 📊 Benchmark Evaluations`: Latest agent pass-rate uplifts.

## Local Development & Global Linking

To build, install, and test the compiled package locally as a global CLI:

```bash
cd "$(git rev-parse --show-cdup)" && node src/build/build-dist.ts && cd dist/skills-cli && npm install --global .
```

This registers the package globally and places the `modern-web-guidance` binary in your `PATH`.

## Architecture Note: The "Single Bundle" Approach

For Claude Code, the `modern-web-guidance` repository acts as a **single bundled plugin** (`googlechrome-skills`) rather than a marketplace catalog of individual plugins.

* **Simplified Installation:** Users only need to run one install command to access the entire suite of curated web development skills.
* **Ecosystem Alignment:** Both Gemini CLI and VS Code natively treat repositories as singular extensions. Consolidating the project into a single plugin ensures structural parity across all environments, cutting down the technical overhead of parsing nested manifests for every individual skill file.
