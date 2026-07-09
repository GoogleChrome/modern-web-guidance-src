# Releasing Modern Web Guidance Skills

To release updates for our AI skills (Claude Code, Gemini CLI, and VS Code Extensions), we use an automated pipeline that bundles our source files into a lightweight distribution pack (`dist/`) and pushes it to `GoogleChrome/modern-web-guidance`.

## The Publishing Pipeline

To deploy new changes, simply run the automated publishing script from the project root:

```bash
pnpm --filter serving run publish-skills
```

**What this script does under the hood:**
1. Increments the patch version (`v0.0.x`) across all extension manifests (Gemini, Claude, and VS Code).
2. Executes the build process to bundle all tools, local databases, and metadata, alongside injecting dynamic markdown into the README.
3. Runs integration tests to ensure the `dist/` directory was compiled correctly.
4. Pushes the compiled `dist/` folder to the `main` branch of `git@github.com:GoogleChrome/modern-web-guidance.git`.

## GitHub Releases

While pushing to `main` handles updating the source code, creating a formal **GitHub Release** natively provides the fastest installation experience for Gemini CLI users. 

**However, because the `modern-web-guidance` repository is currently private, creating releases is not practical.**

When unauthenticated users attempt to hit the GitHub API to fetch a release, GitHub returns a `404` error. Because of this, **we skip creating GitHub Releases for now**. Instead:
* **Gemini CLI:** Users run the standard remote installation command (`gemini extensions install https://...`). The CLI will hit a `404` error trying to fetch a release, and will interactively ask the user: *"Would you like to attempt to install via 'git clone' instead?"* The user simply hits 'Y'. This is the expected and perfectly acceptable fallback flow.
* **Claude Code:** Claude ignores GitHub Releases entirely. It only reads the `.claude-plugin/plugin.json` off the `main` branch. The `publish-skills` script bumping this version implies Claude auto-updates will trigger seamlessly without needing a release.

*(Note: Once the repository goes public, we should resume creating GitHub Releases for each version bump to ensure lightning-fast archive downloads for the Gemini CLI!).*

## Local Development & Global Linking

To install and test the compiled package locally as a CLI on your machine:
```bash
cd "$(git rev-parse --show-cdup)" && node serving/skills-cli/build-dist.ts && cd dist/skills-cli && npm install --global .
```

This registers the package globally and places the binaries (`modern-web`) in your PATH.


## Architecture Note: The "Single Bundle" Approach


For Claude Code, the `modern-web-guidance` repository acts as a **single bundled plugin** (`googlechrome-skills`) rather than a marketplace catalog of individual plugins.

* **Simplified Installation:** Users only need to run one install command to access the entire suite of curated web development skills.
* **Ecosystem Alignment:** Both Gemini CLI and VS Code natively treat repositories as singular extensions. Consolidating the project into a single plugin ensures structural parity across all three environments, cutting down the technical overhead of parsing nested manifests for every individual skill file.
