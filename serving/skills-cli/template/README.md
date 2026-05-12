# Modern Web Guidance

Inject web platform expertise, best practices, and modern API patterns directly into your AI coding agents.

modern-web-guidance is an agent skill (aka [SKILL.md](http://SKILL.md)) to help ensure that when your coding agent works on a web application, it uses modern, high-performance, accessible, and secure APIs rather than legacy, outdated workarounds.

<!-- <LIKE A DEMO VIDEO LOOP OR SOMETHING?> -->

## Why?

AI coding agents often default to older patterns/libraries because their training data contains vast amounts of legacy code. This often leads them to generate unnecessary, bloated JavaScript for common tasks that are now native.

### Bridging the "High-Recall, Low-Coverage" Knowledge Gap

Every developer knows about the **knowledge cutoff**—but for coding agents, the real issue is **knowledge representation**. Even for web platform features released over the last 10 years, our current frontier models lack the density and coverage of high-quality, modern implementation patterns. The models have *high recall* (they know an API exists) but *low coverage* of actual production best practices.

**This repository bridges that gap.** We don't waste your agent's context on general knowledge it already has. Instead, we inject targeted, high-density, expert-curated guidance specifically focused on:

1. Advanced browser APIs models consistently misuse or fail to structure.  
2. High-performance, accessible, and secure patterns that eliminate legacy bloat.  
3. Responsible cross-browser fallback strategies that models are incapable of inventing on-the-fly.

## What

Our content is evergrowing, but we cover from the bleeding edge of the web platform, through the past several years of new features handling fallback strategies. But **we don't waste your tokens** on stuff models already know.

### Core disciplines

Just a tiny sampling of the **134+ use-case-centric guides**: 

* **User Experience**: Smooth and modern visual states: View Transitions, CSS `scrollbar-color` styling, high-contrast adaptation, entry/exit transition animations, parallax scrolling.  
* **CSS layout:** container queries (both size and style queries), modern color spaces (`oklch`, `color-mix`) and `subgrid`, text-wrap tuning (`balance`, `pretty`), subgrid, and typography line height trimming (`text-box`)  
* **Performance**: instant page preloading, Interaction to Next Paint (INP) diagnostics, and background task scheduling using `scheduler.yield`.  
* **Forms**: auto-sizing input fields (`field-sizing: content`), precise validation with `:user-invalid`, and accent color synchronization.  
* **Native UI Components**: Direct control over dialogs, CSS Anchor Positioning for tooltips, same-document and cross-document View Transitions, and the Popover API.  
* **Accessibility & Security**: accessible error announcements, keyboard focus management.  
* **Built-in AI**: Leveraging local, on-device client models (native Language Detection, Summarization, and Translation APIs).

<!-- INJECT_SKILL_COVERAGE -->

### The modern web platform that you can *use,* safely

* **Responsible Fallbacks**: We don't recommend heavy polyfills that bloat your bundle or block the main thread. Instead, we suggest what an **in-tune senior front-end developer would appreciate**:  
  1. Prioritizing lightweight, case-specific custom implementations (\<50 lines of code).  
  2. Conditional loading of performant polyfills *only* when native support is absent. And avoiding both risky CDNs (like polyfill.io) and CSS-parsing polyfills.  
  3. Using bulletproof prototype-level feature detection rather than naive environment checks.  
* **Gotchas & Quirk Mitigation**: Tricky API boundaries and platform quirks (e.g., the 64KB payload quota for `fetchLater()`, macOS specific scrollbar gutters, and WebKit flickering bugs) are fully documented.  
* **Baseline-Aware Decisions**: Dynamic compatibility data from the Baseline project ensures agents make micro-architectural decisions on-the-fly—applying progressive enhancement conditionally, not blindly.

## How 

### How Coding Agents use our skill 

* **Bootstrapped Awareness**: When loaded, the agent receives a system prompt instruction: *"To use modern web platform APIs, query the `modern-web` tool."*  
* **Semantic Vector Discovery**: The agent executes `modern-web search "<query>"` in your terminal. The tool uses an optimized `MiniLM-L6-v2` TensorFlow.js model running **entirely offline** on your CPU (thx `MiniLM`! No network calls, latency, or API keys required) to calculate the **cosine distance** between the query and our pre-computed guide embeddings.  
* **Precision Retrieval**: The agent executes `modern-web retrieve <guide-id>` to fetch the exact, clean Markdown guidelines it discovered.  
* **State-of-the-Art Generation**: The guide's precise code snippets, DO/DO NOT rules, and responsible cross-browser fallbacks are injected directly into the agent's context window, enabling it to generate clean, modern code instantly.

Token-efficient, targeted, and private guidance injected right into the context window. Yeah, buddy.

## Get started

```shell
npx modern-web-guidance install
```

This will run a quick interactive wizard to install the modern-web-guidance-skill to your preferences, and for your configured agents.

### Not ready to install? All good. Search our guides manually

```shell
# Search for relevant guides
npx modern-web-guidance@latest search "animate a dialog modal backdrop"
# Retrieve a guide by ID
npx modern-web-guidance@latest retrieve "animate-to-from-top-layer"
```

### Alternative installation methods

#### Vercel `skills` CLI: `npx skills add GoogleChrome/modern-web-guidance`

#### Github CLI: `gh skill install GoogleChrome/modern-web-guidance`

#### Google Antigravity: `agy plugin install https://github.com/GoogleChrome/modern-web-guidance`

#### Claude Code plugin

We don't recommend this method, but it will work.

```shell
/plugin marketplace add GoogleChrome/modern-web-guidance
/plugin install modern-web-guidance@googlechrome
/plugin  # Select GoogleChrome marketplace, hit enter, enable AutoUpdate
/reload-plugins
```

## This isn't slop. We've got the evals to prove it. ;)

Every piece of guidance in this pack isn't just a tutorial—it is **empirically proven and continuously calibrated** to guarantee AI agents write better code. We test every guide using an automated quality-assurance harness to ensure correct agent behavior.

### Validation Pipeline

```
  [ SME-Authored Guidance ]
            │
            ▼
  [ Gemini CLI Generator ] ──> Playwright Grader (.spec.ts) & Calibrated Negative Demo (.html)
            │
            ▼
  [ Calibration Loop ] ───────> Runs Grader on Gold-Standard Demo (Must Pass 100%)
            │                   Runs Grader on Negative Demo (Must Fail 100%)
            ▼
  [ E2E Agent Evals ] ────────> Runs coding agents in Guided vs. Unguided modes
                                Compares accuracy pre/post guide injection to prove impact
```

### 1. Real-World, Outcome-Based Assertions

For each guide, we develop a Playwright script (`.spec.ts`) that asserts the guide's implementation details were followed, such as:

* Verifying accessibility tags and computed styles (e.g., `@media (prefers-contrast: more)` overrides).  
* Asserting exact functional layouts and performance behaviors as interpreted by the browser.

### 2. Self-Healing Playwright Calibration

To ensure our test suites aren't nonsense, the pipeline runs a continuous, closed-loop calibration:

* **Golden Master vs. Anti-Pattern**: We run our per-usecase Playwright scripts against both a perfect reference implementation (`demo.html`, expects 100% pass) and a deliberately flawed implementation (`negative-demo.html`, expects 0% pass).  
* **Autonomous Refinement**: If calibration fails, the generator automatically retries with detailed failure context until the grader achieves 100% calibration.

Last, we validate that the calibrated graders aren't taking shortcuts and honor the sanctity of the intent.

### 3. E2E Agent Evals for Every Guide

Finally, we run end-to-end evaluations on real base applications:

* **Unguided (Control)**: The agent addresses a coding task using only its default training data.  
* **Guided (Experiment)**: The agent addresses the exact same task, but with access to this skill pack.

We grade both outputs and only release guides that demonstrate a massive, quantifiable improvement in code quality (e.g., improving success rates from **20% up to 90%**).

# Available Skills

* **`modern-web-guidance`**: (234 tokens) Everything mentioned above  
* **`chrome-extensions`**: (181 tokens) Manifest V3 development, background service workers, content scripts, and extension APIs. Manage Chrome Web Store metadata, permissions justifications, privacy policies, and publishing readiness.

\# Choose which skills you want  
`npx modern-web-guidance install --choose`
