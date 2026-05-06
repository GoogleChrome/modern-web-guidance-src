---
name: project-discipline-guides
description: Workflow for refactoring discipline-level guides (e.g., JavaScript, CSS) to remove "Standard Knowledge" and preserve only "Differential Knowledge" (project-specific standards and expert heuristics).
---

# Project Discipline Guides

This skill facilitates the "Differential Knowledge Refactor" of technical guides. It ensures that `SKILL.md` files for specific disciplines are lean, context-efficient, and strictly additive to what a modern AI model already knows natively.

## Workflow: The Inverse Knowledge Filter

The goal is to aggressively "whittle down" a target guide (the **Target**) by removing any content that is natively understood by modern coding models.

### 1. Harvest Baseline Knowledge (Sources)
Before refactoring, you must collect the "Redundancy Mirrors"—documents that represent the baseline of what a modern model already knows.
- **Source Guides**: Identify 1-3 guides (Source A, B, etc.) that cover the "Standard" version of the discipline (e.g., a modern JS best practices guide, a standard CSS layout guide).
- **Validation of Inherent Knowledge**: These sources serve as *proof* that the information is common knowledge and can be safely deleted from the Target.

### 2. Run the Differential Filter
Execute the filter script to compare the **Target** against the harvested **Sources** and the models' own inherent weights. 

```bash
# Usage
node .agents/skills/project-discipline-guides/scripts/differential_filter.ts <target_path> <source_a> [source_b ...]
```

### 3. Review the "Signal"
The script produces a refactored version. Review it to ensure you have successfully deleted the "Volume" (redundancies) while preserving the "Signal" (the expert heuristics that models *know* but often omit without guidance).

## Core Principles

- **Delete Redundancies**: If a model natively "knows" a rule (e.g., "use const by default"), it does not belong in the skill.
- **Preserve Signal**: Keep instructions that force the model into "Senior Engineer" mode or align with specific project architecture.
- **Surgical Diffs**: When applying the refactor, favor surgical edits over total rewrites to keep the Git history readable.
