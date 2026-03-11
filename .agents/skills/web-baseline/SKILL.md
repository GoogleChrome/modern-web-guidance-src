---
name: baseline-status
description: Use this skill to check the browser support and Baseline status of web features.
---

# Web Baseline Status Skill

Use this skill when you need to verify if a web feature is ready for use or when you need browser support data for specific features.

## Tool Usage

**Basic Search:**
To search for features by ID or description:
```bash
pnpm baselinestatus <query>
```
Example: `pnpm baselinestatus over`

**Filter by Status:**
To filter results by their Baseline status:
```bash
pnpm baselinestatus <query> --status <low|high|false>
```

The `--status` filter is essential for making architectural decisions:
- **`high`**: Finds features that are "safe" and broad-reaching (Widely).
- **`low`**: Identifies features that recently became available across all browsers (Newly), which might need close monitoring or minimal polyfills.
- **`false`**: Highlights "bleeding edge" features (Limited) that are not yet universal and require careful progressive enhancement or fallback strategies.

### Baseline Status Mapping

The output maps internal status codes to human-readable terms:
- **Widely available** (`high`): All major browsers have supported this for a significant time.
- **Newly available** (`low`): Recently supported by all major browsers.
- **Limited availability** (`false`): Not yet supported by all major browsers.
