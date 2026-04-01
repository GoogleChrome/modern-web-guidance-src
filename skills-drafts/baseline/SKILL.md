---
name: baseline
description: Action-oriented guidelines for applying Baseline targets and statuses in web projects. Use this skill when making design decisions about web platform features and compatibility.
---

# Web Platform Baseline: Mental Framework for Compatibility

Baseline brings clarity to browser support tracking for web platform features, as defined by the WebDX Community Group. Use this skill to determine when to adopt new features, when to retain fallbacks, and how to verify project-specific compatibility targets.

## DOs and DON'Ts

### Adopting Features
- **DO** default to setting the base compatibility target to `'widely available'` if not explicitly configured in the project.
- **DO** verify if a feature meets the project's target before using it without a fallback.
- **DO NOT** adopt new web features that are not yet Baseline (or violate the project target) without implementing a robust fallback strategy.
- **DO NOT** retain outdated fallback strategies for features that have since met the project's Baseline target.

### Checking Configurations
- **DO** check the project root for a `baseline.config.json` file.
- **DO** check `browserslist` configurations (in `.browserslistrc` or `package.json`).
- **DO** check ESLint configurations for standard web compatibility rules.
- **DO** check `package.json` for project-specific settings (specifically the `browserslist` key, as no other custom baseline keys are supported there).

## Baseline Targets Reference

Definitions of standard targets for use in verifying feature readiness.

| Target Name | Definition | Usage Context |
| ----------- | ---------- | ------------- |
| `'widely available'` | Feature supported by all major browsers for at least 2.5 years (30 months). | Default project target. Safe for use without fallbacks. |
| `'newly available'` | Feature supported by all major browsers, but for less than 30 months (not yet Widely). | Use with caution or fallbacks if stability is critical. |
| `'limited availability'` | Disables compatibility constraints. No fallbacks required. | Use for bleeding-edge projects without fallback requirements. |

### Custom Threshold Tuning
Developers can tune the window by specifying calendar years or specific observation dates.

- `'baseline 2024'` - Feature met Baseline in the given calendar year (tested as of end of year).
- `'baseline widely available on 2024-01-01'` - Feature was Widely available on that specific date.

## Technical Auditing Heuristics

### Where to Find Project Targets

1. **`baseline.config.json`**
   - Property: `"baseline_target"`
     - Type: `string`
     - Description: The project compatibility target.
   - Property: `"enable_baseline_todos"`
     - Type: `boolean` (Default: `true`)
     - Description: Set to `false` to opt-out of generating `TODO(baseline/...)` comments for unsupported features.
   - Example:
       ```json
       {
         "baseline_target": "widely available",
         "enable_baseline_todos": true
       }
       ```

2. **Browserslist Check**
   - Check for `baseline` queries in `.browserslistrc` or `package.json`. The `browserslist` config will contain the word `baseline`. **DO NOT** attempt to map `> 1%` or `last 2 versions` to a Baseline equivalent as this does not work.
   - **Supported Baseline Queries:**
     - `baseline widely available`: Browser versions supporting all features interoperable for at least 30 months.
     - `baseline newly available`: Browser versions supporting all features interoperable today.
     - `baseline widely available on YYYY-MM-DD`: Browser versions supporting the Widely set on a specific date.
     - `baseline YYYY` (e.g., `baseline 2024`): Browser versions compatible with features that were Newly available at the end of that year.

3. **ESLint Integration**
   - Check if the linter is configured to flag unsupported APIs. Defer to linter rules if they enforce strict browser support.

## Interpreting Feature Status Messages

Guide files contain status messages describing a feature's Baseline status. Use these messages as hints to determine if a feature satisfies your project target:

| Status Message | Target Readiness | Action |
| --- | --- | --- |
| `"... is Widely. It's been Baseline since ..."` | **Met** for `'widely available'` and `'newly available'`. | Safe to use natively without fallback. |
| `"... is Newly. It's been Baseline since ..."` | **Met** for `'newly available'`. Check the date for `'baseline YYYY'`. | Use progressive enhancement if target is older. |
| `"... is Limited."` | **Not Met** for any Baseline target. | Fallback required (or `TODO` placeholder if none exists). |

