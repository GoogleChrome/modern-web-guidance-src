# Testing modern-web-mcp

This document outlines how to run automated tests and how to perform manual smoke tests or resets for the `modern-web-mcp` project.

## Automated Tests

Run all unit and integration tests using `npm`:

```bash
cd serving
npm run test
```

Run TypeScript type checks:

```bash
npm run typecheck
```

---

## Manual Testing & Reset Procedures

To verify that skills and the MCP server are installing and activating correctly in different clients, you can use these reset and install sequences.

### 1. Reset Environment

Clear any old global installs or CLI state to ensure a clean slate:

```bash
# Remove global modern-web CLI binaries
npm uninstall --global modern-web

# Purge gemini extensions
gemini extensions uninstall https://github.com/GoogleChrome/skills-alpha

# Purge claude plugins
claude plugin uninstall googlechrome-skills@skills-alpha

# Claude marketplaces cannot be done with CLI commands (must be done with slash commands)

# Purge standard skill assets
DISABLE_TELEMETRY=1 npx -y skills remove --global modern-web-use-cases
```

### 2. Verification Install Sequence

Re-install the standard web skills to prove runtime behavior:

```bash
# Verify base skills installer pulls correctly
DISABLE_TELEMETRY=1 npx skills add GoogleChrome/skills-alpha

# Establish bindings for claude
claude plugin install googlechrome-skills@skills-alpha

# Establish bindings for gemini
gemini extensions install https://github.com/GoogleChrome/skills-alpha --auto-update
```
