# Guidance Project Architecture & Workflow

## Overview
This document serves as a living specification of the Guidance project's architecture, its evaluation harness, and the developer workflow. It reflects the modern, automated pipeline orchestrated by the `gd` CLI. 

This document is intended to provide comprehensive context for engineers, contributors, and AI agents interacting with the codebase.

---

## Core Objective
The primary goal of this project is to produce high-quality, actionable documentation ("guidance") for web developers on how to implement modern browser features. Simultaneously, the project runs an automated evaluation ("evals") pipeline to ensure the guidance is robust and instructive enough that an AI coding agent can successfully follow it to build out implementations.

## The Contributor Workflow
Subject Matter Experts (SMEs) contribute to the `guides/` directory. For a given web feature, an SME provides 2-5 distinct, action-oriented use cases. 

### Core Artifacts
For every usecase directory, the SME is responsible for authoring three core artifacts:
* `guide.md`: A highly-structured, imperative set of instructions for coding agents. It must contain strict YAML frontmatter (`name`, `description`, `web-feature-ids`, etc.) and provide explicit `DO` and `DO NOT` directives. Check `guides/AGENTS.md` for specific instructions.
* `expectations.md`: A natural language (human-authored) bulleted summary of the assertions that must be true if the guidance in `guide.md` is followed correctly.
* `demo.html`: A pristine, canonical implementation that successfully fulfills the `expectations.md` and implements the `guide.md`.

---

## The Evaluation Infrastructure & The `gd` CLI
Previously, preparing a guide for the evaluation harness involved a fragmented, multi-step series of CLI scripts (generating negatives, graders, running calibration, debugging Playwright failures, etc.). 

This has been modernized into an automated, single-command pipeline orchestrated by the `gd` CLI.

### Guide Development Pipeline (`gd guide dev`)
To bridge the gap between human-authored guidance and the automated evaluation harness, the `gd guide dev <dir>` command automates the entire preparation phase.

When invoked on a guide directory containing the three core artifacts, the CLI steps through this automated workflow:

1. **Scaffolds Negative Demos**: It invokes an LLM to automatically generate `negative-demo.html` based on the positive demo and the expectations.
2. **Generates Grader Tests**: It invokes an LLM to translate the assertions in `expectations.md` into an executable Playwright test script (`grader.ts`).
3. **Calibrates the Grader via Retry Loop**: The pipeline automatically runs the generated `grader.ts` against both `demo.html` (expecting 100% passes) and `negative-demo.html` (expecting failures). 
   * **Crucially**, if the Playwright tests fail calibration (e.g., due to flaky selectors or incorrect logic), the pipeline traps the failure context and feeds it *back* to the LLM to regenerate a fixed `grader.ts`. This loop continues until the grader reliably evaluates both demos, successfully stabilizing the logic without human intervention.
4. **Agent Testing**: By default, the `dev` command will run a complete agent test against the guide once the infrastructure is calibrated. It runs an unguided agent test and a guided agent test, grading both outputs, and prints a comparative report detailing the exact impact of the guidance. You can skip this step by passing `--no-test`.

### CLI Namespaces
The `gd` tool separates concerns into distinct namespaces:
* **`gd guide ...`**: Workflows tailored for SMEs developing individual guides (e.g., `gd guide dev`).
* **`gd eval ...`**: Workflows for infrastructure engineers to run large-scale automated benchmark suites and dashboards across all fully-calibrated guides.

---

## Roles and Responsibilities
Through this architecture, responsibilities are cleanly isolated:
* **Subject Matter Experts (SMEs)**: Focus exclusively on technical accuracy, understanding edge cases, and building the canonical demo (`guide.md`, `expectations.md`, `demo.html`). They are shielded from the underlying Playwright infrastructure and do not need to be functional test engineers.
* **Infrastructure Engineers**: Focus on the reliability of the `gd` CLI, the evaluation harness scale, managing LLM invocation stability, and solving interpretability challenges (like debugging 0% Delta guided vs unguided passrates).
* **LLM Pipeline (`gd guide dev`)**: Automatically bridges the gap by translating natural language expectations into robust Playwright test assertions and scaffolding negative test cases, absorbing the friction of maintaining the testing infra.
