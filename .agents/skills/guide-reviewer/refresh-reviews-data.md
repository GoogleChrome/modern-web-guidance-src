# How to Refresh and Process Review Data

This guide explains how to use the `gather-reviews.ts` script to fetch fresh review data from GitHub and how to analyze that data to keep the Guide Reviewer persona up to date.

## Running the Script

The script uses the GitHub CLI (`gh`) to fetch PR reviews and comments.

### Prerequisites
1.  **GitHub CLI**: Ensure `gh` is installed and authenticated. Run `gh auth status` to verify.
2.  **Node.js**: Ensure you are using a modern Node.js version that supports running TypeScript files directly (Node 22+ with erasable syntax).

### Execution
Run the script from the **root of the repository**:

```bash
node .agents/skills/guide-reviewer/scripts/gather-reviews.ts
```

The script will:
1.  Search for PRs affecting the `guides/` directory.
2.  Filter reviews and comments by the target reviewers (Philip Walton, Rick Viscomi, Jeremy Wagner).
3.  Save the results to `.agents/skills/guide-reviewer/resources/reviews_data.json`.

## Processing the Data

The gathered data is a JSON array of PR objects. Each object contains reviews and inline comments.

### How to Consider the Data

When reviewing the data to update the skill or persona, look for the following patterns:

#### 1. Directives and Imperative Language
-   Look for how reviewers use `MANDATORY:`, `DO:`, and `DO NOT:`.
-   Are they asking for more strictness or relaxing rules?
-   Ensure descriptions are not labeled as `MANDATORY`.

#### 2. Structure and Readability
-   Note suggestions for breaking text into bulleted lists.
-   Check for preferences on heading levels (e.g., lowercase in `## Fallback strategies`).
-   Look for feedback on making content more "AI-friendly".

#### 3. Technical Constraints
-   Pay attention to warnings about feature performance (e.g., `text-wrap: pretty`).
-   Note recommendations for feature detection and fallback strategies.
-   Check for security advice (e.g., avoiding compromised CDNs).

#### 4. Test and Demo Robustness
-   Look for feedback on `grader.ts` and `demo.html`.
-   Reviewers prefer reliable locators (classes like `.test-dialog-trigger`) over brittle text matching.
-   Ensure negative demos are designed to fail reliably.

## Updating the Skill

If you identify new patterns or shifts in reviewer preferences:
1.  Open `.agents/skills/guide-reviewer/SKILL.md`.
2.  Update the **Core Review Principles** or **Persona** sections to reflect the new insights.
3.  Commit the changes to preserve history.
