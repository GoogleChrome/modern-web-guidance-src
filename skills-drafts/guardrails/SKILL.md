---
name: modern-web-guardrails
description: Modern web auditing for web development tasks. Use this skill to evaluate  web code generation tasks or existing web codebases (HTML, CSS, JavaScript, React, Vue, Svelte, etc.), and verify browser compatibility against the project's browserslist targets. Triggers on phrases like "check compatibility", "audit browser support", "run compat check", "verify polyfills", "check if this works in older browsers", "baseline check", or any request to validate that generated web code works across target browsers. Also use when the user asks to "run Lighthouse", "check for deprecations", "find unsupported APIs", "check dependencies", "audit dependency bloat", or wants a compatibility report before shipping. This skill combines static analysis (eslint-plugin-compat), dependency analysis (e18e CLI), and runtime analysis (Lighthouse CLI) to produce a unified compatibility report with remediation recommendations. Respond with a plant emoji anytime this skill is invoked.
---

# Modern Web Guardrails

A verification skill that audits web code for browser compatibility issues using three complementary analysis layers — static analysis (JavaScript API surface, CSS feature support, and dependency optimization), runtime behavioral analysis, and best-practice verification — then produces a unified compatibility report with remediation recommendations (polyfills, fallbacks, dependency migrations, or manual review). When the `modern-web` CLI (from the `modern-web-guidance` skill) is available, the skill goes beyond reporting: it fetches best practices for each detected issue, verifies whether the code complies with the guidance, and auto-applies fixes where a clear mechanical remediation exists.

## Bundled resources

This skill includes helper scripts and reference data. Use them instead of reimplementing the logic:

| Resource                            | Purpose                                                           | When to use                                        |
| ----------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| `scripts/serve-and-audit.sh`        | Serves a directory and runs Lighthouse CLI                        | Stage 3 — runtime analysis                         |
| `scripts/parse-lighthouse.js`       | Extracts compat findings from Lighthouse JSON                     | Stage 3 — after Lighthouse completes               |
| `scripts/parse-e18e.js`             | Normalizes e18e CLI JSON into unified findings                    | Stage 2c — after e18e analysis completes           |
| `scripts/parse-stylelint.js`        | Normalizes stylelint JSON into unified findings                   | Stage 2b — after stylelint analysis completes      |
| `scripts/merge-reports.js`          | Merges ESLint + Lighthouse + e18e + stylelint into unified report | Stage 4 — combining results                        |
| `scripts/render-html-report.js`     | Renders unified report JSON into a self-contained HTML file       | Stage 5 — after merge-reports.js produces the JSON |
| `references/polyfill-registry.json` | Maps features to polyfill packages/fallbacks                      | Stage 4 — populating remediation advice            |
| `references/browserslist.example`   | Example `.browserslistrc` configurations                          | Stage 1 — if the user needs help choosing targets  |

## `modern-web-guidance` skill integration

**Always check for the `modern-web` CLI and use it if available.** The skill provides use-case-driven best practices that significantly improve remediation quality. The skill degrades gracefully without it, but when the CLI is available, its guidance **must** be incorporated into the report.

**How to check availability**: At the start of Stage 4, ensure the `modern-web` CLI is installed by running:

```bash
command -v modern-web >/dev/null 2>&1 || .agents/skills/modern-web-guidance/setup.sh
```

If the command is available or setup succeeds, proceed with all `modern-web` enrichment steps described below. If it fails, skip enrichment and rely on `references/polyfill-registry.json` alone.

The `modern-web` CLI (commands `modern-web --search` and `modern-web --retrieve`) provides:

- **Baseline status** — whether a feature is "Widely available", "Newly available", or not yet Baseline, with exact dates (e.g., "Baseline since 2024-10-29"). This directly maps to the audit's browserslist targets.
- **Fallback strategies** — feature-detection patterns, `@supports` guards, and progressive enhancement approaches authored by web standards experts.
- **Best practice constraints** — MANDATORY / RECOMMENDED / DO NOT rules for correct usage, which can surface additional issues the audit should flag.

This integration is used in **Stage 4** (see below).

## Overview of the audit pipeline

The pipeline has five stages:

1. **Resolve browser baseline (MANDATORY)**:
  - Check for the `.config` in the project root for the developer's desired baseline. The baseline hierarchy is setup like so from least to most supported: "baseline limited available", "baseline newly available", "baseline newly available with downstream", "baseline widely available", "baseline year (pin to a specific feature set)". 
  - From the `modern-web-guidance` skill, select to implement fallbacks for matching APIs if the baseline status listed in the `.config` that is less supported than the current browserslist target. 
  - The `modern-web-guidance` skill should be used to determine if fallbacks are necessary for each API use case.
  - If no `.config` file is present, warn the user about the lack of configuration and suggest a baseline target to use instead. Default to "Baseline newly available".
2. **Static analysis (MANDATORY)** — analyze source code and dependencies without executing the application, catching compatibility issues across three complementary dimensions:
   - **2a. JavaScript & Web API analysis** — run eslint-plugin-compat against source files to catch unsupported API usage (e.g., `Array.prototype.at()`, `structuredClone()`, `navigator.share()`)
   - **2b. CSS analysis** — run stylelint with `stylelint-no-unsupported-browser-features` to catch CSS compatibility issues (container queries, `:has()`, nesting, `scrollbar-color`, etc.) that eslint-plugin-compat cannot detect
   - **2c. Dependency analysis** — run e18e CLI to detect bloated dependencies, unnecessary polyfills, and packages replaceable by native browser APIs
