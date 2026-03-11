---
name: baseline-status
description: Use this skill to check the browser support and Baseline status of web features using the local `baselinestatus` CLI.
---

# Web Baseline Status Skill

Use this skill when you need to verify if a web feature is ready for use or when you need browser support data for specific features. This project includes a dedicated CLI tool to query the `web-features` dataset.

## Tool Usage

The CLI tool is exposed via a root npm script.

### Commands

**Basic Search:**
To search for features by ID or description:
```bash
pnpm baselinestatus <query>
```
Example: `pnpm baselinestatus overflow`

**Filter by Status:**
To filter results by their Baseline status:
```bash
pnpm baselinestatus <query> --status <low|high|false>
```

### Baseline Status Mapping

The output maps internal status codes to human-readable terms:
- **Widely** (`high`): All major browsers have supported this for a significant time.
- **Newly** (`low`): Recently supported by all major browsers.
- **Limited** (`false`): Not yet supported by all major browsers.

## Implementation Details

- **Path**: `serving/scripts/baseline-status.ts`
- **Browsers tracked**: Chrome, Edge, Firefox, Safari, Safari iOS.
- **Output format**: Dynamically padded Markdown table, safe for terminal use and documentation.
- **Styling**: Colored output is automatically disabled when piped (non-TTY) but enabled for interactive terminal sessions.
