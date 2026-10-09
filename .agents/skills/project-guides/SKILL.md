---
name: project-guides
description: Best practices for authoring and reviewing guidance. Use this skill any time you're writing or reviewing `guide.md`, `expectations.md`, or `demo.html` files.
---

# Stage 2: Authoring guidance for a use case (Needs guidance)

This is the second of three stages in creating guidance:

1. Stage 1: Identifying use cases for a feature
2. Stage 2: Authoring guidance for a use case (you are here)
3. Stage 3: Evaluating guidance for a use case

## What a real-world coding agent sees

When a developer asks an AI coding assistant to implement something, the assistant retrieves the relevant `guide.md` via a RAG (vector search) system. **`guide.md` is the only project file a real-world coding agent ever sees.** Everything else in a use case directory is eval infrastructure:

| File/Directory | Purpose | Seen by real-world agents? |
|---|---|---|
| `guide.md` | Guidance for implementing the use case | ✅ Yes — this is the only file |
| `expectations.md` | Verification criteria used to generate target evaluation suites | ❌ No |
| `targets/<base_app>/solution.patch` | Golden diff against clean base app used to calibrate the grader | ❌ No |
| `targets/<base_app>/zero-passrate.patch` | Guidance-absent diff used to verify grader assertions fail when requirements are not implemented | ❌ No |
| `targets/<base_app>/grader.ts` | Playwright test suite run against the eval agent's output | ❌ No |
| `targets/<base_app>/task.md` | Simulated developer prompts fed to the eval agent by the harness | ❌ No |

**Implication for authoring (`guide.md` & `expectations.md`):** Authors and SMEs strictly author `guide.md` and `expectations.md`. You do not hand-author `solution.patch`, `zero-passrate.patch`, `grader.ts`, or `task.md`. Once `guide.md` and `expectations.md` are authored, running `gd dev <guide>` automatically loops across `SUPPORTED_BASE_APPS` (`daily-grind` and `devtools-times`) inside safe temporary `/tmp/` sandboxes to generate and calibrate the evaluation capsules under `targets/<base_app>/`, runs agent evaluations, and produces an evaluation diagnostic report (`results/guides/<category>/<slug>/report.md`). Running `gd pr <guide>` then automatically commits, pushes, detects PR labels (`gd-dev-content` or `gd-dev-eval`), and opens the Pull Request.

**Implication for `guide.md`:** Because `guide.md` is the agent's only source of truth, it must be entirely self-contained. Do not rely on agents reading `expectations.md`, any target patch, or any external link to understand how to implement the use case.

**MANDATORY RULES FOR WRITING `guide.md`:**

### 1. YAML Frontmatter Schema

`guide.md` must start with this YAML frontmatter structure (added in **Stage 1**):

```yaml
---
name: slugified-use-case-name
description: <do thing> <with feature> (e.g., "Create dynamic color systems using modern color syntax")
web-feature-ids:
  - webstatus-feature-id
---
```
* **web-features**: Must be a list of accurate IDs found via webstatus.dev. Include ALL features referenced in the guide body, not just the primary one. If an ID is missing, inform the USER.
  * **Pending Features (`tmp-` prefix)**: If a feature ID is pending upstream in `@web-platform-dx/web-features` (e.g. an open issue), use `tmp-<candidate-slug>` (e.g. `tmp-scroll-axis-lock`) in `guide.md` AND register it in `features/pending-web-features.json` along with its upstream issue link. Optionally add `group` (a web-features group ID like `scrolling`, or an array of them) so ATL triage routes it to that group's owner in `.github/atls.json` (then run `node src/ci/generate-feature-to-groups.ts`), and `compat_features` (a `@mdn/browser-compat-data` key or array of keys, e.g. `["css.properties.scroll-axis-lock"]`) so CI can detect when the feature graduates upstream even if `web-features` chooses a different final ID than `<candidate-slug>`. On the GitHub `new-feature` issue itself, annotate the predicted final ID **without** the `tmp-` prefix (`<candidate-slug>`); the sync and triage scripts automatically strip `tmp-` when matching guides to issues. When the feature ID is officially released upstream in `web-features`, validator checks will automatically fail in CI to prompt updating the frontmatter to the official ID.