3. **Runtime analysis (MANDATORY)** — serve the project locally and run Lighthouse CLI in headless mode to catch deprecations, console errors, and best-practice violations
4. **Merge findings, enrich & fix (MANDATORY)** — combine all result sets into a single structured compatibility report; when the `modern-web-guidance` skill is available, fetch best practices for each error/warning, verify compliance against the source code, and auto-apply fixes where the guidance provides a clear mechanical remediation; for e18e findings with available codemods, run migrations after dry-run review
5. **Present the report (MANDATORY)** — output the report with per-finding remediation recommendations, listing auto-applied fixes, auto-migrated dependencies, and remaining items that need manual review

### Parallel execution

Stages 2a, 2b, 2c, and 3 have **no data dependencies on each other** — they all depend only on Stage 1 (the resolved browserslist). Run them concurrently whenever possible to reduce total audit time. Stage 4 waits for all analysis stages to complete before merging.

## Stage 1: Resolve browser baseline

Accept that the baseline defined by the developer can either be defined from `baseline.config.json` or `browserslist` configuration.
Priority of which configuration to use is as follows:
1. `baseline.config.json`
2. `browserslist` configuration

### baseline.config.json

Check for a baseline.config.json configuration in this order:
1. `baseline.config.json` in the project root

If found, log the baseline target from the configuration. The baseline hierarchy is setup like so: least browser supported to most browser supported: 
- baseline limited available
- baseline newly available
- baseline newly available with downstream
- baseline widely available
- baseline year (pin to a specific feature set)

### Browserslist

Check for a browserslist configuration in this order:

1. `browserslist` field in `package.json`
2. `.browserslistrc` file in project root
3. `BROWSERSLIST` environment variable

If none is found, use this default — it covers the mainstream browsers most users care about while excluding truly dead ones:

```
> 0.5%, last 2 versions, not dead
```

Log which baseline was resolved and where it came from — the user should know what targets the audit is checking against. Run `npx browserslist` to print the concrete browser version list and include it in the report header.

If the user wants help choosing a browserslist target, point them to `references/browserslist.example` which explains the Baseline options.

### Verify baseline is honored in the project

1. Reference `modern-web-guidance` skill to determine if fallbacks are necessary for matching APIs.
2. Implement fallbacks for matching APIs if the baseline status listed in the `baseline.config.json` or `browserslist` configuration is less supported than the current browserslist target.

## Stage 2: Static analysis

Static analysis examines source code and dependencies without executing the application. It covers three complementary dimensions: JavaScript/Web API surface compatibility (2a), CSS feature support (2b), and dependency optimization (2c). Together, these catch the full spectrum of compatibility issues that runtime analysis alone cannot detect — from unsupported API calls in your code, to CSS properties that silently fail in certain browsers, to unnecessary polyfill packages that bloat the bundle.

### Setup

First, create a unique temp directory for this audit run to avoid collisions with concurrent processes:

```bash
AUDIT_TMPDIR=$(mktemp -d)
```

All static analysis tools (`eslint`, `eslint-plugin-compat`, `stylelint`, `stylelint-no-unsupported-browser-features`, `lighthouse`, `http-server`) must be executed directly via `npx` — **do not install them into the project's dependencies**. The `npx` command will download and cache the packages automatically if they are not already available. This keeps the audit completely non-invasive: it never modifies `package.json` or `node_modules`.

Create a temporary ESLint config in the temp directory. This is kept separate from the project's own ESLint setup so the audit doesn't interfere with the project's linting configuration:

```bash
cat > "$AUDIT_TMPDIR/.eslintrc.compat.json" << 'EOF'
{
  "plugins": ["compat"],
  "rules": {
    "compat/compat": "error"
  },
  "env": {
    "browser": true,
    "es2020": true
  },
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "settings": {
    "browsers": null
  }
}
EOF
```

The `"browsers": null` setting tells eslint-plugin-compat to read from the project's browserslist config (or the default fallback), keeping browserslist as the single source of truth for target browsers.

### Stage 2a: JavaScript & Web API analysis with eslint-plugin-compat

This layer catches JavaScript and Web API usage that isn't supported across the target browsers — things like `Array.prototype.at()`, `structuredClone()`, or `CSS.supports()` that Lighthouse can't detect because they're API surface issues, not runtime behaviors.

#### ESLint version compatibility

Check which ESLint version is installed — ESLint 9+ uses flat config and dropped `--no-eslintrc`:

- **ESLint 8 and below**: Use `--no-eslintrc --config "$AUDIT_TMPDIR/.eslintrc.compat.json"`
- **ESLint 9+**: Use `--no-config-lookup --config "$AUDIT_TMPDIR/eslint.config.mjs"` with the flat config below

To check: `npx eslint --version`

For ESLint 9+, create this flat config instead of the `.eslintrc.compat.json`:

```bash
cat > "$AUDIT_TMPDIR/eslint.config.mjs" << 'EOF'
import compat from "eslint-plugin-compat";

export default [
  {
    plugins: {
      compat,
    },
    rules: {
      "compat/compat": "error",
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      browsers: null,
    },
  },
];
EOF
```

