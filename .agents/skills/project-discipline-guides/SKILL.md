---
name: project-discipline-guides
description: Workflow for refactoring discipline-level guides (e.g., JavaScript, CSS) to remove "Standard Knowledge" and preserve only "Differential Knowledge" (project-specific standards and expert heuristics).
---

# Project Discipline Guides

This skill facilitates the "Differential Knowledge Refactor" of technical guides. It ensures that `SKILL.md` files for specific disciplines are lean, context-efficient, and strictly additive to what a modern AI model already knows natively.

## Workflow: Differential Knowledge Refactor

The goal is to apply an **Inverse Knowledge Filter** to a target guide.

### 1. Identify Reference Points (Sources)
Before refactoring, identify the "Standard Knowledge" baselines:
- **Source A (Internal)**: Any existing internal "best practices" or style guides.
- **Source B (External)**: Industry-standard documentation or modern language guides.
- **Internal Model Weights**: The inherent knowledge of modern models (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro).

### 2. Run the Differential Filter
Use the attached script to automate the comparison across multiple LLMs. This script uses Gemini 1.5 Flash and Claude 3.5 Sonnet via their REST APIs to identify redundancies.

```bash
# Set required environment variables
export GOOGLE_API_KEY="..."
export ANTHROPIC_API_KEY="..."

# Run the filter
node .agents/skills/project-discipline-guides/scripts/differential_filter.ts <target_skill_path> <source_1_path> <source_2_path>
```

### 3. Review and Refine
The script will output two refactored versions (one from Gemini Flash, one from Claude Sonnet). 
- **Analyze the deletions**: Ensure no project-specific steering was accidentally pruned.
- **Merge the best results**: Create a final `SKILL.md` that is surgically focused on:
    - **Behavioral Steering**: Rules that counter common AI biases (e.g., "CSS-First").
    - **Project-Specific Choices**: Conventions chosen among valid alternatives (e.g., "Named Exports only").
    - **Advanced Heuristics**: Expert patterns models often omit unless explicitly guided (e.g., "Shared Observer Instances").

## Core Principles

- **Delete Redundancies**: If a model natively "knows" a rule (e.g., "use const by default"), it does not belong in the skill.
- **Preserve Signal**: Keep instructions that force the model into "Senior Engineer" mode or align with specific project architecture.
- **Surgical Diffs**: When applying the refactor, favor surgical edits over total rewrites to keep the Git history readable.
