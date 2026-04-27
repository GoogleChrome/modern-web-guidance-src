# Context Gathering

Instructions for extracting baseline context natively from code files without intermediate scripts.

## Purpose
Ensures the agent understands all declared browser compatibility expectations before performing the audit.

## Instructions for Agent

To gather context, you must view and parse the following files using built-in tools (`view_file`):

### 1. Read package.json
- Inspect the `browserslist`, `eslintConfig`, and `stylelint` fields.
- Record any explicit baseline tiers declared.

### 2. Read Configuration Files
Inspect the following files if present in the project root:
- **ESLint**: `eslint.config.*`, `.eslintrc.*`
- **Stylelint**: `stylelint.config.*`, `.stylelintrc.*`
- **Browserslist**: `.browserslistrc`
- **Custom**: `baseline.config.json`

Extract all explicit rule levels (`available`, rule exceptions, and custom overrides) and build the internal reference model.