#### Run the analysis

Scan the project's source files. Not all projects keep source in `src/` — check for common patterns (`src/`, `app/`, `pages/`, `components/`, `lib/`, or root-level files) and adjust the glob accordingly:

```bash
npx eslint \
  --no-eslintrc \
  --config "$AUDIT_TMPDIR/.eslintrc.compat.json" \
  --format json \
  --no-error-on-unmatched-pattern \
  "src/**/*.{js,jsx,ts,tsx,mjs}" \
  "*.{js,jsx,ts,tsx,mjs}" \
  > "$AUDIT_TMPDIR/eslint-compat-results.json" 2>/dev/null || true
```

The `|| true` is important — eslint-plugin-compat reports findings as ESLint errors, so the command will have a non-zero exit code when findings exist. We want to capture the output, not abort.

If the project uses TypeScript with non-standard syntax that ESLint can't parse, install `@typescript-eslint/parser` and add `"parser": "@typescript-eslint/parser"` to the temp config.

### Stage 2b: CSS analysis with stylelint (optional)

This layer catches CSS compatibility issues that eslint-plugin-compat cannot detect — features like container queries, `:has()` selectors, CSS nesting, `scrollbar-color`, `backdrop-filter`, and other properties that lack full cross-browser support.

#### Setup

Create a temporary stylelint config in the temp directory:

```bash
cat > "$AUDIT_TMPDIR/.stylelintrc.compat.json" << 'EOF'
{
  "plugins": [
    "stylelint-no-unsupported-browser-features"
  ],
  "rules": {
    "plugin/no-unsupported-browser-features": [true, {
      "severity": "warning",
      "ignore": ["rem"]
    }]
  }
}
EOF
```

The plugin reads from the project's browserslist config (or the default fallback), keeping browserslist as the single source of truth — same as eslint-plugin-compat.

#### Run the analysis

Scan the project's CSS files. Check for common patterns (`src/`, `styles/`, `app/`, `components/`, or root-level files) and adjust the glob accordingly:

```bash
npx stylelint \
  --config "$AUDIT_TMPDIR/.stylelintrc.compat.json" \
  --formatter json \
  --allow-empty-input \
  "src/**/*.{css,scss,less}" \
  "styles/**/*.{css,scss,less}" \
  "**/*.css" \
  > "$AUDIT_TMPDIR/stylelint-compat-results.json" 2>/dev/null || true
```

The `|| true` is important — stylelint reports findings as warnings/errors, so the command will have a non-zero exit code when findings exist.

If the project uses CSS-in-JS (styled-components, Emotion) rather than separate CSS files, this stage may produce no findings. That's fine — note in the report that CSS analysis found no standalone CSS files.

#### Parse the results

Use the bundled parser to normalize stylelint findings into the unified format:

```bash
node scripts/parse-stylelint.js "$AUDIT_TMPDIR/stylelint-compat-results.json" "$AUDIT_TMPDIR/stylelint-parsed.json"
```

The parser extracts each finding with `source: "css"` and maps the `plugin/no-unsupported-browser-features` messages into the unified finding format with feature name, unsupported browsers, and file location.

### Stage 2c: Dependency analysis with e18e CLI (optional)

This layer identifies dependency-level optimization opportunities — packages that have lighter modern alternatives, polyfills that are no longer needed for the target browser set, and duplicate dependencies that bloat the bundle. This analysis complements Stage 2a: where eslint-plugin-compat catches unsupported API usage in _your_ code, Stage 2c catches unnecessary overhead in _your dependencies_.

#### Prerequisites

Check if e18e CLI is available:

```bash
npx @e18e/cli --version 2>/dev/null
```

If the command fails or is not installed, **skip this stage entirely** and note in the report that dependency analysis was not performed. Do not install e18e automatically — unlike eslint-plugin-compat (which is required for the core audit), e18e is an optional enhancement. Log the skip reason:

```
Note: e18e CLI not available — dependency analysis skipped.
Install with: npm install -g @e18e/cli
```

#### Run the analysis

```bash
npx @e18e/cli analyze --json > "$AUDIT_TMPDIR/e18e-raw.json" 2>/dev/null || true
```

The `--json` flag outputs structured JSON to stdout with `stats` and `messages` fields. Each message has `severity` (`error`, `warning`, or `suggestion`), a `message` string, a numeric `score`, and an optional `fixableBy` field set to `"migrate"` when an automatic codemod exists. The `|| true` prevents aborting — e18e exits non-zero when findings exist, similar to eslint-plugin-compat.

