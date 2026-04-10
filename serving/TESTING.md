# Testing modern-web

## Automated Tests

```sh
cd serving
npm run test
```

## Uninstalling Deprecated Alpha Versions

If you have the old `skills-alpha` versions installed, use these commands to clean them up:

```sh
# Claude Code
claude plugin uninstall googlechrome-skills@skills-alpha

# Gemini CLI
gemini extensions uninstall https://github.com/GoogleChrome/skills-alpha

# Universal Skills CLI
DISABLE_TELEMETRY=1 npx -y skills remove --global modern-web-use-cases
```

## Manual Testing & Reset Procedures

To verify that skills and the MCP server are installing and activating correctly in different clients, you can use these reset and install sequences.

### 1. Reset Environment (New Names)

Clear any global installs or CLI state to ensure a clean slate:

```sh
npm uninstall --global modern-web

# Claude Code
claude plugin uninstall modern-web-guidance@googlechrome
# To remove the marketplace, use the interactive command inside Claude: /plugin marketplace remove googlechrome

# Gemini CLI
gemini extensions uninstall https://github.com/GoogleChrome/modern-web-guidance

# Universal Skills CLI
DISABLE_TELEMETRY=1 npx -y skills remove --global modern-web-use-cases
```

### 2. Verification Install Sequence

Re-install the skills to prove runtime behavior:

```sh
# Claude, assuming marketplace already added via interactive command:
# /plugin marketplace add GoogleChrome/modern-web-guidance
claude plugin install modern-web-guidance@googlechrome

# Gemini CLI
gemini extensions install https://github.com/GoogleChrome/modern-web-guidance --auto-update

# Universal Skills CLI
DISABLE_TELEMETRY=1 npx skills add GoogleChrome/modern-web-guidance
```

Example one-liners to test integration:

```sh
claude --plugin-dir ~/code/guidance/dist/skills-cli --allow-dangerously-skip-permissions -p "add an address form to the bottom of the page"
```
