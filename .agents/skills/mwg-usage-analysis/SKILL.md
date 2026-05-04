---
name: mwg-usage-analysis
description: Analyzes the current session to report on which modern-web-guidance guides were used, which were bypassed, and the technical rationale for those decisions. Use at the end of a feature implementation or session involving modern-web usage.
---

# MWG Usage Analysis

This skill provides a structured way to analyze and document the usage of modern web guides within a development session. It ensures that architectural decisions—especially when bypassing recommended patterns—are clearly justified and recorded.

## Workflow

1.  **Scan Session History**: Review the current session's tool calls for `modern-web` skill usage. Identify all `retrieve` commands to see which guides were examined.
2.  **Verify Implementation**: Check the resulting codebase to confirm which of the retrieved guides were actually implemented.
3.  **Identify Discrepancies**: Pinpoint guides that were retrieved but not used in the final implementation.
4.  **Formulate Rationale**: For each unused guide, determine the technical reasoning (e.g., architectural mismatch, better alternative found, framework constraints).
5.  **Generate Report**: Create or update `MWG-USAGE-ANALYSIS.md` in the project root.

## Report Structure

The report should follow the format in `references/example_report.md`:

-   **Title**: Modern Web Guidance (MWG) Usage Analysis.
-   **Guides Retrieved & Implemented**: Group by category (e.g., Layout, Performance, User Experience). For each, list the guide ID and a brief summary of how it was applied.
-   **Guides Retrieved But Not Used**: List the guide ID and a detailed technical justification for why it was not implemented.

## Best Practices

-   **Be Technical**: Provide specific technical reasons for bypassing guides (e.g., "Astro's Multi-Page architecture makes the `same-document-transitions` SPA-focused API inapplicable").
-   **Maintain Continuity**: If an analysis file already exists, append or update it to reflect the full history of the project's interaction with the guidance pack.
-   **High Signal**: Focus on the *why* of architectural decisions.