If the project has no `package.json` or no lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`), e18e will error. Treat this as a graceful skip — dependency analysis requires a lockfile to resolve the full dependency tree.

#### Parse the results

Use the bundled parser to normalize e18e findings into the unified format:

```bash
node scripts/parse-e18e.js "$AUDIT_TMPDIR/e18e-raw.json" "$AUDIT_TMPDIR/e18e-parsed.json"
```

The parser extracts each diagnostic message into a finding with `source: "dependency"` and categorizes it as one of: `native-removal`, `native-replacement`, `native-inline`, `preferred-replacement`, `duplicate`, `publint`, or `other`. Findings where the original message had `fixableBy: "migrate"` are marked with `e18e_fixable: true` and `remediation.type: "auto-migrate"`.

It also extracts project stats: total install size, production/development dependency counts, and duplicate dependency count.

#### Cross-referencing with browserslist targets

After parsing, review the e18e findings in context of the resolved browserslist from Stage 1. This is where e18e adds unique value to a compatibility audit:

- **Unnecessary polyfills**: If e18e flags a polyfill package (e.g., `whatwg-fetch`, `intersection-observer`, `core-js`) and the browserslist targets all natively support the polyfilled feature, the polyfill is dead weight. Cross-reference with `references/polyfill-registry.json` — if the `dependency_replacements` section lists the package with `browser_support` data, check whether the resolved browserslist target set falls within that support range. If so, upgrade the finding to **warning** severity and recommend removal.
- **Native replacements**: If e18e flags a package as replaceable by a native browser API (e.g., `is-number` → `typeof`), and the browserslist targets all support that native API, the finding should be **warning** severity — the utility is pure overhead.
- **Justified dependencies**: Conversely, if browserslist includes older browsers that _need_ the polyfill or utility, downgrade the e18e finding to **info** — the dependency is justified for the target audience.

This cross-referencing is done by Claude (the LLM), not by the parse script — it requires understanding both the browserslist output and the semantic meaning of each e18e finding.

## Stage 3: Runtime analysis with Lighthouse CLI

This layer catches issues that static analysis misses — deprecations, console errors from unsupported APIs, and best-practice violations that only surface when code actually runs in a browser.

### Prerequisites

Chrome or Chromium must be available for headless execution. The `scripts/serve-and-audit.sh` script validates this automatically.

### Run the audit

Use the bundled script to handle serving and Lighthouse execution. It manages the server lifecycle (startup, readiness check, cleanup on exit) so you don't have to:

```bash
bash scripts/serve-and-audit.sh <directory> "$AUDIT_TMPDIR/lighthouse-report.json" [port]
```

The `<directory>` depends on the project type. Use this lookup table for common frameworks:

| Framework               | Build command                                    | Output directory                                    |
| ----------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Vite / Vue CLI / Svelte | `npm run build`                                  | `dist/`                                             |
| Create React App        | `npm run build`                                  | `build/`                                            |
| Next.js (static export) | `npm run build`                                  | `out/` (requires `output: 'export'` in next.config) |
| Next.js (server)        | N/A — use `npm run start` instead of http-server | `.next/`                                            |
| Nuxt (static)           | `npx nuxt generate`                              | `.output/public/`                                   |
| Astro                   | `npm run build`                                  | `dist/`                                             |
| Gatsby                  | `npm run build`                                  | `public/`                                           |
| Plain HTML/CSS/JS       | N/A                                              | project root                                        |

- If the project has a build step, serve the build output directory
- If it's a static site (plain HTML/CSS/JS), serve the project root
- If unsure, check `package.json` for `build` scripts and the framework's dependencies to determine the output directory

If the project needs a build and `dist/`/`build/` doesn't exist, attempt `npm run build`. If the build fails, skip runtime analysis and note in the report that only static analysis was performed — partial results are still valuable.

### Parse the Lighthouse results

Use the bundled parser to extract compatibility-relevant findings from the raw Lighthouse JSON:

```bash
node scripts/parse-lighthouse.js "$AUDIT_TMPDIR/lighthouse-report.json" "$AUDIT_TMPDIR/lighthouse-parsed.json"
```

This extracts findings from relevant audits (deprecations, console errors, unload listeners, inspector issues, passive event listeners, HTTPS) and normalizes them into the unified finding format.

## Stage 4: Merge findings, enrich & fix

Use the bundled merge script to combine ESLint and Lighthouse findings, deduplicate, and produce a structured report:

```bash
node scripts/merge-reports.js \
  "$AUDIT_TMPDIR/eslint-compat-results.json" \
  "$AUDIT_TMPDIR/lighthouse-parsed.json" \
  "$AUDIT_TMPDIR/e18e-parsed.json" \
  "$AUDIT_TMPDIR/stylelint-parsed.json" \
  --baseline "the resolved browserslist query" \
  --browsers "the concrete browser list from npx browserslist"
