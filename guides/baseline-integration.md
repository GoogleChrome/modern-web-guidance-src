# Baseline & Modern Web Guidance: Our Approach

We are shifting how the Modern Web Guidance skill handles browser compatibility and Baseline targets. Instead of relying on a rigid, schema-driven JSON configuration (which conflicts with how static tools use Baseline as a "ceiling"), we're adopting a reactive, context-aware approach driven natively by the agent. 

### 1. Default to Widely Available
Out of the box, the guidance defaults to **Widely Available**.
* **Production Safety:** This optimizes for the best possible browser support from the start.
* **Expert Fallbacks:** The guidance assumes you want to follow expert best practices for fallback scenarios, leveraging progressive enhancement and polyfills when appropriate.
* **High-Confidence Floor:** We provide a safe "floor" by default. You can use modern features without faffing about with manual compatibility checks—the agent will ensure the fallbacks are implemented.

### 2. Reactive Discovery 
We aren't going to force an upfront configuration wizard or proactively probe for a "risk appetite." Instead, the agent will act **reactively** if it spots specific project constraints during normal workflows:
* **Monocultures:** The project is clearly targeting a single environment (e.g., **Electron** or **Tauri**).
* **Explicit Exclusions:** The developer explicitly mentions they don't need to support certain browsers (e.g., "we don't care about Safari").
* **Polyfill Hesitation:** The developer expresses concerns about the size or invasiveness of polyfills.

If any of these triggers occur, the agent will pause and ask the user to clarify their specific browser support story.

### 3. Persistence via `AGENTS.md`
When a non-default support policy is identified, the agent will suggest persisting that constraint directly into an **`AGENTS.md`** file.
* **Free-form Text:** This avoids the overhead and brittleness of a rigid JSON configuration.
* **Contextual Interpretation:** Storing these constraints as project context solves the floor/ceiling conflict. The agent interprets the support matrix natively within the specific use case rather than strictly blocking features.
* **Long-term Memory:** Once recorded in `AGENTS.md`, all subsequent agent interactions benefit from this context without repeated questioning. \o/

*(Note: While this means the config isn't shared directly with static analysis tools, we believe optimizing for agent flexibility is highly preferable here.)*


