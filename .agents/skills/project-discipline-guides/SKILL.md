---
name: project-discipline-guides
description: Workflow for refactoring discipline-level guides (e.g., JavaScript, CSS) to remove "Common Knowledge" by generating and comparing against model-specific "Knowledge Mirrors".
---

# Project Discipline Guides

This skill facilitates the "Differential Knowledge Refactor" of technical guides. It ensures that `SKILL.md` files for specific disciplines are lean, context-efficient, and strictly additive to what modern AI models already know natively.

## Workflow: The Inverse Knowledge Filter

The goal is to aggressively "whittle down" a target guide (the **Target**) by removing any content that is natively understood by modern coding models.

### 1. Generate Knowledge Mirrors
Use the provided script to generate "Redundancy Mirrors"—comprehensive guides of what Gemini and Anthropic consider "Common Knowledge" for a given discipline.

```bash
# Ensure GOOGLE_API_KEY and ANTHROPIC_API_KEY are in your .env or environment
node .agents/skills/project-discipline-guides/scripts/generate_mirrors.ts <discipline_name>
```

This will create two files in a `mirrors/` directory:
- `mirrors/<discipline>_gemini_mirror.md` (via Gemini 3 Flash)
- `mirrors/<discipline>_claude_mirror.md` (via Claude 3.5 Sonnet)

### 2. Perform the Inverse Filter (Agent Task)
As the agent, read the **Target** guide and the two **Knowledge Mirrors**. 

- **Identify Redundancies**: Any rule, syntax, or pattern in the Target that is already well-covered in *both* mirrors is "Common Knowledge" and should be deleted.
- **Identify Standard Inherent Knowledge**: Even if not explicitly in the mirrors, if a rule is something you (the agent) would do by default based on your own training (e.g., "use const"), it is redundant.
- **Preserve Differential Knowledge**: Keep only what is unique to this project:
    - **Behavioral Steering**: Rules that counter common AI biases (e.g., "CSS-First").
    - **Project-Specific Choices**: Conventions chosen among valid alternatives (e.g., "Named Exports only").
    - **Advanced/Expert Heuristics**: Patterns that models know but often omit (e.g., "Shared Observer Instances").

### 3. Apply Surgical Edits
Perform the cleanup on the Target file. Aim for surgical edits that preserve the file's structure while drastically reducing its volume.

## Core Principles

- **Delete Redundancies**: If a model natively "knows" a rule, it does not belong in the skill.
- **Preserve Signal**: Keep instructions that force the model into "Senior Engineer" mode or align with specific project architecture.
- **Context Efficiency**: A lean skill is a fast and cheap skill.