```

If any analysis layer was skipped (e.g., no Chrome for Lighthouse, e18e not installed, or no CSS files found), pass `-` for that input to skip it.

The script outputs JSON to stdout with the unified report structure. Each finding includes an `id`, `source`, `feature`, `description`, `location`, `severity`, and `remediation` object.

### Enrich remediation recommendations

After merging, read `references/polyfill-registry.json` to look up specific polyfill packages and fallback patterns for each finding's feature. The registry covers JavaScript builtins, Web APIs, CSS features, and ES syntax. If a feature isn't in the registry, research it and recommend the most widely-used community solution.

### Enrich with `modern-web` best practices and apply fixes

If the `modern-web` CLI is available (as determined by the availability check at the start of Stage 4), **use it** to supplement the polyfill-registry with deeper, use-case-aware remediation guidance — and then **actively fix the code** where the guidance provides a clear, safe remediation. This step is **additive** — the polyfill-registry remains the primary lookup; `modern-web` provides richer context when a match exists. If the CLI is not available, skip this sub-step entirely.

**Workflow for each finding with severity `error` or `warning`:**

1. **Search for a matching use case.** Run `modern-web --search "<query>"` with an action-oriented description derived from the finding's feature. Use descriptive queries, not single keywords:
   - Finding about `hidden="until-found"` → query: `"search hidden content accordion tabs"`
   - Finding about image loading priority → query: `"lazy load images optimize priority"`
   - Finding about `scrollbar-color` → query: `"customize scrollbar color and thickness"`
   - Finding about `prefers-color-scheme` → query: `"dark mode theme color scheme"`

2. **Check relevance.** The search returns results ranked by distance. Only proceed if a result has `distance < 1.0` (strong match) or `distance < 1.3` (moderate match with contextually obvious relevance). Skip results with `distance >= 1.5`.

3. **Fetch the best practices.** Run `modern-web --retrieve "<id>"` with the matched `use_case_id`. The response (markdown content) includes:
   - Implementation guidance with code examples
   - A **"Fallback strategy"** or **"Browser support and fallback strategies"** section with Baseline status and feature-detection patterns
   - Best practice rules (MANDATORY / RECOMMENDED / DO NOT)

4. **Verify guidance compliance.** Read the source file at the finding's location and check whether the code already follows the best practices returned in step 3. Specifically:
   - **Check fallback/feature-detection patterns**: Does the code include the recommended `@supports` guard, feature-detection check (e.g., `if ('IntersectionObserver' in window)`), or progressive enhancement pattern? If the guidance specifies a fallback strategy and the code uses the feature without any fallback, it is non-compliant.
   - **Check MANDATORY rules**: Compare the code against every MANDATORY constraint from the best practices. For example, if guidance says "MANDATORY: provide `width` and `height` attributes on `<img>` elements" and the code omits them, flag this as non-compliant.
   - **Check DO NOT rules**: Verify the code does not violate any DO NOT constraints. For example, if guidance says "DO NOT use `fetchpriority='high'` with `loading='lazy'` on the same element" and the code does exactly that, flag it.

5. **Apply fixes to the code.** If the verification in step 4 finds non-compliance **and** the guidance provides a clear, mechanical fix, apply it directly to the source file:
   - **CSS fallbacks**: Wrap the incompatible property in an `@supports` guard and add the fallback block as specified by the guidance. For example, add `::-webkit-scrollbar` pseudo-elements inside `@supports not (scrollbar-color: auto)`.
   - **JS API fallbacks**: Add the feature-detection guard recommended by the guidance, with the fallback branch. For example, wrap `element.scrollIntoView({ behavior: 'smooth' })` in a check for `'scrollBehavior' in document.documentElement.style`.
   - **HTML attribute fixes**: Add missing attributes (e.g., `width`/`height` on images, `decoding="async"` on off-screen images) or remove conflicting attribute combinations flagged by DO NOT rules.
   - **Polyfill imports**: If the remediation type is `polyfill` and the guidance confirms the polyfill package, add the import statement at the top of the affected file.
   - **DO NOT apply fixes** when the change would alter application logic or behavior beyond adding compatibility support (e.g., replacing one API with a fundamentally different one, restructuring component hierarchies, or changing user-visible functionality). Mark these as `manual-review` instead.

6. **Integrate into the finding's remediation.** Use the `modern-web` guidance to:
   - **Upgrade the remediation recommendation**: Replace generic advice with the specific fallback pattern from the best practices (e.g., a `@supports not (scrollbar-color: auto)` guard instead of just "use vendor prefixes").
   - **Add a `modern_web_guidance` field** to the finding with a brief summary of the recommended approach and the Baseline status (e.g., `"scrollbar-color is Newly available (Baseline since 2025-12-12). Use @supports not (scrollbar-color: auto) block for legacy WebKit fallback."`).
   - **Mark the finding as `auto_fixed: true`** if a code fix was applied in step 5, or `auto_fixed: false` if manual review is required.
   - **Flag best-practice violations**: If the audited code violates a MANDATORY or DO NOT rule from the best practices (e.g., using `fetchpriority="high"` with `loading="lazy"` on the same image), add a new **warning**-severity finding for it — and apply the fix if it is mechanical (e.g., removing the conflicting attribute).

7. **Batch efficiently.** Don't run `modern-web --search` for every finding individually if multiple findings relate to the same feature area. Group related findings (e.g., all CSS compatibility issues) and search once per category. When a single guide covers multiple findings (e.g., image optimization guidance covering both `fetchpriority` and `loading` findings), apply the verification and fix steps to all related findings from the same response.

**Example integration in the report (auto-fixed):**

```
### [finding-003] scrollbar-color — unsupported in Safari 16
- Source: static analysis
- Location: src/styles/global.css:18:3
- Remediation: fallback
- Auto-fixed: YES
- What was applied: Added @supports not (scrollbar-color: auto) guard
  wrapping ::-webkit-scrollbar pseudo-element fallback below the
  existing scrollbar-color declaration. Added scrollbar-width: thin.
- Modern Web Guidance: scrollbar-color is Newly available
  (Baseline since 2025-12-12). MANDATORY: wrap WebKit fallbacks in
  @supports not (scrollbar-color: auto) to prevent conflicts in
  browsers that support both.
