# Baseline & Modern Web Guidance: Our Approach

### 1. The Inversion of "Support": Browsers vs. Features
A baseline target enforces a **support floor** rather than a ceiling. Understanding this floor requires separating two complementary perspectives:
* **Supporting Browsers (The Audience Floor):** Setting a baseline target establishes the minimum browser versions guaranteed to work based on a developer's tolerance for broken user experiences. By defaulting to **Baseline Widely Available**, guidance optimizes for production safety without bloat. For features *more mature* than this target floor, fallback code is omitted entirely because the guaranteed audience natively supports them. (Consequently, users running older browsers below this floor receive no fallbacks and risk broken experiences).
* **Supporting Features (The Capability Axis):** Conversely, when adopting features *less mature* than the target audience floor, guidance relies on documented progressive enhancements and feature detection to protect users within the guaranteed target window. Guide authors clarify specific fallback contexts and explain when fallbacks are unnecessary.

### 2. Feature Maturity & Risk (Rejecting the Ceiling)
Enforcing a strict "baseline ceiling" (blocking all newer features) fails because many modern web features gracefully degrade or provide massive immediate benefits to supported clients. The decision to adopt newer features maps to a feature maturity model:
* **Single-Engine Support (e.g., Chrome-only):** Totally fair game by default in guidance. Recommended alongside robust feature detection and alternative pathways for unsupported browsers.
* **Origin Trials (The Experimental Firewall):** Highly immature APIs liable to breaking changes. Delivering a consistent experience across real production users is impossible, and smooth fallbacks are almost never available. When encountering a guide utilizing an Origin Trial feature, the agent MUST pause and have the user explicitly decide if they accept the risk and how to handle production users lacking support.

### 3. Streamlined Agent Workflow (Implicit Context)
To prevent dangerous distractions that delay value delivery, agents avoid added prerequisite verification steps before engaging with the command-line interface.
* **No Prerequisite Status Checks:** By default, agents implicitly assume the *Widely Available* target, skipping explicit upfront checks for baseline configuration files.
* **Context Window Integration:** Constraints defined in `AGENTS.md` are included implicitly within the standard context window, requiring no dedicated file-reading tasks.

### 4. Reactive Discovery & Fallback Tuning
Agents avoid upfront configuration questionnaires, acting reactively only when specific project constraints surface during normal workflows:
* **Triggers:** Single-environment targets (e.g., Electron/Tauri monocultures), explicit exclusions (e.g., neglecting desktop Safari), or expressed hesitation around polyfill size and invasiveness.
* **Fallback Tuning:** When custom constraints are detected, agents tune the fallback implementation accordingly (e.g., omitting JavaScript polyfills for CSS features if requested).
* **Limited Support Warnings:** If a guide involves features with limited support where site functionality could break without proper fallbacks, the agent proactively warns the user about compatibility risks.

### 5. Persistence & Roadmap (`AGENTS.md` vs. `baseline-config.json`)
* **Immediate Context (`AGENTS.md`):** Agents suggest persisting custom support policies as free-form text inside a project-level `AGENTS.md` file for persistent memory across sessions.
* **Future Roadmap (`baseline-config.json`):** To provide a unified, machine-readable source of truth for tools and agents alike, we emphasize investing in a dedicated `baseline-config.json` file updated automatically by tooling.
