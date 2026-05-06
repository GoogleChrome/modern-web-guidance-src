---
name: project-discipline-guides
description: Workflow for refactoring discipline-level guides (e.g., JavaScript, CSS) to remove "Standard Knowledge" and preserve only "Differential Knowledge" (project-specific standards and expert heuristics).
---

# Project Discipline Guides

This skill facilitates the "Differential Knowledge Refactor" of technical guides. It ensures that `SKILL.md` files for specific disciplines are lean, context-efficient, and strictly additive to what a modern AI model already knows natively.

## Workflow: The Inverse Knowledge Filter

The goal is to aggressively "whittle down" a target guide by removing anything that modern coding models already know natively.

### 1. Identify Redundancy References (Sources)
Identify the baseline documents that represent "Standard Knowledge":
- **Source A & B**: External or internal guides that cover modern language features (e.g., a modern ES2022+ guide).
- **Model Inherent Knowledge**: The existing training weights of models like Claude 3.5 or Gemini 1.5.

### 2. Run the Differential Filter
Use the attached script to automate the comparison. The script uses multiple models to cross-reference the target against the sources and their own internal weights.

```bash
# Run the filter
node .agents/skills/project-discipline-guides/scripts/differential_filter.ts <target_skill_path> <redundancy_source_A> <redundancy_source_B>
```

### 3. Review for "Signal"
The script will output refactored versions that are strictly additive. Review these to ensure you haven't lost the "Signal"—the high-value expertise that models know but often omit without guidance.

## Core Principles

- **Delete Redundancies**: If a model natively "knows" a rule (e.g., "use const by default"), it does not belong in the skill.
- **Preserve Signal**: Keep instructions that force the model into "Senior Engineer" mode or align with specific project architecture.
- **Surgical Diffs**: When applying the refactor, favor surgical edits over total rewrites to keep the Git history readable.