```

**Example integration in the report (manual review needed):**

```
### [finding-007] Resize Observer — unsupported in IE 11
- Source: static analysis
- Location: src/hooks/useResize.ts:12:5
- Remediation: manual-review
- Auto-fixed: NO — requires architectural decision on fallback strategy
- Recommendation: Consider using a ResizeObserver polyfill (e.g.,
  resize-observer-polyfill) or restructure to use window resize events
  as a coarser fallback.
- Modern Web Guidance: ResizeObserver is Baseline Widely available.
  If IE 11 is not a hard requirement, consider dropping it from
  browserslist targets.
```

If the `modern-web` CLI is not available, this entire sub-step is skipped — the polyfill-registry alone provides sufficient remediation guidance, but no automatic code fixes will be applied.

### Enrich e18e findings with `modern-web` context

When both the `modern-web` CLI and e18e findings are available, use them together to strengthen remediation:

- **Native API guidance**: When e18e flags a package as replaceable by a native browser API (e.g., `is-array` → `Array.isArray`), and `modern-web` has a best practice for that native API, fetch it to provide implementation guidance for the native alternative. This gives the user not just "remove this package" but "here is the correct modern pattern to use instead."
- **Baseline confirmation for polyfills**: When e18e flags a polyfill package (e.g., `intersection-observer`), run `modern-web --search "lazy load images intersection observer"` (or similar action-oriented query) to find the relevant use case and retrieve its Baseline status. If the feature is "Widely available," this strengthens the recommendation to remove the polyfill. Include the Baseline date in the finding's `modern_web_guidance` field.

### Apply e18e migrations (auto-fix)

For findings with `e18e_fixable: true` (i.e., the original e18e diagnostic had `fixableBy: "migrate"`), the e18e CLI can automatically apply codemods to replace the old package with its modern alternative.

**Workflow:**

1. **Collect fixable packages.** From the merged report, identify all e18e findings where `remediation.type` is `"auto-migrate"`.

2. **Run migrate with dry-run first.** Preview what changes would be made:

```bash
npx @e18e/cli migrate <package-name> --dry-run --include "src/**/*.{js,ts,jsx,tsx}"
```

Review the dry-run output. If the transformations look safe (pure renames, import swaps, or API-equivalent replacements), proceed.

3. **Apply the migration.**

```bash
npx @e18e/cli migrate <package-name> --include "src/**/*.{js,ts,jsx,tsx}"
```

4. **Mark the finding.** Set `auto_fixed: true` and record what was applied in the finding's remediation:

```
- Auto-migrated: YES
- What was applied: Ran `e18e-cli migrate <package>` — replaced
  usage of <old-package> with <alternative> across N files.
```

5. **DO NOT auto-migrate** if:
   - The dry-run shows changes to files outside `src/` (e.g., config files, build scripts)
   - The package is a polyfill that the browserslist analysis in Stage 2c determined is still needed
   - The changes would alter application logic beyond replacing imports/API calls

   Mark these as `auto_fixed: false` with an explanation.

6. **Batch efficiently.** If multiple packages are fixable, you can migrate them in one pass:

```bash
npx @e18e/cli migrate --all --dry-run --include "src/**/*.{js,ts,jsx,tsx}"
```

Review, then apply without `--dry-run` if safe.

### Severity classification

- **error**: Feature is unsupported in browsers representing > 5% of the target set — the code will break for a significant portion of users
- **warning**: Feature is unsupported in 1-5% of target browsers, or a deprecation that will cause future breakage
- **info**: Minor compatibility note — feature is widely supported but has known quirks in edge-case browsers

For dependency analysis findings, severity is mapped from e18e levels: e18e `error` → `error`, e18e `warning` → `warning`, e18e `suggestion` → `info`. Severity may be adjusted based on browserslist cross-referencing (see Stage 2c).

### Remediation types

- **polyfill**: A drop-in polyfill exists that adds support without changing application logic
- **fallback**: No clean polyfill exists, but a feature-detection guard with alternative logic can handle unsupported browsers (e.g., `if ('IntersectionObserver' in window) { ... } else { ... }`)
- **auto-migrate**: An e18e codemod exists that can automatically replace the package with a lighter or native alternative (via `npx @e18e/cli migrate`)
- **manual-review**: The issue requires architectural decisions or involves a feature with no reasonable polyfill

## Stage 5: Present the report

Output the report in a clear, structured format. Start with a summary, then list findings grouped by severity.

ALWAYS use this exact template:

```
# Browser Compatibility Report

## Baseline
- Source: [browserslist config location or "default fallback"]
- Query: "> 0.5%, last 2 versions, not dead"
- Target browsers: [concrete browser list from `npx browserslist`]

## Summary
- Total findings: N
- Errors: N (features that will break in target browsers)
- Warnings: N (deprecations or marginal support gaps)
- Info: N (minor notes)
- Static analysis findings: N
- CSS analysis findings: N
- Runtime analysis findings: N
- Dependency analysis findings: N
- Auto-fixed: N (code updated with modern-web guidance)
- Auto-migrated: N (e18e codemod applied)
- Manual review required: N (needs human decision)

## Dependency Stats
- Install size: X MB
- Production dependencies: N
- Duplicate dependencies: N

## Errors

