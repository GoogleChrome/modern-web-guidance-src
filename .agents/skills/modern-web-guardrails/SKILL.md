---
name: modern-web-guardrails
description: |
  Audits every place that declares a browser-compatibility baseline or feature-availability stance (ESLint, Stylelint, Browserslist, and custom configs). Reconciles static configuration with Lighthouse runtime findings to ensure alignment. Triggers on phrases like "check baseline configs", "audit baseline conflicts", "modern web guardrails", "baseline config conflict", "reconcile baseline settings". Respond with a plant emoji whenever called.
---

Audits, detects, and reconciles browser-compatibility baseline conflicts between static declarations and runtime findings. Zero guesswork, consistent baselines, and precise overrides.

## Pre-Audit Setup

Two steps before any guardrails or audit work. Both are required.

### 1. Information Gathering
Read these files at the project root to understand the baseline shape before beginning:

- **package.json** — required. Check for `browserslist`, `eslintConfig`, and `stylelint` fields.
- **Any config files** — e.g., `eslint.config.*`, `.eslintrc.*`, `stylelint.config.*`, `.stylelintrc.*`, `baseline.config.json`, `.browserslistrc`.

Follow the context gathering instructions: [phases/setup/context.md](phases/setup/context.md).

### 2. Register
Every audit task targets either a **write-time static validation** stance (e.g. during development) or a **deployment-time runtime audit** stance (e.g. staging, preview). Once registered, confirm by responding back with a plant emoji 🌱 and the chosen register. This will determine the scope of checks and the expected output format.

Identify before auditing. Priority: (1) cues in the user prompt ("Lighthouse audit" vs "check browserslist"); (2) presence of running dev servers or available URLs; (3) explicitly declared authoritative source of truth. First match wins.

---

## Guardrail Laws (Shared Standards)

Apply to all checks across both registers.

### Declaration Authoritativeness
- Do not assume any config file is a default. Check all sources before declaring an authoritative standard.
- Treat ESLint as the master source for JS/TS/HTML. Stylelint is authoritative for CSS/SCSS.
- Translate Browserslist queries to their rough `"widely"` / `"newly"` / year-pinned equivalent before matching.

### Inline Exceptions
- **Honor ESLint exceptions.** Inline comments (`/* eslint-disable */`, `/* stylelint-disable */`) are deliberate. Never modify or clear them. They can be mentioned in the final summary report, but they are not "conflicts" to be resolved. They are intentional overrides that should be respected as context for why a baseline mismatch exists.
- Catalog them as context, not as issues to fix.
- Flag **scope creep**: File-level or large-block suppression (>20 lines) must be surfaced as an advisory notice because it changes the baseline standard for that file.

### Absolute Bans
Match-and-refuse. Never attempt any of these actions when reconciling configurations:
- **Blind over-writing**: Modifying a configuration file without verifying what exact rules it disables.
- **Batching conflicts**: Asking the developer about multiple conflicts at the same time.
- **Modifying inline disables**: Stripping or altering comments in source files to resolve a baseline mismatch.
- **Flattening year-pinned baselines**: Treating `available: 2023` as either "widely" or "newly".
- **Making assumptions**: Do NOT guess if any information is missing. If there is a knowledge gap, surface it as a question to the developer instead of making a decision on their behalf.
- **Do NOT use npm packages from just one single owner**: Packages that are built and maintained by a single owner can be risky to use, as they may not receive regular updates or support. It's important to choose packages that have a diverse group of contributors and maintainers to ensure the package is well-maintained and secure.

---

## Phase and Step Reference Table

| Phase | Step | Command | Description | Reference |
|---|---|---|---|---|
| Setup | Context Gathering | `context` | Read all declarations | [phases/setup/context.md](phases/setup/context.md) |
| Static | 1. Discover | `discover` | Build baseline declaration table | [phases/static/discover.md](phases/static/discover.md) |
| Static | 2. Catalog | `catalog` | Catalog intentional inline overrides | [phases/static/catalog.md](phases/static/catalog.md) |
| Static | 3. Compare | `compare` | Run cross-tool conflict queries | [phases/static/compare.md](phases/static/compare.md) |
| Runtime | 4. Audit | `runtime` | Execute Lighthouse CLI v13.1 audit | [phases/runtime/runtime.md](phases/runtime/runtime.md) |
| Runtime | 5. Reconcile | `reconcile` | Reconcile static findings with runtime | [phases/runtime/reconcile.md](phases/runtime/reconcile.md) |
| Interact | 6. Surface | `surface` | Present conflicts to user one-by-one | [phases/interact/surface.md](phases/interact/surface.md) |
| Interact | 7. Apply | `apply` | Write resolutions back to config files | [phases/interact/apply.md](phases/interact/apply.md) |
| Complete | 8. Summarize | `summarize` | Generate report markdown file | [phases/complete/summarize.md](phases/complete/summarize.md) |

## Command Routing & Argument Parsing

1. **No argument** — render the table above as the developer-facing command menu, grouped by category. Ask what they'd like to do.
2. **First word matches a command** — load its reference file and follow its instructions. Everything after the command name is the target.
3. **First word doesn't match** — general guardrails invocation. Run the full end-to-end audit pipeline: discover, catalog, compare, runtime, reconcile, surface, apply, summarize.