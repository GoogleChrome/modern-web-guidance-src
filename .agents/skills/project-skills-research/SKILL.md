---
name: project-skills-research
description: Best practices and instructions for researching and authoring discipline-level skill files (e.g., accessibility, performance) for AI coding agents.
---

# Skills Research: Authoring Discipline-Level Skills

The primary goal of this skill is to define the process for researching and generating structured, action-oriented `SKILL.md` files for entire web platform disciplines (e.g., accessibility, security, performance). These files serve as comprehensive reference guides for AI coding agents.

## 1. Research

When tasked with researching a discipline to generate a `SKILL.md` file, you must execute a sequence combining both `web.dev` curriculum synthesis and automated deep research. They are not alternatives; you should always do both.

**Check Existing Research First**: Before beginning any new data collection, verify if raw research reports already exist in `skills-drafts/.research/<discipline>/` (e.g., `web_dev.md`, `deep_research.md`). If these files exist, skip the automated steps below and proceed directly to **Synthesis** using these files as your source material.

**Parallel Execution Strategy**: To optimize time, launch the Automated Deep Research (Step 1) in a background subagent (or background task) *first*, and then proceed with the manual `web.dev` chapter reading (Step 2) in parallel.

**Wait for Completion**: You MUST wait for both Automated Deep Research AND standard curriculum reading to be 100% complete before moving on to the **Synthesis** phase. Synthesizing before both streams are ready leads to incomplete or skewed guidelines.



**MANDATORY: Communicative Agent**
You MUST keep the user informed of your progress at each step (e.g., "Checking if research exists...", "Fetching TOC from web.dev..."). Do not execute multiple tool calls silently without updating the user on your current activity and intent.

### Step 1: Overlay Deep Research Enrichment
Run the automated deep research tool to identify edge cases beyond the standard curriculum.

1. **Tools**
   - Note: Run commands using `--env-file=.env` to ensure secrets are loaded reliably.
   - **Run Deep Research**: Run the tool to start a new search or resume a disconnected interaction.
     ```bash
     # Start new
     node --env-file=.env .agents/skills/project-skills-research/scripts/deep_research.js --discipline <name>

     # Resume pending interaction (useful if disconnected)
     node --env-file=.env .agents/skills/project-skills-research/scripts/deep_research.js --discipline <name> --interaction-id <id>
     ```
   - **Resolve Sources** (Clean up redirects into canonical links):
     ```bash
     node --env-file=.env .agents/skills/project-skills-research/scripts/resolve_sources.js --discipline <name>
     ```
2. **Save Research Artifact**
   - Save the Tool output to `skills-drafts/.research/<discipline>/deep_research.md`.

### Step 2: Establish `web.dev` Scaffolding (Course Reading)
Identify a seed URL for the discipline (e.g., `https://web.dev/learn/accessibility/`).

1. **Content Fetching & TOC Generation**
   - Fetch the Table of Contents natively (using `read_url_content`).
   - **Fallback Mechanism**: If no specific course is found on `web.dev`, skip the rest of Step 2 and proceed directly to **Synthesis** (relying on Step 1 research). Do not attempt to synthesize a generic Table of Contents or read third-party courses for Step 2.
   - **Save TOC**: Save the Table of Contents to `skills-drafts/.research/<discipline>/toc.md`. Use this file to track which chapters you have processed.
2. **User Check-in & TOC Approval**
   - **MANDATORY**: Present the proposed TOC to the user for feedback before proceeding. **Point the user to the saved `toc.md` file and/or print the Table of Contents in your response. Do not ask for approval of a TOC that the user cannot view.** Wait for explicit user confirmation.
3. **Chapter-by-Chapter Research**
   - For each chapter in the approved TOC, read the content to extract actionable guidelines.
   - Save output incrementally to `skills-drafts/.research/<discipline>/web_dev.md`.
   - Use Google Search grounding to ensure standard compliance.


## 2. Synthesis

Once the research is complete (or loaded from existing research files like `web_dev.md` or `deep_research.md`), synthesize the findings into the final skill file.

- **Use Your Own Context**: Read the relevant research files into your internal context window and use your own reasoning to synthesize them into the final `SKILL.md` file in a single pass. Only use an external API call or run a script if the content exceeds your context limits. Merge all relevant source files during synthesis.
- Ensure the final output includes standard YAML frontmatter with `name` and `description`.

### Quality Rules for Skill Files

When finalizing the synthesized output (whether reviewing or authoring), you **MUST** adhere to the following strict quality constraints:

#### File Size and Context Constraints
Skill files are read by agents frequently. To ensure they do not overload an agent's context window:
* **Zero-Loss Compression**: Do not pad the file with fluff; focus on high-density information. There is **no trade-off** between file size and content coverage. If a discipline is too large to fit in one file without losing critical edge cases, you **MUST** split it into sub-skills rather than dropping content. Use sub-skills to preserve zero-loss compression!
* **Handling Large Disciplines (e.g., CSS, JS)**: If synthesis results in a file exceeding size limits, follow this approach:

  - **Preserve the Core**: Keep the foundational architecture and primary mechanics in the main skill file.
  - **Create Sub-Skills**: Create sub-skills for distinct, large-scale domains within the discipline (e.g., for CSS: `css-layout`, `css-typography`, `css-accessibility`).