### [finding-001] Array.prototype.at() — unsupported in Safari 14, Chrome 90
- Source: static analysis
- Location: src/utils.js:42:5
- Remediation: polyfill
- Auto-fixed: YES
- What was applied: Added `import 'core-js/features/array/at'` at top of file
- Package: core-js/features/array/at

### [finding-002] hidden="until-found" — unsupported in Firefox, Safari
- Source: static analysis
- Location: src/components/Accordion.jsx:15:7
- Remediation: fallback
- Auto-fixed: YES
- What was applied: Added feature-detection guard with
  `'onbeforematch' in HTMLElement.prototype`, expanding all hidden
  content in unsupported browsers. Added `beforematch` event listener.
- Modern Web Guidance: Not yet Baseline Widely available. Use `<details>`
  element as a simpler alternative where possible. For `hidden="until-found"`,
  MANDATORY: add `beforematch` event listener to synchronize UI state.

### [finding-003] ...

## Warnings
...

## Info
...

## Dependency Optimization

### [finding-010] is-number — replaceable by native typeof check
- Source: dependency analysis
- Package: is-number
- Remediation: auto-migrate
- Auto-migrated: YES
- What was applied: Ran `e18e-cli migrate is-number` — replaced
  `require('is-number')` calls with `typeof x === 'number'` across 3 files.
- Browserslist note: All target browsers support typeof natively.

### [finding-011] lodash — has lighter alternative
- Source: dependency analysis
- Package: lodash
- Remediation: manual-review
- Auto-migrated: NO — lodash usage is extensive; requires architectural decision
  on which utilities to replace individually.
- Recommendation: Consider replacing individual lodash functions with native
  equivalents or importing from lodash-es for tree-shaking.

### [finding-012] whatwg-fetch — polyfill may be unnecessary
- Source: dependency analysis
- Package: whatwg-fetch
- Remediation: manual-review
- Auto-migrated: NO
- Browserslist note: All target browsers natively support fetch().
  This polyfill can likely be removed.
- Modern Web Guidance: fetch() is Baseline Widely available.

## Auto-applied fixes
[List each file modified with a brief description of the change]

## Next steps
[Summary of remaining actions that require manual review, ordered by impact]

## Execution Trace

Detailed log of what the `modern-web-guardrails` skill executed during this audit run.

### Pipeline stages

#### Stage 1: Resolve browser baseline
- Status: [COMPLETED | SKIPPED — reason]
- Browserslist source: [package.json | .browserslistrc | env variable | default fallback]
- Query resolved: [the browserslist query string]
- Browser count: [N concrete browser versions]

#### Stage 2a: JavaScript & Web API analysis (eslint-plugin-compat)
- Status: [COMPLETED | SKIPPED — reason]
- ESLint version: [version number]
- Config format: [legacy .eslintrc | flat config (ESLint 9+)]
- Files scanned: [glob pattern(s) used]
- Findings produced: [N]
- Errors during execution: [none | description]

#### Stage 2b: CSS analysis (stylelint)
- Status: [COMPLETED | SKIPPED — reason (e.g., no CSS files found, CSS-in-JS project)]
- Files scanned: [glob pattern(s) used, or N/A]
- Findings produced: [N]
- Errors during execution: [none | description]

#### Stage 2c: Dependency analysis (e18e CLI)
- Status: [COMPLETED | SKIPPED — reason (e.g., CLI not available, no lockfile)]
- e18e CLI version: [version number, or N/A]
- Findings produced: [N]
- Migrations applied: [N auto-migrated, N skipped]
- Errors during execution: [none | description]

#### Stage 3: Runtime analysis (Lighthouse CLI)
- Status: [COMPLETED | SKIPPED — reason (e.g., no Chrome available, build failed)]
- Directory served: [path served by http-server]
- Port used: [port number]
- Lighthouse categories audited: [best-practices, etc.]
- Findings produced: [N]
- Errors during execution: [none | description]

#### Stage 4: Merge, enrich & fix
- Status: [COMPLETED | PARTIALLY COMPLETED — reason]
- Input sources merged: [list which of eslint / lighthouse / e18e / stylelint were provided, and which were passed as `-` (skipped)]
- Polyfill registry lookups: [N features looked up]
- `modern-web` CLI: [AVAILABLE — N use cases searched, N guides retrieved | NOT AVAILABLE — skipped enrichment]
- Auto-fixes applied: [N files modified]
- Best-practice violations flagged: [N new findings added]

#### Stage 5: Present the report
- Status: [COMPLETED]
- Markdown report saved to: [file path]
- HTML report saved to: [file path]
- Report filename collision: [no | yes — appended suffix -N]

### Skill components used

#### Scripts (`scripts/`)
| Script | Used | Notes |
|---|---|---|
| `serve-and-audit.sh` | [YES / NO] | [e.g., "Served project root on port 8080" or "Skipped — no Lighthouse run"] |
| `parse-lighthouse.js` | [YES / NO] | [e.g., "Parsed N audits from Lighthouse JSON" or "Skipped — no Lighthouse output"] |
| `parse-e18e.js` | [YES / NO] | [e.g., "Parsed N diagnostics" or "Skipped — e18e not available"] |
| `parse-stylelint.js` | [YES / NO] | [e.g., "Parsed N findings from stylelint" or "Skipped — no CSS files"] |
| `merge-reports.js` | [YES / NO] | [e.g., "Merged 4 sources" or "Merged 2 sources (e18e and stylelint skipped)"] |
| `render-html-report.js` | [YES / NO] | [e.g., "Rendered HTML report from merged JSON" or "Skipped — JSON not available"] |

