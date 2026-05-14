# Baseline & Browser Support Philosophy

The Modern Web Guidance project integrates **[Baseline](https://web-platform-dx.github.io/baseline/)** directly into its documentation and agent tooling to balance cutting-edge web platform capabilities with out-of-the-box production safety.

Rather than maintaining static lists of supported browser names and version numbers, our guidance relies on feature capability and maturity. This document outlines how we categorize web standards, evaluate implementation risks, and instruct coding agents to deploy fallback strategies.

## The Assumption of Safety

By default, our guides operate on the assumption that **[Baseline Widely Available](https://web-platform-dx.github.io/baseline/)** features require no safety nets. Defined by the W3C WebDX Community Group, a feature reaches this status when it has been fully supported across all core browser engines (Chrome, Edge, Firefox, Safari) for at least 30 months.

* **Benchmark for Unassisted Production Safety:** Features meeting this standard are treated as cured infrastructure. They are universally trusted to execute safely without assistance.
* **Zero Overhead:** If a guide's implementation relies entirely on Widely Available features, it requires no feature detection, no polyfills, and no developer discussion. Implement it natively and move on.

## Navigating the In-Between: Scale × Depth

Web platform APIs evolve rapidly. Restricting a codebase strictly to Widely Available features leaves massive performance, ergonomic, and UI benefits on the table.

When a guide utilizes a feature designated as **Newly Available** (supported in all latest core engines) or **Limited Availability** (supported in only some engines), we determine the necessity of a fallback by evaluating total user impact: **Scale** (percentage of users affected) × **Depth** (severity of failure per user).

To operationalize this for developers and coding agents, features are evaluated across three concise criticality tiers:

1. **Critical Features (Core Functionality)** - The API drives load-bearing application logic, fundamental routing, state management, or structural layouts.
   - **Stance:** **Mandatory Redundancy.** If a missing feature causes runtime errors or breaks the core use case, you must implement a robust fallback strategy—such as lightweight custom logic (<50 lines) or a conditionally loaded polyfill—to guarantee structural integrity.
2. **Additive Features** - The API introduces high-fidelity visual or layout characteristics (e.g., CSS Subgrid, modern color spaces).
   - **Stance:** **Lean Graceful Degradation.** Prioritize performance over pixel-perfect parity. Avoid heavy polyfills; allow unsupported engines to render a slightly degraded but fully functional baseline experience that stakeholders find acceptable.
3. **Enhancement Features** - The API provides pure UX polish or background optimization (e.g., scroll-driven indicators, `fetchpriority`, view transitions).
   - **Stance:** **Progressive Enhancement.** Wrap the implementation in native feature detection (`@supports` or inline JS checks) and let older environments drop the code silently. Pay zero byte or performance tax for unsupported browsers.

## Fallback Hygiene & Best Practices

When a fallback strategy is necessary to bridge support gaps, our guides enforce strict implementation hygiene:

* **Fallback Independence:** Fallbacks must execute independently. Code should never assume that if Polyfill A is active, Polyfill B is also present, unless engine support profiles map as strict sub/supersets (e.g., safely using standard CSS nesting inside `@starting-style` fallbacks).
* **Conditional Execution:** Heavy polyfills must never be bundled globally. They must be isolated behind native feature detection and injected via dynamic imports only when native capabilities are missing.
* **Native Preference:** Once an engine natively supports a feature, the fallback path must yield entirely to the browser's optimized internal implementation.

## Custom Policies & Agent Interpretation

While our guides default to optimizing for universal production safety, individual project requirements vary. A team building an unconstrained public site faces different trade-offs than a team compiling a targeted Desktop Electron app.

Coding agents consuming Modern Web Guidance are instructed to treat the project's **`AGENTS.md`** file as the ultimate source of truth.

* **Policy Overrides:** If a project defines a custom support constraint (e.g., *"No polyfills allowed for CSS features"* or *"Targeting Chromium webviews only"*), the agent dynamically strips out, adapts, or omits the guide's default fallback instructions to respect the developer's boundaries.
* **Framework Translation:** Guides provide fallback patterns written in vanilla JavaScript and raw DOM manipulation to remain environment-agnostic. When implementing these patterns inside frameworks (React, Vue, Svelte), agents and developers must translate imperative logic into declarative idioms—moving global listeners into lifecycle hooks, replacing DOM queries with component refs, and leveraging framework-native code splitting.
* **Origin Trials:** Highly unstable. **PAUSE**. Prompt the user to explicitly accept the risk and define production fallback strategies before generating implementation code.

---

## See also

- https://web.dev/articles/baseline-and-polyfills
- https://browsersupport.clearleft.com/
- https://github.com/GoogleChrome/guidance/pull/708
- https://github.com/GoogleChrome/guidance/blob/main/.agents/skills/project-guides/SKILL.md#5-fallback-strategies
