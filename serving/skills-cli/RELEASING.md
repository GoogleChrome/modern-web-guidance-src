# Releasing Modern Web Guidance Skills

To release updates for our AI skills (Claude Code, Gemini CLI / Antigravity, VS Code, Cursor, GitHub Copilot CLI, Grok, and Kimi Code), we use an automated pipeline that bundles our source files into a lightweight distribution pack (`dist/skills-cli/`) and publishes it to `GoogleChrome/modern-web-guidance`.

## Automated CI/CD Publishing

Releases are published automatically via GitHub Actions:
* **Workflow**: [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml)
* **Schedule**: Runs every Monday at 20:00 UTC (12:00 PM PST / 1:00 PM PDT).
* **Manual Trigger**: Can be triggered manually at any time via GitHub Actions **Run workflow** (`workflow_dispatch`).

## Manual Publishing via CLI

To publish manually from your terminal:

```bash
# 1. Preview changes and release notes (dry run)
pnpm --filter serving run publish-skills --dry-run

# 2. Publish release
pnpm --filter serving run publish-skills
```

**What the publishing pipeline does under the hood:**
1. Collects the latest nightly eval benchmark summary from GCS.
2. Increments the patch version (`v0.0.x`) across all extension manifests.
3. Compiles source guides and skills into the distribution format (`dist/skills-cli/`).
4. Runs distribution validation and installation test suites.
5. Pushes the compiled `dist/skills-cli/` directory to the `main` branch of `git@github.com:GoogleChrome/modern-web-guidance.git`.
6. Tags the release `v0.0.x`.
7. Generates consumer-facing release notes using Gemini and creates the official GitHub Release via `gh release create`.

## Generating & Previewing Release Notes

You can generate and preview release notes for any tag or diff using the `generate-release-notes` CLI:

```bash
# Preview notes comparing against the latest tag using Gemini
node --env-file=.env --experimental-strip-types serving/skills-cli/generate-release-notes.ts v0.0.185

# Test deterministic fallback (without API key)
node --experimental-strip-types serving/skills-cli/generate-release-notes.ts v0.0.185
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
cd "$(git rev-parse --show-cdup)" && node serving/skills-cli/build-dist.ts && cd dist/skills-cli && npm install --global .
```

This registers the package globally and places the binaries (`modern-web`) in your `PATH`.

## Architecture Note: The "Single Bundle" Approach

For Claude Code, the `modern-web-guidance` repository acts as a **single bundled plugin** (`googlechrome-skills`) rather than a marketplace catalog of individual plugins.

* **Simplified Installation:** Users only need to run one install command to access the entire suite of curated web development skills.
* **Ecosystem Alignment:** Both Gemini CLI and VS Code natively treat repositories as singular extensions. Consolidating the project into a single plugin ensures structural parity across all environments, cutting down the technical overhead of parsing nested manifests for every individual skill file.