* **draft** (optional): Set `draft: true` (or any truthy value, e.g. `draft: future`) to withhold the guide from all distribution (search index, README, skills distribution) without deleting it. Set `draft: stub` when a stub includes author notes in the markdown body so it is still inventoried and validated as a stub. Omit for normal publishing.

### 2. Tone and Formatting

* **Formatting Directives:** Use strict imperative directives (`MANDATORY:`, `DO`, `DO NOT`) only when emphasis is strictly needed (e.g., for critical constraints, security, or common pitfalls). Do not overuse them for every single instruction. Coding agents respond best to rigid constraints when they are selectively applied.
* **Focus & Token Economy (Teach Only the Course-Correction Delta):** Keep the guidance focused on the specific use case and short. No fluff or conversational text. Cut reference-style syntax enumeration and textbook explanations of Baseline Widely Available features that coding agents already know (e.g., how `<label>` or `addEventListener` works). Include a brief overview of the use case and explanation of why the solution outlined in the guide is the recommended approach.
* **Maintainer Notes vs. Agent Rationale (`{# ... #}` vs. Prose/Comments):**
  * **Internal notes for human maintainers:** Use `{# ... #}` comments inside `guide.md` (which [`stripComments()`](../../../src/core/macro-parsing.ts) strips out of the built guide served to agents) for upstream bug links, review history, or why an alternative/polyfill was rejected. Never commit separate `reasoning.md` or `notes.md` files in a guide directory.
  * **Actionable rationale for coding agents:** Put concise "why" explanations directly in `guide.md` prose or inline code comments whenever an agent might otherwise doubt or misapply a non-obvious pattern.
* **Self-Contained:** DO NOT include any external links in the markdown body (`[link text](url)`), and DO NOT rely on internal `{{ GUIDE_REF("...") }}` cross-references to supply required implementation details. All required knowledge to use the feature MUST be fully synthesized into the markdown body (or transcluded at build time via `INCLUDE`/`FEATURE`). Agents must not be slowed down or require additional retrievals to implement the guidance.
* **American English:** Always author guidance in American English (`behavior`, `color`, `synchronize`, `center`, `optimize`, etc.) for consistency across documentation, RAG tokens, and search embeddings.

### 3. Code Snippets

* **No Full-Implementation Code Dumps:** Include short, heavily commented code snippets where every snippet illustrates something the agent cannot infer from the prose above. Replace 50+ line boilerplate blocks with minimal, focused snippets and strip orthogonal details (such as inline SVG icons or arbitrary visual styling).
* Put directives directly in code comments so they are impossible to miss (e.g., `<!-- Always use the required attribute -->`).
* Code comments MUST explain why a value or approach is chosen, not just what the code does. An agent that copies magic values without understanding them will apply them incorrectly. If a value is context-dependent (e.g., a threshold that should vary by use case), say so explicitly.
* **Modern Standards**: Exclusively use ES modules (`import`/`export`) in JavaScript code examples; avoid CommonJS (`require`).
* **Clarifying Arbitrary Values**: Explicitly identify placeholder values (like `2rem` or `50ms`) as example-only in comments to avoid them being mistaken for strict technical constraints.

### 4. Implementation Steps

* The implementation steps should assume any web feature can be used. Choose the best feature for the job, regardless of browser support.
* **DO NOT** suggest modern features just because they are modern. If a modern feature has no distinct user-visible advantage over a legacy feature for the given use case — but will require a more complex fallback implementation — use the legacy feature.
* **Platform-Native Composition & CSS/JS Rigor:**
  * Prefer native platform primitives (`<dialog>`, `[popover]`, `<details>`) over manual re-implementations of top-layer or disclosure behavior (light dismiss, `Escape`, focus restoration, `z-index` stacking).
  * Declare vendor-prefixed pseudo-element selectors (`::-webkit-*`, `::-moz-*`) **once** and drive state variations (`:indeterminate`, reduced motion, colors) via custom properties (`--_prop: var(--prop, default)`). Place vendor-prefixed properties before unprefixed ones.
  * Guard against CSS declarations becoming *invalid at computed-value time* when `var()` or `light-dark()` resolves to an unsupported syntax token (which discards earlier fallback declarations in the same rule and resets the property to `unset`), and never register `light-dark()` design tokens with `@property` `syntax: "<color>"` (which locks them at `:root`).
