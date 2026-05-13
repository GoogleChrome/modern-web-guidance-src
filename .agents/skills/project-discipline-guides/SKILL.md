---
name: project-discipline-guides
description: Workflow for refactoring discipline-level guides (e.g., JavaScript, CSS) to remove "Common Knowledge" by generating and comparing against model-specific "Knowledge Mirrors".
---

# Project Discipline Guides

This skill facilitates the "Differential Knowledge Refactor" of technical guides. It ensures that `SKILL.md` files for specific disciplines are lean, context-efficient, and strictly additive to what modern AI models already know natively.

## Workflow: The Inverse Knowledge Filter

The goal is to aggressively "whittle down" a target guide (the **Target**) by removing any content that is natively understood by modern coding models.

### 1. Generate Knowledge Mirrors
Use the provided script to generate "Redundancy Mirrors"—comprehensive guides of what Gemini, Claude, and Codex consider "Common Knowledge" for a given discipline, and intersect them into a single LCD mirror.

```bash
# Ensure that model setup is configured (instructions are in the top level readme)
node .agents/skills/project-discipline-guides/scripts/generate_mirrors.ts <discipline_name>
```

This will create files inside the `.agents/skills/project-discipline-guides/mirrors/` directory:
- `mirrors/<discipline>/gemini_mirror.md` (via Gemini - temporary)
- `mirrors/<discipline>/claude_mirror.md` (via Claude - temporary)
- `mirrors/<discipline>/codex_mirror.md` (via Codex - temporary)
- `mirrors/<discipline>/mirror.md` (Unified Redundancy Mirror intersection)

> [!IMPORTANT]
> Ensure that the unified **Redundancy Mirror** (`.agents/skills/project-discipline-guides/mirrors/<discipline>/mirror.md`) has been successfully generated. This mirror represents the exact mathematical intersection of all three source models, preventing pruning errors and reducing context window overhead.

### 2. Perform the Inverse Filter (Agent Task)
As the agent, read the **Target** guide and the unified **Redundancy Mirror** (`.agents/skills/project-discipline-guides/mirrors/<discipline>/mirror.md`).

- **Strict A - B Comparison**: Compare rules in the Target guide strictly against the unified **Redundancy Mirror**. You should ONLY remove a rule or pattern from the Target guide if it is fully and clearly covered in the Redundancy Mirror.
- **No Subjective Self-Attestation**: Rely exclusively on the literal content present in the Redundancy Mirror. Do not prune rules based on your own subjective self-attestation of what you "know" or would do by default. If a concept is not in the Redundancy Mirror, it remains in the Target guide.
- **Avoid Blind Bullet-Point Deletions**: If a single bullet point or rule in the Target contains multiple guidelines or APIs, do **not** delete the entire bullet point just because some parts of it are common knowledge. Carefully split or dissect the rule, pruning only the redundant parts and explicitly retaining any differential knowledge.
- **Preserve Differential Knowledge**: Keep only what is unique to this project or necessary to guide the AI effectively. This generally includes:
    - Rules that counter common AI biases.
    - Conventions chosen among valid alternatives.
    - Advanced performance patterns, security constraints, or heuristics that models know but often omit in default outputs.

> [!WARNING]
> **Keep the Refactor Scoped**: The primary and sole goal of this skill is reduction of redundant common knowledge. Do **not** add new rules, modify logic, or introduce unrelated guidelines in this refactoring pass. Keep the changes highly focused and easy to review.

### 3. Apply Surgical Edits
Perform the cleanup on the Target file. Aim for surgical edits that preserve the file's structure while removing unnecessary content.

In your response, provide an explanation of the changes made and the rationale for what was removed or kept.

### 4. Verification Step
After applying edits, perform a self-verification:
- **Contrast Check**: Verify that none of the rules in the new guide are present in the Redundancy Mirror.
- **Preservation Check**: Ensure that critical project-specific rules, behavioral steering, and any specific advanced APIs (such as `Object.groupBy()`) were not accidentally removed.

## Core Principles

- **Delete Redundancies**: If a model natively "knows" a rule, it does not belong in the skill.
- **Preserve Signal**: Keep instructions that force the model into "Senior Engineer" mode or align with specific project architecture.
- **Context Efficiency**: A lean skill is a fast and cheap skill.
