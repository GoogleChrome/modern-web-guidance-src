---
name: project-evals
description: Best practices for creating expectations and grader files. Use this skill any time you're writing or reviewing an `expectations.md` or `grader.ts` file.
---

# Authoring `expectations.md`

* **`expectations.md`**: Write a natural language, bulleted list of assertions that must be true if an agent implements the `guide.md` correctly. (e.g., "The input element is styled with a red border only AFTER a blur event").

## Grading Note
* Graders (`grader.ts`) live within their respective guide folders. These are Playwright test files, but they are permitted to perform non-browser tests (like `str.includes()` on file contents) as well as actual browser automation checks.