---
name: project-discipline-guides
description: Workflow for refactoring discipline-level guides (e.g., JavaScript, CSS) to remove "Common Knowledge" by generating and comparing against model-specific "Knowledge Mirrors".
---

# Project Discipline Guides

This skill facilitates the "Differential Knowledge Refactor" of technical guides. It ensures that `SKILL.md` files for specific disciplines are lean, context-efficient, and strictly additive to what modern AI models already know natively.

## Workflow: The Inverse Knowledge Filter

The goal is to aggressively "whittle down" a target guide (the **Target**) by removing any content that is natively understood by modern coding models.

### 1. Generate Knowledge Mirrors
Use the provided script to generate "Redundancy Mirrors"—comprehensive guides of what Gemini, Claude, and Codex consider "Common Knowledge" for a given discipline.

```bash
# Ensure that model setup is configured (instructions are in the top level readme)
node .agents/skills/project-discipline-guides/scripts/generate_mirrors.ts <discipline_name>
```

This will create files in a `mirrors/` directory:
- `mirrors/<discipline>_gemini_mirror.md` (via Gemini)
- `mirrors/<discipline>_claude_mirror.md` (via Claude)
- `mirrors/<discipline>_codex_mirror.md` (via Codex CLI)

> [!NOTE]
> If generation fails for any model, the script will log a warning and skip writing that file, but it will not block execution. You should proceed with the mirrors that are successfully generated.

### 2. Perform the Inverse Filter (Agent Task)
As the agent, read the **Target** guide and the available **Knowledge Mirrors**. 

- **Identify Redundancies**: Any rule, syntax, or pattern in the Target that is already well-covered in *all available* mirrors is "Common Knowledge" and should be deleted.
- **Identify Standard Inherent Knowledge**: Even if not explicitly in the mirrors, if a rule is something you (the agent) would do by default based on your own training (e.g., "use const"), it is redundant.
- **Preserve Differential Knowledge**: Keep only what is unique to this project or necessary to guide the AI effectively. This generally includes:
    - Rules that counter common AI biases.
    - Conventions chosen among valid alternatives.
    - Advanced patterns or heuristics that models know but often omit in their default output.

> [!TIP]
> While the primary goal is reduction, you may also **add** rules that fit the criteria for Differential Knowledge (e.g., new project-specific choices or behavioral steering) if you identify a need for them during the analysis.

### 3. Apply Surgical Edits
Perform the cleanup on the Target file. Aim for surgical edits that preserve the file's structure while removing unnecessary content.

In your response, provide an explanation of the changes made and the rationale for what was removed or kept.

### 4. Verification Step
After applying edits, perform a self-verification:
- **Contrast Check**: Verify that none of the rules in the new guide are present in the Knowledge Mirrors or part of standard AI behavior.
- **Preservation Check**: Ensure that critical project-specific rules identified in step 2 were not accidentally removed.

## Core Principles

- **Delete Redundancies**: If a model natively "knows" a rule, it does not belong in the skill.
- **Preserve Signal**: Keep instructions that force the model into "Senior Engineer" mode or align with specific project architecture.
- **Context Efficiency**: A lean skill is a fast and cheap skill.