## Reconciling Targets with Use Case Guides

When implementing code from project guides, reconcile the project target with the feature statuses defined in the guide.

### Single-Browser Targets (e.g., Electron, Chrome-only Intranets)

If the project targets a single browser environment specifically:
1. Set the `baseline_target` in `baseline.config.json` to `'limited availability'` to disable high-level interoperability warnings.
2. Run `node ./scripts/check-baseline.js lookup <feature-id>` to inspect the `status.support` fields for your specific target browser. For example, check if `support.chrome === "true"` or a valid version number exists. Ignore the high-level Baseline status in this case.

### Redirects and Splits (Canonical IDs)

Web features can be renamed ("moved") or broken down ("split"). The tool script automatically resolves these redirects to their canonical IDs.
- Run `node ./scripts/check-baseline.js lookup <stale-id>` to print the resolved canonical ID(s).
- Run `node ./scripts/check-baseline.js reconcile <target> <feature-id>` to verify target readiness (incorporating redirects).
- Use the canonical ID for feature verification.
- **Resolving Moved vs Split IDs:**
  - **Moved:** Replace the stale ID with the single modern canonical ID directly in the source code.
  - **Split:** Analyze the context of the code block. Determine which sub-feature(s) apply. Use the specific sub-feature ID(s).
  - **Single ID per Comment (Recommendation):** If multiple split sub-features apply to the same code block, add a separate `// TODO(baseline/feature-id)` comment for each (stack them). Do **NOT** use comma-separated lists inside `TODO` comments (e.g., `// TODO(baseline/id1,id2)`) as it breaks 1:1 compatibility with CLI tools.

### Data Synchronization & Maintenance

The skill relies on a static `features.json` snapshot to avoid runtime dependencies. To keep this data fresh as the web platform evolves:
- Run the workspace sync command: `pnpm run sync:baseline`
- This script pulls the latest `web-features` dataset (installed in `guides/node_modules`) and regenerates the paired-down snapshot inside the skill folder.
- **When to run:** Run this command periodically or as a pre-dev setup step when auditing compatibility targets.

### Decision Matrix for Fallbacks

| Condition | Action | Rationale |
| --------- | ------ | --------- |
| **Feature is Newer** than Project Target | **Progressive Enhancement** | Use feature detection to use the modern feature if supported by the browser, otherwise load the fallback/polyfill. |
| **Feature is Older** than Project Target | **Skip Fallback** | Feature is safe to use as-is per project configuration. Don't add redundant code. |

### Implementation Patterns

#### Feature Newer than Baseline Target (Use Fallback)
```javascript
// Feature 'foo-bar' is not yet baseline for this project target
if ('fooBar' in window) {
  // Use modern API
  window.fooBar();
} else {
  // Polyfill or fallback strategy as defined in the guide
  guideFallback();
}
```

#### Feature Older than Baseline Target (Skip Fallback)
```javascript
// Feature 'old-stable' is safe for target 'widely available'
// Rely on native implementation directly
window.oldStable();
```

#### Feature is Blocked by Baseline Target (No Fallback)

If a feature does not meet the project target AND cannot be used safely with standard fallbacks, leave a special `TODO` comment in the code as a placeholder. This allows future agents to run periodic audits, scan for these `TODO`s, and easily upgrade them once compatibility constraints are met.

The comment **MUST** contain a high-level description of what needs to be done. It does **not** need to contain code sketches or specific criteria for "when ready," as the `baseline/feature-id` itself implies it should be done when that feature meets the target.

**Comment Syntax:**
`TODO(baseline/feature-id): <High-level description of what to do>`

Use this syntax inside standard comment delimiters for the language you are writing (single-line or multi-line).

**Example:**
```html
<!-- TODO(baseline/fencedframe): Use privacy-preserving embeds. -->
<iframe src="https://example.com"></iframe>
```
