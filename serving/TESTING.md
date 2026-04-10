# Testing the serving stack

## Automated Tests

```sh
# With FULL=1 we do functional tests:

env FULL=1 TEST_REPORTER=spec pnpm --filter serving test
```

## Manual Testing & Reset Procedures

To verify that skills and the MCP server are installing and activating correctly in different clients, you can use these reset and install sequences.

### 1. Reset Environment

Clear any global installs or CLI state to ensure a clean slate:

```sh
npm uninstall --global modern-web

# Claude Code
claude plugin uninstall modern-web-guidance@googlechrome
# To remove the marketplace, run within claude: /plugin marketplace remove googlechrome

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



## Appendix: Uninstalling skilla-alpha versions.

We migrated names, so please drop the old ones.

If you have the old `skills-alpha`, use these commands to clean them up:

```sh
npm uninstall --global modern-web

claude # and then
# /plugin uninstall googlechrome-skills@skills-alpha
# /plugin marketplace remove skills-alpha

# Gemini CLI
gemini extensions uninstall https://github.com/GoogleChrome/skills-alpha

# Universal Skills CLI
DISABLE_TELEMETRY=1 npx -y skills remove --global modern-web-use-cases
```
