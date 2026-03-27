---
name: project-skills-research
description: Best practices and instructions for researching and authoring discipline-level skill files (e.g., accessibility, performance) for AI coding agents.
---

# Skills Research: Authoring Discipline-Level Skills

The primary goal of this skill is to define the process for researching and generating structured, action-oriented `SKILL.md` files for entire web platform disciplines (e.g., accessibility, security, performance). These files serve as comprehensive reference guides for AI coding agents.

## Automated Research Pipeline

When tasked with researching a new discipline and generating a `SKILL.md` file, you should execute an automated research pipeline by calling the Gemini API with Google Search grounding. Do not rely solely on your internal knowledge. 

### 0. Check Existing Research

Before beginning any research, check if a raw research report already exists.

**MANDATORY**: Check for the existence of research files in `skills-drafts/.research/<discipline>/` (e.g., `web.dev.md`, `deep_research.md`). If these files exist, skip Step 2 ("The Research Workflow") and proceed directly to Step 3 ("Synthesis") using the contents of these files as your source material.

### 1. The Unified Research Pipeline

When tasked with researching a discipline to generate a `SKILL.md` file, you must execute a unified sequence combining both `web.dev` curriculum synthesis and Automated Deep Research. They are not alternatives; you should always do both.

#### A. Step 1: Establish `web.dev` Scaffolding (Course Reading)
Read parameters from `https://web.dev/learn/<discipline>` to establish the "floor" of curriculum topics and outline.
- **Workflow**:
  1. Fetch Table of Contents natively (using `read_url_content`).
  2. Present TOC to the user for approval.
  3. Read approved chapters (sequentially or in bulk) to extract actionable guidelines. Save output to `web.dev.md`.

#### B. Step 2: Overlay Deep Research Enrichment
Run `deep_research.js` to identify modern or advanced edge cases beyond the standard curriculum.
- **Workflow**: Run `deep_research.js` (see Tools below) to generate a comprehensive report. Save output to `deep_research.md`.

#### C. Step 3: Synthesis
Merge `web.dev.md` and `deep_research.md` into a single, comprehensive `SKILL.md` superset.

### 2. Research Tools

Use these tools to execute your track. Note: Node environments vary (Mac vs Cloudtop), so run Node commands using `--env-file=.env` to ensure secrets (like `GEMINI_API_KEY`) are loaded reliably.

#### Running Deep Research
Generates a comprehensive report with citations.
```bash
node --env-file=.env .agents/skills/project-skills-research/scripts/deep_research.js --discipline <name>
```

#### Resolving Sources
Cleans up temporary redirect URLs into canonical links.
```bash
node --env-file=.env .agents/skills/project-skills-research/scripts/resolve_sources.js --discipline <name>
```


### 2. The Research Workflow

If no existing research file is found, follow these steps to research the discipline.

**MANDATORY: Communicative Agent**
The agent MUST keep the user informed of its progress at each step (e.g., "Checking if research exists...", "Fetching TOC from web.dev..."). Do not execute multiple tool calls silently without updating the user on your current activity and intent.


1. **Content Fetching & TOC Generation**
   - Identify a seed URL for the discipline. **Prioritize `web.dev`** as the primary source (e.g., `https://web.dev/learn/accessibility/`). Use its course outline for the base TOC if available.
   - **Fallback Mechanism**: If no specific course or TOC is found on `web.dev`, use the Gemini API with Google Search grounding to research the discipline and synthesize a logical set of chapters.
   - Prompt Gemini to extract or synthesize a logical set of chapters or subdisciplines (a Table of Contents). Explicitly ask it to omit boilerplate chapters (e.g., "Welcome", "Conclusion", "Next Steps"). **For the initial scaffolding, it is acceptable to use the standard or literal names from the source (e.g., "Images"). Get user approval for the topics first. You should refine these names to be more descriptive (e.g., "Alternative Text for Images") as you go along, when you actually read the chapter content.** Request the output as a clean JSON array of strings.

2. **User Check-in & TOC Approval**
   - **MANDATORY**: Present the extracted Table of Contents (the proposed scaffolding/chapters) to the user for feedback before proceeding to any chapter research. **You MUST print the Table of Contents in your response to the user (or save it to a specific file and point the user to it). Do not ask for approval of a TOC that the user cannot see.**

   - **Full Stop**: You MUST wait for explicit user confirmation to add, remove, or modify chapters before any chapter-by-chapter reading begins. Combining this with research steps is prohibited. Once the TOC is approved, you do not need to ask for permission to proceed to each subsequent chapter; you should work through them sequentially without stopping until ALL approved chapters have been processed. Write each chapter's findings to the file before moving to the next to keep context size manageable. Do not pause to ask if you should continue to the next chapter if it was part of the approved plan.

