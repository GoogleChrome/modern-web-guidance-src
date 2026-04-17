---
name: project-use-cases-research
description: Best practices and instructions for researching and authoring use-case level guidance (stage 1) for web platform features. Use this skill when you need to identify real-world developer problems solved by a specific web platform feature.
---

# Use Case Research: Identifying Use Cases for a Web Feature

The primary goal of this skill is to define the process for researching a specific web platform feature and translating it into a carefully selected set of its most common and important developer use cases (Stage 1 of the Guidance Pipeline).

## 1. Research

When tasked with researching a web feature to identify use cases, you must execute a sequence combining standard agent-driven research and automated deep research (if needed).

### Step 1: Gather Inputs
Identify the target feature and any seed sources. Inputs typically come from a GitHub issue or explicit arguments.

- **Feature ID**: Check the issue or arguments for the `web-features` ID (e.g., `fetch-later`, `bfcache`).
- **Seed URLs**: Extract any URLs provided in the issue or arguments. These are your starting points.
- **GitHub Issues**: If the feature ID is not clear, use the `gh` CLI to search for issues labeled `new-feature` to find context and seed URLs:
  ```bash
  gh issue list --repo GoogleChrome/guidance --label "new-feature"
  ```

### Step 2: Standard Agent Research
Use your tools to find authoritative documentation and real-world implementations.

1.  **MDN Web Docs**: Understand the API surface and technical constraints.
2.  **Chrome Authoritative Guidance**: Search `developer.chrome.com` or `web.dev` for implementation articles.
3.  **Specs/Explainers**: Check W3C specs or WICG explainers for architectural context.

Save your research findings to `guides/.research/<feature-id>.md` (create the directory if it doesn't exist). Use this file to track your findings.

### Step 3: Overlay Deep Research Enrichment (Optional)
If standard research is insufficient or if specifically requested by the user, run the automated deep research tool to identify complex edge cases or emerging patterns.

1.  **Run Deep Research**:
    ```bash
    node .agents/skills/project-use-cases-research/scripts/deep_research.js --feature-id <id>
    ```
2.  **Save Research Artifact**: The script will automatically save the output to `guides/.research/<feature-id>.md` (or similar).

---

## 2. Synthesis

Once research is complete, synthesize the findings into distinct developer use cases.

- **Apply the `project-use-cases` constraints**: Refer to `project-use-cases` skill for the authoritative rules on what constitutes a good use case (verb-first, WHAT-not-HOW).
- **Generic and Common**: Ensure your use cases are generic enough to fit common developer needs, avoiding overly specific or contrived examples (e.g., prefer concepts like "Expose complex UI forms" over overly specific apps like a "Flight Search").
- **Distinct Value Proposition**: Propose 2-5 distinct use cases. Do not duplicate existing guides. Check `guides/` for similar descriptions.
- **Save Representative Sources**: For each usecase, select at least one implementation-focused source (not just API reference).

---

## 3. Scaffolding

Automatically scaffold the initial files for the chosen use cases.

### Step 1: Create `guide.md`
Create a `guide.md` file in `guides/<category>/<slug>/` folder. Category should be one of `performance`, `accessibility`, `user-experience`, `security`, or a new category if it fits better. Slug must be a short kebab-case summary of the use case (not an action verb).

Required frontmatter:
```yaml
---
name: <slug>
description: <Short, action-oriented WHAT-not-HOW description>
web-feature-ids:
  - <feature-id>
sources:
  - <source-url>
---
```

### Step 2: Create `demo.html`
Create a `demo.html` file in the same directory. This should be a minimal, self-contained reference implementation with inline styles and scripts.

---

## 4. Validation

Before finalizing, conduct a quality pass.

- **Cross-Checking Subagent**: Invoke a subagent to compare the proposed use cases against the raw research data (`guides/.research/<feature-id>.md`). Ask it to verify that no important implementation details or edge cases were lost during synthesis.
- **Run Tests**: Run `pnpm test` or `pnpm --filter guides test` to ensure structural validity of the scaffolded files.

---

## Finalization

Once validated, present the proposed use cases and stubs to the user for approval.
