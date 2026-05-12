# Baseline & Modern Web Guidance: Our Approach

### 1. Enforcing a Support Floor, Not a Ceiling
A baseline target enforces a **support floor**—the minimum acceptable browser support determined by a developer's tolerance for breaking user experiences.
* **Graceful Degradation:** Enforcing a strict "baseline ceiling" (a hard rule against using any newer features) is counterproductive because many modern web features gracefully degrade.
* **Default to Widely Available:** Guidance assumes a default floor of **Baseline Widely Available** to ensure strong production safety from the start.
* **Expert Fallbacks:** Guidance relies on documented progressive enhancements. Guide authors explain specific fallback contexts and clarify why fallbacks might not be necessary for certain use cases. Extended baseline macros provide detailed browser support context directly to the agent.

### 2. Feature Maturity & Risk Tolerance (The Experimental Firewall)
Adopting features above the baseline floor introduces considerations of API stability and feature maturity rather than pure compatibility.
* **Maturity Model:** Developers can signal their comfort level with feature stability to prevent future breakage caused by shifting APIs.
* **Explicit Opt-In Required:** Features beyond *Baseline Newly Available* act as a firewall. Agents require explicit opt-in before adopting high-risk experimental features (e.g., Origin Trials, features available in only a single engine, or APIs not yet on a standards track).

### 3. Streamlined Agent Workflow (Implicit Context)
To prevent dangerous distractions that delay value delivery, agents avoid added prerequisite verification steps before engaging with the command-line interface.
* **No Prerequisite Status Checks:** By default, agents implicitly assume the *Widely Available* target, skipping explicit upfront checks for baseline configuration files.
* **Context Window Integration:** Constraints defined in `agents.md` are included implicitly within the standard context window, requiring no dedicated file-reading tasks.

### 4. Reactive Discovery & Fallback Tuning
Agents avoid upfront configuration questionnaires, acting reactively only when specific project constraints surface during normal workflows:
* **Triggers:** Single-environment targets (e.g., Electron/Tauri monocultures), explicit exclusions (e.g., neglecting desktop Safari), or expressed hesitation around polyfill size and invasiveness.
* **Fallback Tuning:** When custom constraints are detected, agents tune the fallback implementation accordingly (e.g., omitting JavaScript polyfills for CSS features if requested).
* **Limited Support Warnings:** If a guide involves features with limited support where site functionality could break without proper fallbacks, the agent proactively warns the user about compatibility risks.

### 5. Persistence & Roadmap (`agents.md` vs. `baseline-config.json`)
* **Immediate Context (`agents.md`):** Agents suggest persisting custom support policies as free-form text inside a project-level `agents.md` file for persistent memory across sessions.
* **Future Roadmap (`baseline-config.json`):** To resolve clashes between agent guidance and static analysis tools, we emphasize investing in a separate `baseline-config.json` file. This file will act as a unified source of truth updated by tooling that configurations like ESLint can natively respect.
