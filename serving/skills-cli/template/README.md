<p align="center">
  <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/modern-web-guidance.svg" alt="Modern Web Guidance Logo" width="150" />
</p>

# Modern Web Guidance

Inject web platform expertise, best practices, and modern API patterns directly into your AI coding agents.

**Modern Web Guidance** is an agent skill (aka `SKILL.md`) with a CLI that helps coding agents build better web applications using modern, high-performance, accessible, and secure APIs instead of legacy workarounds.

*Supported by the Google Chrome team, the Microsoft Edge team, and the web development community.*

<!-- <LIKE A DEMO VIDEO LOOP OR SOMETHING?> -->

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/terminal.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Quickstart

```shell
npx modern-web-guidance@latest install
```

This command runs an interactive wizard to place the SKILL.md appropriately. See [Alternative Installation Methods](#alternative-installation-methods) below.

#### Try it out (without installing)

```shell
# Search for relevant guides
npx modern-web-guidance@latest search "animate a dialog modal backdrop"

# Retrieve a guide by ID
npx modern-web-guidance@latest retrieve "animate-to-from-top-layer"
```

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/lightbulb.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Why?

Coding agents often default to older patterns because LLM training data contains vast amounts of legacy code. This often leads them to generate bloated JavaScript for tasks that now have native, high-performance web platform solutions.

Even if a model knows an API exists, it often lacks the density of real-world, modern implementation patterns required for production-ready code.

**Modern Web Guidance bridges this gap.** Our skill's CLI returns targeted, expert-curated guidelines directly into your agent's context window, focusing on:
* **Modern Browser APIs**: Helping models correctly structure APIs they frequently misuse.
* **Performance & Accessibility**: Eliminating legacy bloat with clean, native patterns.
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
      <p style="font-size: 0.9em; line-height: 1.4;">Hardened patterns (accessible error announcements, keyboard focus management).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>🤖 Built-in AI</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Local client models (native translation, summarization, and language detection APIs).</p>
    </td>
  </tr>
</table>

_View an example:_ [the `navigation-drawer` guide](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/navigation-drawer.md).

<!-- INJECT_SKILL_COVERAGE -->

### Safe Adoption of Modern Features

* **Progressive Enhancement & Nuanced Fallbacks**: We distinguish between purely additive enhancements (like speculative preloading) which are safe to let older browsers silently ignore, and critical behaviors (like dialog controls or network beacons) where we write highly considered, low-overhead fallbacks.
* **Responsible Fallbacks**: We prioritize lightweight, case-specific custom fallbacks (<50 LOC) or conditionally-loaded polyfills instead of heavy third-party bundles.
* **Gotchas & Quirks**: We document hidden platform limitations, such as the 64KB payload quota for `fetchLater()` or macOS-specific scrollbar behaviors.
* **Baseline-Aware Integration**: We leverage real-time compatibility data from the **Baseline** project so agents can dynamically adapt to current browser support and any browser support preferences.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/cpu.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> How It Works

0. **Activation**: The coding agent activates the `modern-web-guidance` skill because of a relevant task. The agent is instructed to use the `modern-web` CLI for web platform queries.
2. **Local Semantic Search**: The agent runs `modern-web search "<query>"`. The tool matches the query to the best guide using an offline, CPU-efficient TensorFlow.js model (no network calls, no API keys).
3. **Guide Fetch**: The agent retrieves the guide via `modern-web retrieve <guide-id>`, inserting targeted code patterns, gotchas, and fallbacks directly into its context window.

> [!TIP]
> Note: We use `npx` to ensure the content doesn't go stale, but the CLI works offline, completely private and local.
> The NPM package is self-contained, with no extra dependencies to ensure both low-latency and supply-chain security.

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

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/refresh-cw.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Updating

If you installed the skill using `npx modern-web-guidance@latest install`, you can update with: `npx modern-web-guidance@latest update`.

Otherwise, consult your agent's documentation for updating plugins and skills.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/shield-check.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Evals to prove this works well ;)

We developed a robust eval harness to ensure that the content is **empirically proven and continuously calibrated** to ensure AI agents write better code.  We run automated evaluations using a closed-loop validation pipeline:

```
  [ Expert-authored guidance and demo ]
            │
            ▼
  [ Generated assets ] ──> Playwright Grader (.spec.ts) & Negative Demo (.html)
            │
            ▼
  [ Calibration loop ] ───────> Runs Grader on Gold-Standard Demo (Must Pass 100%)
            │                   Runs Grader on Negative Demo (Must Fail 100%)
            ▼
  [ E2E agent evals ] ────────> Runs coding agents in guided vs. unguided modes
                                Compares accuracy w/ and w/o the skill
```

0. **Simulated Developer Tasks**: We define realistic, developer prompts that mimic real-world requests (e.g., "make my images load faster"). The prompts avoid naming APIs or features, testing whether the agent can successfully discover the relevant guides naturally.
1. **Browser-based Assertions**: We write browser automation scripts that verify the guide was followed correctly: exact runtime behaviors, computed styles, accessibility states, etc.
2. **Self-Healing Calibration**: Graders are calibrated against both a reference implementation (100% pass target) and a control page (0% pass target). The agent automatically refines tests on failure.
3. **E2E Testing**: We measure coding agent performance on real tasks with and without guidance. The _opportunity_ (100% - unguided pass rate) and _uplift_ (guided - unguided pass rate) are key. If there's little opportunity, then models already do a great job and our guidance isn't providing much value. Based on the results, we revise guides to maximize the uplift, optimizing their effectiveness.

### Recent eval results snapshot

<!-- INJECT_EVAL_RESULTS -->


## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/boxes.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Available Skill Packs

You can customize which skill packs are installed using the `--choose` flag:

```shell
npx modern-web-guidance@latest install --choose
```

* **`modern-web-guidance`** (~234 tokens): Comprehensive guidance on modern browser APIs, layouts, and performance.
* **`chrome-extensions`** (~181 tokens): Guidance on Manifest V3, background workers, extension APIs, and Chrome Web Store publishing.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/lock.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Telemetry & Privacy

Google collects anonymous usage statistics (such as search queries, guide retrievals, and installation) to improve the reliability, relevance, and performance of the tool. You can inspect what is collected in [modern-web.ts](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/serving/bin/modern-web.ts).

> [!TIP]
> **To Opt-Out:**, set the `DISABLE_TELEMETRY=1` env variable in your shell profile (e.g., `.bashrc` or `.zshrc`):
> ```bash
> export DISABLE_TELEMETRY=1
> ```

Google handles this data in accordance with the [Google Privacy Policy](https://policies.google.com/privacy).

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/users.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Contributors

If you'd like to contribute to modern-web-guidance, please see [source repo's `CONTRIBUTING.md`](https://github.com/GoogleChrome/modern-web-guidance-src/blob/CONTRIBUTING.md). The `modern-web-guidance` repo is a purely a publish target for clean skills installation.

Huge thanks to everyone who has contributed!

<a href="https://github.com/GoogleChrome/modern-web-guidance-src/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GoogleChrome/modern-web-guidance-src" />
</a>

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/file-text.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Attribution

Portions of the documentation in this project are derived from [MDN Web Docs](https://developer.mozilla.org/) by Mozilla Contributors and [W3C](https://www.w3.org/), [WHATWG](https://whatwg.org), and [IETF](https://www.ietf.org) specifications.
