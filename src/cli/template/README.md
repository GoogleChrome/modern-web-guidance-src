<p align="center">
  <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/modern-web-guidance.svg" alt="Modern Web Guidance Logo" width="150" />
</p>

# Modern Web Guidance

[Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance) is a set of skills that embed web platform expertise, best practices, and browser compatibility data directly into your coding agents. It helps to steer your coding agents away from legacy patterns, and instead toward solutions that harness the power and capabilities of the modern web platform.

*Stewarded by the Google Chrome, Microsoft Edge, Mozilla Firefox, and MDN teams, alongside the web development community.*

[Documentation](https://developer.chrome.com/docs/modern-web-guidance) · [Evaluation Dashboard](https://googlechrome.github.io/modern-web-guidance-src/) · [Source Code](https://github.com/GoogleChrome/modern-web-guidance-src) · [Report an Issue](https://github.com/GoogleChrome/modern-web-guidance-src/issues)

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/terminal.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Quickstart

```shell
npx modern-web-guidance@latest install
```

This command runs an interactive wizard to install Modern Web Guidance. See [Alternative Installation Methods](#-alternative-installation-methods) below.

#### Try it out (without installing)

```shell
# Search for relevant guides
npx modern-web-guidance@latest search "animate a dialog modal backdrop"

# Retrieve a guide by ID
npx modern-web-guidance@latest retrieve "animate-to-from-top-layer"

# Scan a codebase for legacy patterns to modernize
npx modern-web-guidance@latest legacy-scan .
```

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/lightbulb.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Why?

Coding agents often default to older patterns because LLM training data contains vast amounts of legacy code. This often leads them to generate bloated JavaScript for tasks that now have native, high-performance web platform solutions.

Even if a model knows an API exists, it often lacks the density of real-world, modern implementation patterns required for production-ready code.

**Modern Web Guidance bridges this gap.** Our skill's CLI returns targeted, expert-curated guidelines directly into your agent's context window, focusing on:
* **Modern Browser APIs**: Helping models correctly structure APIs they frequently misuse.
* **Performance & Accessibility**: Preferring platform-level APIs that can be optimized by the browser and include built-in accessibility affordances.
* **Responsible Fallbacks**: Guiding models to use sensible, lightweight fallbacks instead of heavy polyfills or legacy libraries.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/package.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> What's Included?

We cover the past several years of the web platform's new features, all the way up to the cutting edge. The guides are **designed to be token-efficient**; we run evals enabling us to prune lowest-common-denominator content that models already know.

### Core Disciplines

<table width="100%" style="border-collapse: collapse; border: none;">
  <tr style="border: none;">
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>🎨 User Experience</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Smooth visual states (View Transitions, entry/exit animations, parallax scroll, CSS <code>scrollbar-color</code>).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>📐 CSS Layout</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Modern layout systems (container queries, <code>subgrid</code>, modern color spaces like <code>oklch</code>, text-wrap tuning, and line-height trimming).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>⚡ Performance</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Speed optimizations (instant preloading, Interaction to Next Paint (INP) diagnostics, and scheduling tasks via <code>scheduler.yield</code>).</p>
    </td>
  </tr>
  <tr style="border: none;">
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>📝 Forms & UI</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Native components (Anchor Positioning for tooltips, Popover API, dialogs, <code>:user-invalid</code> validation, and auto-sizing fields).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>♿ Accessibility</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Important considerations (screen reader and keyboard operability, content navigation and discoverability).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>🤖 Built-in AI</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Local client models (native translation, summarization, and language detection APIs).</p>
    </td>
  </tr>
</table>

_View an example:_ [the `navigation-drawer` guide](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/ui-components/navigation-drawer.md).

<!-- INJECT_SKILL_COVERAGE_START -->
<!-- INJECT_SKILL_COVERAGE_END -->

### Safe Adoption of Modern Features

* **Progressive Enhancement & Nuanced Fallbacks**: We distinguish between purely additive enhancements (like speculative preloading) which are safe to let older browsers silently ignore, and critical behaviors (like dialog controls or network beacons) where we write highly considered, low-overhead fallbacks.
* **Responsible Fallbacks**: We prioritize lightweight, case-specific custom fallbacks (<50 LOC) or conditionally-loaded polyfills instead of heavy third-party bundles.
* **Gotchas & Quirks**: We document hidden platform limitations, such as the 64KB payload quota for `fetchLater()` or macOS-specific scrollbar behaviors.
* **Baseline-Aware Integration**: We leverage real-time compatibility data from the **Baseline** project so agents dynamically adapt to current browser support.
* **Origin Trial & Volatile Feature Gates**: Guides covering experimental **Origin Trial** APIs or **volatile features** (single-engine features shipped within the last 3 months or still stabilizing) remain discoverable via `search`, but are gated on `retrieve` so agents do not adopt unstable APIs without explicit developer consent.

### Project Configuration (`.mwgrc`)

Configure Origin Trial and volatile feature opt-ins for a repository with an optional `.mwgrc` JSON file in your project root (or `~/.mwgrc` as a user-level fallback), which you can commit to share across your team:

| CLI Command | `.mwgrc` Key | Effect |
| :--- | :--- | :--- |
| `npx modern-web-guidance@latest set-allow-origin-trials` | `"allowOriginTrials": true` | Unlocks guides for experimental Origin Trial APIs (interactive terminal prompt; set to `false` or remove to opt out). |
| `npx modern-web-guidance@latest set-allow-volatile-features` | `"allowVolatileFeatures": true` | Unlocks guides for volatile single-engine features (interactive terminal prompt; set to `false` or remove to opt out). |

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/cpu.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> How It Works

1. **Activation**: The coding agent activates the `modern-web-guidance` skill because of a relevant task. The agent is instructed to use the `modern-web-guidance` CLI for web platform queries.
2. **Local Semantic Search**: The agent runs `modern-web-guidance search "<query>"`. The tool matches the query to the best guide using an offline, zero-dependency embedding model and BM25 search engine (no network calls, no API keys).
3. **Guide Fetch**: The agent retrieves the guide via `modern-web-guidance retrieve <guide-id>`, inserting targeted code patterns, gotchas, and fallbacks directly into its context window.

> [!TIP]
> Note: We use `npx` to ensure the content doesn't go stale, but the CLI works offline, completely private and local.
> The npm package is self-contained, with no extra dependencies to ensure both low-latency and supply-chain security.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/package.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Alternative Installation Methods

<details>
<summary><b>Vercel Skills CLI</b> (aka <code>npx skills</code>)</summary>

```shell
npx skills add GoogleChrome/modern-web-guidance
```
</details>

<details>
<summary><b>GitHub CLI</b></summary>

```shell
gh skill install GoogleChrome/modern-web-guidance
```
</details>

<details>
<summary><b>Google Antigravity</b></summary>

```shell
agy plugin install https://github.com/GoogleChrome/modern-web-guidance
```
</details>

<details>
<summary><b>Gemini CLI</b></summary>

```shell
gemini extensions install https://github.com/GoogleChrome/modern-web-guidance
```
</details>

<details>
<summary><b>GitHub Copilot CLI</b></summary>

```shell
/plugin marketplace add GoogleChrome/modern-web-guidance
/plugin install modern-web-guidance@googlechrome
```
</details>

<details>
<summary><b>Claude Code Plugin</b></summary>

```shell
/plugin marketplace add GoogleChrome/modern-web-guidance
/plugin install modern-web-guidance@googlechrome
/plugin  # Select GoogleChrome marketplace, press enter, enable AutoUpdate
/reload-plugins
```
</details>

<details>
<summary><b>Grok Build CLI</b></summary>

```shell
grok plugin install https://github.com/GoogleChrome/modern-web-guidance --trust
```
</details>

<details>
<summary><b>Kimi Code</b></summary>

```shell
/plugins install https://github.com/GoogleChrome/modern-web-guidance
```
</details>

<details>
<summary><b>OpenAI Codex</b></summary>

```shell
codex plugin marketplace add GoogleChrome/modern-web-guidance
codex plugin add modern-web-guidance@googlechrome
```
</details>

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/refresh-cw.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Updating

If you installed the skill using `npx modern-web-guidance@latest install`, you can update with: `npx modern-web-guidance@latest update`.

Otherwise, consult your agent's documentation for updating plugins and skills.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/shield-check.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Evals to prove this works well

We developed a robust eval harness to ensure that the content is **empirically proven and continuously calibrated** so AI agents write better code. We run automated evaluations using a closed-loop validation pipeline:

```
  [ Expert-authored guidance, demo & expectations ]
            │
            ▼
  [ Target generation ] ──> Base-app tasks (task.md), golden solution patches & Playwright grader (grader.ts)
            │
            ▼
  [ Calibration loop ] ───> Runs Grader on Golden Solution Patches (Must Pass 100%)
            │               Runs Grader on Unmodified Base App (Must Fail 100%)
            ▼
  [ E2E agent evals ] ────> Runs coding agents in guided vs. unguided modes
                            Compares pass rates and accessibility w/ and w/o the skill
```

1. **Simulated Developer Tasks**: We define realistic developer prompts against full base applications (`daily-grind`, `devtools-times`) that mimic real-world requests (e.g., "make my images load faster"). Prompts avoid naming APIs or features, testing whether the agent can naturally discover and apply the right guides.
2. **Static & Browser-Based Assertions**: Playwright graders (`grader.ts`) verify that each expectation in `expectations.md` was followed—checking source patterns, computed styles, runtime DOM behaviors, and accessibility states.
3. **Self-Healing Calibration**: Graders are calibrated against multi-agent golden solution patches (100% pass target) and an unmodified baseline application (`zero-passrate.patch`, 0% pass target).
4. **E2E Testing**: We measure coding agent performance on real tasks with and without guidance. The _opportunity_ (100% - unguided pass rate) and _uplift_ (guided - unguided pass rate) are key: if models already succeed without guidance, we prune redundant advice; where agents struggle, we refine guides to maximize uplift.

### Recent eval results snapshot

Explore full per-agent and per-guide breakdowns on the **[Evaluation Dashboard](https://googlechrome.github.io/modern-web-guidance-src/)**.

<!-- INJECT_EVAL_RESULTS_START -->
<!-- INJECT_EVAL_RESULTS_END -->


## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/boxes.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Available Skill Packs

You can customize which skill packs are installed using the `--choose` flag:

```shell
npx modern-web-guidance@latest install --choose
```

* **`modern-web-guidance`** (~230 tokens): Comprehensive guidance on modern browser APIs, layouts, and performance.
* **`chrome-extensions`** (~230 tokens): Guidance on Manifest V3, background workers, extension APIs, and Chrome Web Store publishing.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/lock.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Telemetry & Privacy

Google collects anonymous usage information to improve the tool's reliability, relevance, and performance. Collected information includes installation counts, the calling agent name, guide retrieval IDs, and CLI tool search queries generated by the agent (e.g. "dark mode scrollbar color-scheme"). Raw user prompts are not collected. You can inspect what is collected in [modern-web.ts](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/src/cli/modern-web.ts).

> [!TIP]
> **To Opt-Out:** set the `DISABLE_TELEMETRY=1` env variable in your shell profile (e.g., `.bashrc` or `.zshrc`):
> ```bash
> export DISABLE_TELEMETRY=1
> ```

Google handles this data in accordance with the [Google Privacy Policy](https://policies.google.com/privacy).

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/users.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Contributors

Found a bug, outdated pattern, or missing web platform feature? [Open an issue](https://github.com/GoogleChrome/modern-web-guidance-src/issues) or see [`CONTRIBUTING.md`](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/CONTRIBUTING.md) and [`GOVERNANCE.md`](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/GOVERNANCE.md) in the [source repository (`GoogleChrome/modern-web-guidance-src`)](https://github.com/GoogleChrome/modern-web-guidance-src).

Huge thanks to everyone who has contributed!

<a href="https://github.com/GoogleChrome/modern-web-guidance-src/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GoogleChrome/modern-web-guidance-src&max=101" />
</a>

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/file-text.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;">  License

Unless otherwise noted:
* Software code in this project is licensed under the [Apache License 2.0](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/LICENSE).
* Documentation and guide content under `guides/` are licensed under [Creative Commons Attribution 4.0 International (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

Portions of the documentation in this project are derived from [MDN Web Docs](https://developer.mozilla.org/) by Mozilla Contributors and [W3C](https://www.w3.org/), [WHATWG](https://whatwg.org), and [IETF](https://www.ietf.org) specifications.
