# Testing modern-web

## Automated Tests

```sh
cd serving
npm run test
```

## Manual Testing & Reset Procedures

To verify that skills and the MCP server are installing and activating correctly in different clients, you can use these reset and install sequences.

### 1. Reset Environment

Clear any old global installs or CLI state to ensure a clean slate:

```sh
npm uninstall --global modern-web

gemini extensions uninstall https://github.com/GoogleChrome/skills-alpha

claude plugin uninstall googlechrome-skills@skills-alpha
#   To remove the marketplace, need to use `/plugin`

DISABLE_TELEMETRY=1 npx -y skills remove --global modern-web-use-cases
```

### 2. Verification Install Sequence

Re-install the standard web skills to prove runtime behavior:

```sh
DISABLE_TELEMETRY=1 npx skills add GoogleChrome/skills-alpha

# Claude, assuming marketplace already added via: /plugin marketplace add GoogleChrome/skills-alpha
claude plugin install googlechrome-skills@skills-alpha

gemini extensions install https://github.com/GoogleChrome/skills-alpha --auto-update
```