#### Mental Model of Sub-Skills
A sub-skill is **supplemental to the core skill**. It should not create a tiny fragment of a discipline. It should represent a cohesive, large-scale domain (like Layouts, Forms, or Rich Media) that an agent can invoke *specifically* for that task. 

Key principles:
- **Supplemental**: It relies on the core skill for fundamentals (e.g., it assumes the agent knows about specificity and variables) but focuses on specific APIs and advanced usage.
- **Relies on Core**: It does not repeat core architectural concepts.
- **Avoid Fragmentation**: CRITICAL: Keep directories clean. Prefer a few large, cohesive files (e.g., `css-layout/SKILL.md`) over many tiny files (e.g., `css-flexbox/SKILL.md`).



#### Action-Oriented AI Guidelines
A skill file is **not** an encyclopedic article for human readers. It is an instruction manual for an AI coding agent.
* **Focus on the "How-To"**: The output must be tangibly actionable. Omit lengthy history or background context that doesn't influence how code is written.
* **DOs and DON'Ts**: Use concrete, bulleted lists of strict DOs and DON'Ts to establish rigid boundaries for the agent.
* **Code Examples**: Provide concise, heavily commented code examples (HTML, CSS, JS) that demonstrate the correct implementation of the guidelines.
* **Decision Matrices & Architectural Heuristics**: Use tables to compare tools and single-sentence rules to establish mental models (e.g., *"Flexbox = Content-first, Grid = Layout-first"*). These are functional, high-density decision heuristics, not passive background context. They clarify the **logic** behind the DOs and DON'Ts.
* **Avoid GitHub Alerts**: Do not use GitHub-style alerts (e.g., `> [!TIP]`, `> [!IMPORTANT]`) in skills files. These files are consumed by AI agents, not humans. Keep the formatting minimal and dense.


#### Structuring the Content
* **Omit Boilerplate**: Do not include introductory or concluding sections (e.g., "Next steps", "Glossary") unless they contain specific, actionable coding directives.
* **Logical Subdisciplines**: Break the discipline down into logical, focused chapters with descriptive names that hint at the contents or methodology (e.g., for Accessibility: "Semantic HTML and Landmarks" instead of just "Content Structure", "Focus Management" instead of just "Keyboard Focus", "Alternative Text for Images" instead of just "Images").
* **Avoid Horizontal Rules**: Do not use horizontal rules (`---`) to separate sections or subdisciplines. Rely on standard markdown headings (`##`, `###`) for structure.

#### File Format and Schema
* **Naming**: Every skill file must be named `SKILL.md`.
* **Slug Match**: The directory name of the skill (the slug) **MUST** exactly match the `name` field in your frontmatter (or be a direct kebab-case equivalent thereof if specified by the system).
* **Metadata**: The file MUST start with standard YAML frontmatter containing a `name` and `description`. The description MUST describe what the skill covers *and* include clear trigger criteria (e.g., "Action-oriented guidelines for privacy by design and browser privacy APIs. Use this skill when dealing with user data, cookies, tracking, or browser privacy APIs").

```yaml
---
name: <discipline-slug-or-name>
description: <Brief description of what the skill covers and when an agent should use it (trigger criteria)>
---
```

## 3. Validation

Before finalizing the draft, conduct a final quality pass to ensure accuracy, completeness, and clarity.

- **Cross-Checking Subagent**: Invoke a subagent to compare the synthesized `SKILL.md` against the raw research data (e.g., `web_dev.md`, `deep_research.md`, or source course TOC).
  - Ask it to compare both documents side by side and list any actionable `DOs`, `DON'Ts`, edge cases, or parameters that were unintentionally dropped or degraded.
  - **Zero-Loss Auditing**: Verify that you didn't discard useful parameters or use-case nuances just to hit an arbitrary line limit if the file is well under 500 lines.

- **Use Case Conflict Check**: Check for potential conflicts with existing guidance under the `/guides/` directory. Discipline-level skills are generic web platform guidelines and must **defer** to specific use-case guidance. Use-case guidance takes precedence in specific scenarios!

- **Proofread for Clarity and Consistency**: Scan for spelling errors, awkward phrasing, or clunky copy-paste leftovers. Standardize on **Sentence case** or Title Case for DOs/DON'Ts summaries. Ensure `DON'Ts` are clear prohibitions, and `DOs` are clear, positive instructions.

- **Code Fence Hygiene**: Verify all code blocks are properly closed. Missing or duplicate closing backticks break rendering for the rest of the document.

## Finalization

Once the synthesized draft meets all quality standards, save it to the `skills-drafts/<discipline>/SKILL.md` directory.