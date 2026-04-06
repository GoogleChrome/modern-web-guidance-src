# Modern Web Guidance

This curated collection of skills, tools, and AI-ready documentation injects Chrome's web platform knowledge directly into your workflow, ensuring your coding agent builds apps that are modern, fast, and secure by default.

## Installation

### 🍦 Universal Skills Pack
Consult your coding agent's documentation for installation instructions. You can also use Vercel's `skills` CLI:
```bash
DISABLE_TELEMETRY=1 npx skills add GoogleChrome/skills-alpha
```

### ✴️ Claude Code
```bash
/plugin marketplace add GoogleChrome/skills-alpha
/plugin install googlechrome-skills@skills-alpha
/reload-plugins
```

### ♊ Gemini CLI
```bash
gemini extensions install https://github.com/GoogleChrome/skills-alpha --auto-update
```
*(Note: If the CLI hits a 404 error and asks to install via "git clone" instead, simply say yes! This is perfectly normal while the project is in private alpha.)*

### 🌐 VSCode Extension


*Note: We'll publish to a markplace soon; In the meantime, install the slow way (which won't auto-update):*

* Clone this repo
* In VSCode, open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
* Select "Extensions: Install from Location..."
* Navigate to the `skills-alpha` directory and select it.

Compatibility with VSCode forks: unknown.
