# Command: catalog

Catalogs intentional inline disable overrides in the source codebase.

## Purpose
Searches the files for inline exceptions, recording scope overrides.

## Detailed Steps
Scan source files for these disable comment overrides:
- **ESLint disable comments**:
  - `eslint-disable-next-line @html-eslint/use-baseline`
  - `eslint-disable-next-line @eslint/css/use-baseline`
  - `eslint-disable-next-line baseline-js`
- **Stylelint disable comments**:
  - `/* stylelint-disable stylelint-plugin-use-baseline/use-baseline */`

Run searches with patterns:
```bash
grep -rn "eslint-disable.*use-baseline\|eslint-disable.*baseline-js" .
grep -rn "stylelint-disable.*use-baseline\|stylelint-disable.*unsupported" .
```

## Scope Definitions
- **next-line disable**: applies only to the next immediate line.
- **block disable**: applies between a disable and enable comment.
- **file disable**: covers the entire file.

Highlight **file-level or large-block suppression** (>20 lines) as advisory notices.