* **DO NOT** include cross-browser fallbacks in the implementation section. Those should only be mentioned in the fallback section.
* Only mark steps as `MANDATORY` if they are truly required for the feature to function. Optional steps (e.g., adding scroll snap, adding an event listener for progressive enhancement) must be labeled as optional. Incorrect use of `MANDATORY` causes agents to implement unnecessary complexity.
* The guide is the agent's **only** source of truth. DO NOT reference `demo.html` or any other file — agents won't have access to them. Everything the agent needs to implement the use case must be in `guide.md`.
* When listing alternatives, say how to choose between them (which use cases favor which). Optional improvements are alternatives too: the choice is between adding them or not, so say when they're worth adding. Don't invent criteria; if the choice genuinely depends on context you can't anticipate, leave it to the agent.

### 5. Fallback Strategies

If the primary implementation uses features that are not Baseline Widely Available, you **MUST** include a fallback recommendation in this section.

* **Framing:** Frame fallback necessity in terms of Baseline target (e.g., "If your Baseline target does not support X, use...").
* **Assessment:** Start with a broad assessment of the fallback's robustness. Recommend the modern approach if the fallback is robust; highlight complexity/caveats and suggest alternatives (like userland solutions) if it is not.
* **Experience:** **MANDATORY:** Explicitly describe the fallback experience (progressive enhancement vs. feature detection/graceful degradation).
* **Feature Detection:** Checks should be tightly scoped to the interface rather than the instance (e.g. use `Object.hasOwn(HTMLElement.prototype, 'onbeforematch')` over `'onbeforematch' in window`)
* **Fallback Options (in order of preference):**
    1.  **Custom Code:** Short, reliable reimplementation (**<50 lines**) using widely available features.
    2.  **Polyfill:** A robust, performant polyfill (see guidelines below).
    3.  **Abstraction:** A well-tested userland library.
    4.  **Graceful Degradation:** Baseline Newly Available features that degrade gracefully.
    5.  **Progressive Enhancement:** Frame as progressive enhancement only if no robust fallback exists.
* **Faithfulness:** Fallbacks MUST be faithful to the use case. If the primary recommendation gracefully degrades but ultimately doesn't accomplish the core use case, suggest a different fallback if one is available. Graceful degradation **IS** acceptable for features that enhance, but are otherwise not core to the use case.

#### Baseline Status Macros
* **MANDATORY:** Include `{{ FEATURE_FALLBACKS("feature-id") }}` or `{{ BASELINE_STATUS("feature-id") }}` as a standalone line for *every* non-widely available feature used.
  * **When to use `FEATURE_FALLBACKS` vs. `BASELINE_STATUS`:**
    * Prefer `FEATURE_FALLBACKS` when the fallback strategy is reusable across guides and `features/<feature-id>.md` exists with a non-empty `## Fallbacks` section (create `features/<feature-id>.md` if multiple guides share the feature).
    * **Prefer `BASELINE_STATUS` when no `features/<feature-id>.md#fallbacks` entry exists:** If `features/<feature-id>.md` (or its `## Fallbacks` section) does not exist, `FEATURE_FALLBACKS` silently emits *only* the one-line `BASELINE_STATUS` string without a `###` heading or fallback prose. Use `{{ BASELINE_STATUS("feature-id") }}` directly when the fallback strategy is specific to a single guide (writing the fallback inline in `guide.md`), when you need the BCD-key second argument (`{{ BASELINE_STATUS("feature-id", "bcd.key") }}`), or when the feature is Baseline Widely Available and needs no fallback section.
