# Modern Web Guidance

This curated collection of skills, tools, and AI-ready documentation injects Chrome's web platform knowledge directly into your workflow, ensuring your coding agent builds apps that are modern, fast, and secure by default.

## Installation

```bash
npx modern-web-guidance install
```

### 🍦 Universal Skills Pack
Consult your coding agent's documentation for installation instructions. You can also use Vercel's `skills` CLI:
```bash
DISABLE_TELEMETRY=1 npx skills add GoogleChrome/modern-web-guidance
```

### ✴️ Claude Code
```bash
/plugin marketplace add GoogleChrome/modern-web-guidance
/plugin install modern-web-guidance@googlechrome
/reload-plugins
```

### ♊ Gemini CLI
```bash
gemini extensions install https://github.com/GoogleChrome/modern-web-guidance --auto-update
```
*(Note: If the CLI hits a 404 error and asks to install via "git clone" instead, simply say yes! This is perfectly normal while the project is in private alpha.)*

### 🌐 VSCode Extension


*Note: We'll publish to a markplace soon; In the meantime, install the slow way (which won't auto-update):*

* Clone this repo
* In VSCode, open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
* Select "Extensions: Install from Location..."
* Navigate to the `modern-web-guidance` directory and select it.

Compatibility with VSCode forks: unknown.

## Usage Statistics

Google collects anonymous usage statistics (such as search and retrieve queries) to improve the reliability, relevance, and performance of the Modern Web Guidance tool.

Data collection is enabled by default. You can opt-out completely at any time by setting the `DISABLE_MWG_TELEMETRY=1` environment variable in your shell profile (e.g., `.bashrc` or `.zshrc`):

```bash
export DISABLE_MWG_TELEMETRY=1
```

Google handles this data in accordance with the [Google Privacy Policy](https://policies.google.com/privacy).
