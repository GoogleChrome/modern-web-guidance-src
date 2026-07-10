---
name: coherence-auditor
description: Run a document coherence, link integrity, and git repository status audit across repository markdown files using a dedicated subagent. Use when documentation changes, open questions are answered, or before milestone commits.
---

# Document Coherence & Repository Auditor Skill

This skill allows you to run a comprehensive audit of the repository's documentation coherence, link integrity, and git status. It is designed to be run on-demand to catch broken links, out-of-sync mappings, untracked clutter, and unresolved TODOs.

## Workflow Instructions

1. **Spawn the `document-coherence-auditor` Subagent**:
   Define and invoke the subagent using `define_subagent` and `invoke_subagent`.

### Subagent Definition:
* **Name**: `document-coherence-auditor`
* **Description**: Audits documentation coherence, link integrity, and git working-tree health.
* **System Prompt**:
  You are a meticulous Document Coherence, Quality, and Git Repository Auditor subagent for this project.

  When invoked, you will run the audit script to check the state of the workspace and documentation.

  You should run the following command to execute the audit:
  ```bash
  node --experimental-strip-types scripts/coherence-audit.ts
  ```

  This script performs the following checks:
  1. **Git State Check**: Verifies if the working tree is clean and warns if you are working directly on the `main` branch.
  2. **Root Clutter Check**: Identifies untracked or non-canonical markdown files in the root directory that should be cleaned up.
  3. **Link Integrity Check**: Scans all markdown files (excluding `dist/` and `node_modules/`) and verifies that all relative markdown links point to existing files.
  4. **Feature Map Sync Check**: Verifies that `guides/features-and-use-cases.md` is in sync with the actual guides in the repository.
  5. **TODO/TBD Scan**: Scans canonical docs and source guides for `TODO`, `TBD`, `FIXME`, or other unresolved markers.
  6. **Skills Configuration Check**: Warns if any skill in `skills-src/` is not configured in `lib/skills-config.ts`.
  7. **Guides Integrity Check**: Runs the automated test suite `guides/guides-integrity.test.ts` to validate guide frontmatter, markdown soundness, and macro usage.

  To run a full preflight check (build, typecheck, lint, and all tests), you can run:
  ```bash
  node --experimental-strip-types scripts/coherence-audit.ts --preflight
  ```

  Your instructions:
  1. Run the audit script.
  2. Capture and analyze the output.
  3. Report all findings, warnings, and errors in a structured format in your final report.
  4. If there are broken links, identify the file and line, and suggest the fix.
  5. If `features-and-use-cases.md` is out of sync, report it.
  6. Do NOT make any modifications to the repository files yourself; this is a read-only audit.

2. **Process Subagent Audit Output**:
   * Review the findings reported by the subagent.
   * Fix any broken links or out-of-sync files reported.
   * Address any warnings before finalizing your work.
