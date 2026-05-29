---
name: guide-migration
description: Workflow for migrating Modern Web Guidance guides from Option A (standalone demo) to Option B (patch-based base app integration).
---

# Guide Migration Skill

Use this skill when migrating a guide to Option B (patch-based integration with base apps).

## Workflow

### 1. Research & Planning
- Identify the target guide (e.g., `guides/forms/some-guide`).
- Read the following files to understand the requirements:
  - [guide.md](file:///usr/local/google/home/paulirish/code/guidance/guides/{category}/{guide}/guide.md)
  - [expectations.md](file:///usr/local/google/home/paulirish/code/guidance/guides/{category}/{guide}/expectations.md)
  - [demo.html](file:///usr/local/google/home/paulirish/code/guidance/guides/{category}/{guide}/demo.html) (if it exists)
  - [tasks/task.md](file:///usr/local/google/home/paulirish/code/guidance/guides/{category}/{guide}/tasks/task.md)
- Identify the base app (specified in `tasks/task.md` frontmatter, usually in `harness/base_apps/`).

### 2. Implementation in Base App
- Open the base app's main file (typically `harness/base_apps/{base_app}/index.html`).
- Implement the requirements from the guide and `demo.html` into the base app.
- **Critical: Grader Compatibility**:
  - Check the `grader.ts` to see what selectors it uses.
  - If the grader uses generic selectors (e.g., `input[type="text"]`, `select`), ensure your implemented elements match these selectors.
  - If there are existing elements in the base app that match these generic selectors, you may need to apply the styles globally or ensure the grader targets the correct elements.
  - If the project plan calls for `data-testid` alignment, add `data-testid` attributes as defined in the plan/guidelines and update the grader/expectations accordingly.

### 3. Local Verification
- Test your changes against the grader *before* saving the solution.
- Since `pnpm test-grader` restores git state (wiping your changes), you must run Playwright directly:
  ```bash
  PATH="/usr/local/google/home/paulirish/.nvm/versions/node/v24.13.0/bin:$PATH" TARGET_FILE=harness/base_apps/{base_app}/index.html pnpm exec playwright test -c guides/playwright.config.ts guides/{category}/{guide}/grader.ts
  ```
- Debug any failures. If the grader fails due to strict mode violations (e.g., matching multiple elements), update the grader to use more specific locators (e.g., scoping to the form, or using `getByRole` with exact text).

### 4. Save Solution & Calibrate
- Once all tests pass locally, save the solution as a patch:
  ```bash
  PATH="/usr/local/google/home/paulirish/.nvm/versions/node/v24.13.0/bin:$PATH" node --experimental-strip-types bin/gd.ts dev guides/{category}/{guide} --save-solution
  ```
  This command will:
  - Generate `solution.patch` in the guide directory.
  - Restore the base app to its clean git state.
- Verify calibration (both positive and negative checks):
  ```bash
  PATH="/usr/local/google/home/paulirish/.nvm/versions/node/v24.13.0/bin:$PATH" corepack pnpm test-grader guides/{category}/{guide}
  ```

### 5. Cleanup & Commit
- Trash the legacy `solution/` folder if it exists (using `trash` CLI).
- Stage and commit **only** the modified/created files in the guide directory:
  - `guides/{category}/{guide}/solution.patch`
  - `guides/{category}/{guide}/grader.ts` (if modified)
  - `guides/{category}/{guide}/expectations.md` (if modified)
- Use a descriptive commit message: `{guide_name}: migrate to patch`.