3. **Chapter-by-Chapter Research & State Management**
   - For each identified chapter in the finalized TOC, prompt Gemini to research the topic.
   - **Incremental Updates**: Update the raw research cache for the specific source (e.g., `skills-drafts/.research/<discipline>/web.dev.md`) incrementally (after each chapter is processed). This manages context window size and ensures progress is saved without clobbering other research sources.
   - **Crucial Prompt Instructions**: Instruct the model to provide *instructive guidelines for AI coding agents*. It MUST output a mix of concrete DOs and DON'Ts, and short code examples (HTML, CSS, JS). Explicitly prohibit encyclopedic definitions.
   - Use Google Search grounding (`tools: [{ google_search: {} }]`) to ensure the model references modern web standards. **Prioritize `web.dev`** as the primary source, falling back to other authoritative sources (e.g., MDN, developer.chrome.com) as needed.
   - *Collect the output and sources for every chapter.*

4. **Save Research Artifact**
   - **MANDATORY**: Combine all the raw research text and a comprehensive list of all sources used.
   - Save this combined document to a source-specific file (e.g., `web.dev.md` for manual course reading, `deep_research.md` for automated tool output). This ensures all research artifacts are kept separate and cached for future review or re-synthesis without clobbering each other.

### 3. Synthesis

Once the research is complete (or loaded from existing research files like `web.dev.md` or `deep_research.md`), synthesize the findings into the final skill file.

- **Use Your Own Context**: Read the relevant research files into your internal context window and use your own reasoning to synthesize them into the final `SKILL.md` file in a single pass. Only use an external API call or run a script if the content exceeds your context limits. Merge all relevant source files during synthesis.
- Ensure the final output includes standard YAML frontmatter with `name` and `description`.

### 4. Validation (Automated Self-Audit)

Before finalizing the `SKILL.md` draft, conduct a final quality pass to ensure no actionable granularity was lost during synthesis. 

- **Cross-Checking Subagent**: Invoke a subagent to compare the synthesized `SKILL.md` against the raw research data (e.g., `web.dev.md`, `deep_research.md`, or source course TOC).
- Ask it to compare both documents side by side and list any actionable `DOs`, `DON'Ts`, or code examples that were unintentionally dropped or degraded.
- If discrepancies are found, integrate them back into the draft to ensure zero-loss compression.

- **Use Case Conflict Check**: Check for potential conflicts with existing guidance under the `/guides/` directory. Discipline-level skills are generic web platform guidelines and must **defer** to specific use-case guidance. Use-case guidance takes precedence in specific scenarios!

### 5. Quality Rules for Skill Files

When finalizing the synthesized output (whether reviewing or authoring), you **MUST** adhere to the following strict quality constraints:

#### File Size and Context Constraints
Skill files are read by agents frequently. To ensure they do not overload an agent's context window:
* **Recommended Length**: Aim to keep `SKILL.md` under **500 lines** or ~2000-3000 tokens. 
* **Zero-Loss Compression**: Do not pad the file with fluff; focus on high-density information. If a topic is too large, consider breaking it into sub-skills (e.g. `images-performance`, `js-performance`).

#### Action-Oriented AI Guidelines
A skill file is **not** an encyclopedic article for human readers. It is an instruction manual for an AI coding agent.
* **Focus on the "How-To"**: The output must be tangibly actionable. Omit lengthy history or background context that doesn't influence how code is written.
* **DOs and DON'Ts**: Use concrete, bulleted lists of strict DOs and DON'Ts to establish rigid boundaries for the agent.
* **Code Examples**: Provide concise, heavily commented code examples (HTML, CSS, JS) that demonstrate the correct implementation of the guidelines.

#### Structuring the Content
* **Omit Boilerplate**: Do not include introductory or concluding sections (e.g., "Next steps", "Glossary") unless they contain specific, actionable coding directives.
* **Logical Subdisciplines**: Break the discipline down into logical, focused chapters with descriptive names that hint at the contents or methodology (e.g., for Accessibility: "Semantic HTML and Landmarks" instead of just "Content Structure", "Focus Management" instead of just "Keyboard Focus", "Alternative Text for Images" instead of just "Images").

#### File Format and Schema
* **Naming**: Every skill file must be named `SKILL.md`.
* **Slug Match**: The directory name of the skill (the slug) **MUST** exactly match the `name` field in your frontmatter (or be a direct kebab-case equivalent thereof if specified by the system).
* **Metadata**: The file MUST start with standard YAML frontmatter containing a `name` and `description`:

```yaml
---
name: <discipline-slug-or-name>
description: <Brief description of what the skill covers and when an agent should use it>
---
```

## Finalization

Once the synthesized draft meets all quality standards, save it to the `skills-drafts/<discipline>/SKILL.md` directory.