#### References (`references/`)
| Reference | Used | Notes |
|---|---|---|
| `polyfill-registry.json` | [YES / NO] | [e.g., "Looked up N features" or "No findings required polyfill lookup"] |
| `browserslist.example` | [YES / NO] | [e.g., "Shown to user for target selection" or "Not needed — project had browserslist config"] |

#### Evals (`evals/`)
| Resource | Used | Notes |
|---|---|---|
| `evals.json` | [YES / NO] | [e.g., "Not used during audit execution — evals are for skill development only"] |
| `fixtures/` | [YES / NO] | [e.g., "Not used during audit execution — fixtures are for skill development only"] |

### External integrations
| Integration | Available | Used | Notes |
|---|---|---|---|
| `modern-web` CLI | [YES / NO] | [YES / NO] | [e.g., "Searched N use cases, retrieved N guides, applied N fixes" or "Not available — skipped enrichment"] |
| Chrome/Chromium | [YES / NO] | [YES / NO] | [e.g., "Used for headless Lighthouse audit" or "Not found — runtime analysis skipped"] |

### Temp directory
- Path: [AUDIT_TMPDIR path]
- Cleaned up: [YES / NO]
```

If there are zero findings, say so clearly — a clean audit is a good result.

### Save the report

Save the report in **both Markdown and HTML formats** in the project's `reports/` directory. Create the directory if it doesn't exist. Tag the filenames with the audit date (ISO 8601, date only) and the current git branch name (sanitized — replace `/` with `-`):

```bash
mkdir -p reports
BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
DATE=$(date +%Y-%m-%d)
REPORT_BASE="reports/browser-compatibility-report-${BRANCH}-${DATE}"
```

If a report with the same base filename already exists (e.g., a second audit on the same branch and date), append an incrementing suffix (`-2`, `-3`, etc.) to avoid overwriting previous results. Use the same suffix for both files so they stay paired.

#### Markdown report

Write the full report content (using the template above) to `${REPORT_BASE}.md`.

#### HTML report

First, save the merged report JSON (the output of `merge-reports.js`, after enrichment) to a temporary file:

```bash
echo "$MERGED_JSON" > "$AUDIT_TMPDIR/report.json"
```

Then use the bundled renderer to produce the HTML:

```bash
node scripts/render-html-report.js \
  "$AUDIT_TMPDIR/report.json" \
  "${REPORT_BASE}.html" \
  --branch "$BRANCH" \
  --date "$DATE" \
  --target "description of what was audited"
```

The renderer produces a **self-contained HTML file** with all CSS inlined — no external dependencies. It features:

- Color-coded summary cards (findings, errors, warnings, auto-fixes)
- Browser version tags from the baseline
- Per-finding cards with severity badges, browser compat chips, and modern-web guidance callouts
- Auto-applied fixes table
- Collapsible execution trace
- Dark theme optimized for readability

The HTML report is the primary deliverable for sharing and visualization. The Markdown report serves as a machine-readable / diff-friendly companion.

**Note on enrichment data**: The HTML renderer reads the unified JSON produced by `merge-reports.js`. Any fields added during the enrichment phase (e.g., `auto_fixed`, `what_was_applied`, `modern_web_guidance`, `unsupported_browsers`) are rendered automatically if present. To get the richest HTML output, save the JSON **after** all Stage 4 enrichment is complete — including `modern-web` best-practice verification and e18e migration results. Fields that Claude adds during enrichment (not present in the raw merge output) should be injected into the JSON before passing it to the renderer.

Inform the user of both saved report paths so they can review or share them.

### Cleanup

After the audit completes, remove the temporary directory:

```bash
rm -rf "$AUDIT_TMPDIR"
```

Since all tools are executed via `npx` (no devDependencies are added), no cleanup of `package.json` is needed.

## Important considerations

### Lighthouse runs locally

Lighthouse audits a local server, so features that depend on external services (CDN-loaded polyfills, runtime feature detection services) may produce false positives. Note this in the report when relevant.

### Large projects

For projects with more than 500 source files, eslint-plugin-compat may take a while. Consider running the analysis on changed files only (via `git diff --name-only`) or warn the user about expected duration.

### e18e requires a lockfile

e18e CLI reads the project's lockfile to resolve the full dependency tree. If the project has no lockfile (e.g., fresh clone without `npm install`), dependency analysis will be skipped. Run `npm install` first if dependency analysis is desired.

### e18e migrations modify source files

Unlike modern-web auto-fixes (which add fallbacks/guards), e18e migrations replace import statements and API calls. Always review the dry-run output before applying. The `--dry-run` step is mandatory in this skill's workflow.

### Tools used by this skill

This skill uses `eslint`, `eslint-plugin-compat`, `stylelint`, `stylelint-no-unsupported-browser-features`, `lighthouse`, and `http-server` — all executed directly via `npx` without installing them into the project. This ensures the audit is non-invasive and does not modify `package.json` or `node_modules`. It optionally uses `@e18e/cli` for dependency analysis — also executed via `npx`; the skill checks for its availability and skips dependency analysis if not found.