* **Baseline Widely Available Features:** While fallback strategies are not required for Baseline Widely Available features, you **SHOULD** include `{{ BASELINE_STATUS("feature-id") }}` for features that became Baseline Widely Available (`baseline_high_date`) within the last 12 months (such as `subgrid` or `:has()`), or that are commonly misjudged by coding agents as lacking support. This affirmatively reassures coding agents whose training data might predate wide availability that the feature is universally supported without needing defensive fallbacks. Do not conflate `baseline_low_date` (Newly Available) with `baseline_high_date` (Widely Available).
* **No Hard-Coded Browser Support Claims:** Never hard-code browser versions, support matrices, or availability timelines in `guide.md` prose (e.g., *"X is only supported in Chromium"* or *"until X is supported across major browsers"*). Always render availability dynamically via `BASELINE_STATUS` or `FEATURE_FALLBACKS` anchored to a valid `web-feature-id` (or `tmp-*` entry in `features/pending-web-features.json`). Brief factual notes explaining OS/UA integration mechanisms not captured by BCD (such as iOS/macOS Safari's `@domain #code` SMS format for `autocomplete="one-time-code"`) are allowed.
* **Placement:** Use separate subsections with their own macros if multiple features are used. **DO NOT** use these macros outside the fallback section.

#### Polyfill Guidelines
* **Conditional Loading:** **MANDATORY:** ALWAYS conditionally load polyfills only when native support is missing. Prefer build-integrated conditional loading (code splitting) over CDNs.
* **Performance:** **DO NOT** recommend polyfills with significant performance tradeoffs, or those requiring fetching/parsing CSS. Prefer abstractions/userland solutions instead.
* **Prohibited CDNs:** **DO NOT** recommend polyfills from polyfill.io.

### 6. Build-time macros

| Macro | What it emits |
|---|---|
| `{{ BASELINE_STATUS("feature-id"[, "bcd.key"]) }}` | `"Baseline status for <Feature>: Widely/Newly available..."` or `"Browser support for <Feature>: Limited availability"`. |
| `{{ INCLUDE("path[#section]") }}` | Whole markdown file (frontmatter + leading `# H1` stripped) or one section (its heading dropped). Bare paths resolve from repo root; `./`/`../` resolve relative to the calling file. |
| `{{ FEATURE("feature-id", "section") }}` | Sugar for `INCLUDE("features/<feature-id>.md#<section>")`. |
| `{{ FEATURE_FALLBACKS("feature-id") }}` | `### Fallbacks & browser support for <Feature name>` + `BASELINE_STATUS` + the `#fallbacks` section. If `#fallbacks` is empty, emits only `BASELINE_STATUS` (no heading). |
| `{{ FEATURE_ISSUES("feature-id") }}` | `### Issues to be aware of when using <Feature name>` + the `#issues` section. Returns `""` if `#issues` is empty/missing. |
| `{{ GUIDE_REF("guide-slug") }}` | Cross-reference to another guide (`\`guide-slug\` (via \`npx -y modern-web-guidance@latest retrieve "guide-slug"\`)` in `skills-cli`; relative path in `local-dev`; markdown link in `static-site`). |

* **Errors**: invalid feature/guide ID or missing required argument → `MacroError` (build fails loudly). Missing referenced *content* in `INCLUDE`/`FEATURE` (file or section) → `MacroError` for `INCLUDE`/`FEATURE`, or falls back to `BASELINE_STATUS` / `""` for `FEATURE_FALLBACKS` / `FEATURE_ISSUES`.
* **Section IDs**: slugified heading text (`### Fallback strategies` → `fallback-strategies`), or an explicit `{#id}` suffix on the heading. Avoid leaving an explicit `{#section-id}` suffix on a heading in `guide.md` when `slugify(heading)` already matches `#section-id`.
* **Recursion**: macros inside transcluded content expand normally. No cycle detection — don't write self-referential includes.

#### Cross-referencing other guides with `GUIDE_REF`

Coding agents mostly discover and batch-retrieve guides upfront (`retrieve "a,b"`) from `search` or `list` results, and rarely follow cross-references after reading a guide.

* **Never rely on `GUIDE_REF` for requirements of the current guide:** Anything needed to implement *this* guide's use case — core rules, shared prerequisites, accessibility requirements, or fallbacks — must be inlined in `guide.md` or transcluded at build time via `INCLUDE`/`FEATURE`.
* **Use `GUIDE_REF` to point to a separate use case that is out of scope for the current guide:**
  * **Router / orientation hubs** routing to specialized sub-guides (e.g., `passkeys` or `web-components` routing to specific use-case guides).
  * **Disambiguating closely related sibling guides (place upfront before Section 1):** Place disambiguation notes in the introductory overview *before* Section 1 and before any code snippets (e.g., `progress-ring` vs. `spinner` for determinate vs. indeterminate loading, or `hovercard` vs. `interest-triggered-tooltips`). Coding agents anchor heavily on the first code block they see; an upfront fork lets an agent that retrieved the wrong primitive pivot immediately without wasting context.
  * **Referencing an adjacent use case** (e.g., `forms` pointing to `ime-safe-enter-submit` for `Enter`-key submission during IME composition).

### 7. Reusing per-feature content via `features/`

When the same feature-level content (intro, fallback patterns, a11y, gotchas) applies to multiple guides, extract it into `features/<feature-id>.md` and pull it in with the macros above. Rule of thumb: extract if two or more guides cover the same `web-feature-id` and repeat the same advice. Standard section names: `## Fallbacks` (used by `FEATURE_FALLBACKS`), `## Issues` (used by `FEATURE_ISSUES`); add others as needed and pull them with `FEATURE`. Verify your include resolved by inspecting the build output (`out/build/skills-cli/guides/<category>/<id>.md`) — silent misses won't fail the build.

## Authoring `expectations.md` and `demo.html`

### Writing `expectations.md`

Write a natural-language, bulleted list of assertions that must be true if an agent implements `guide.md` correctly (e.g., "The input element is styled with a red border only AFTER a blur event"). Every completed non-stub, non-draft use-case guide must include a non-empty `expectations.md`.

* **1:1 with grader tests:** Each bullet becomes a required must-pass test (`parseExpectations()` treats every top-level bullet as required regardless of `OPTIONAL:` prefixes). Write one bullet per assertion; do not combine multiple checks into a single bullet.
* **Plain declarative phrasing:** Write each bullet as a plain statement of what is true of a correct implementation (e.g., "The dialog closes when the Escape key is pressed"). Strip imperative prefixes such as `MANDATORY:`, `OPTIONAL:`, `MUST`, `MUST NOT`, `DO`, and `DO NOT` — those are a `guide.md` convention for steering coding agents, whereas `expectations.md` is consumed only by the internal grader generator.
* **Concrete, deterministic criteria (ask *"How can a Playwright script know this?"*):** Expectations must be verifiable browser behaviors or DOM structures we can check deterministically with Playwright (computed styles, DOM layout, accessibility tree), not factual statements about an API or criteria requiring human judgment (e.g., write *"Every `<button>` inside a `<form>` sets an explicit `type` attribute"* rather than referencing *"non-submit buttons"* or *"decorative SVGs"*).
* **Exercised in `demo.html`:** Ensure that every expectation written here is actively exercised in the accompanying `demo.html`.
* **Scoped to this use case:** Only include expectations that apply to the specific use case being graded. Do not copy generic expectations from other guides if they describe behavior that won't appear in an implementation of this guide.
* **No external links:** The grader generator cannot resolve them.
* **Avoid over-constraining:** Don't assert implementation details that don't affect correctness (e.g., don't require a direct child relationship if a descendant also works). Never upgrade guide *"Prefer"*, *"Optional"*, or conditional recommendations into unconditional must-pass assertions, never split *"A or B"* alternatives into `AND`-ed tests, and never assert arbitrary snippet example values (`0.4s`, `ease-in-out`). Keep required test DOM locators in `targets/<base_app>/task.md`, never in `guide.md`'s frontmatter `description`.

### Writing `demo.html`

* **Reference implementation:** `demo.html` should be a clean, working implementation of the use case (and its fallback strategy when the target feature is not Baseline Widely Available). Keep it self-contained with inline scripts and styles when possible.
* **Warning-free execution:** Demos must run without browser console errors or warnings to ensure clean evaluation runs.
