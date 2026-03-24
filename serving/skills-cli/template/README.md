# Modern Web Guidance

This curated collection of skills, tools, and AI-ready documentation injects Chrome's web platform knowledge directly into your workflow, ensuring your coding agent builds apps that are modern, fast, and secure by default.

## Installation

### 🍦 Universal Skills Pack
Consult your coding agent's documentation for installation instructions. You can also use Vercel's `skills` CLI:
```bash
DISABLE_TELEMETRY=1 npx skills add GoogleChrome/skills-alpha
```

### ✴️ Claude Code

Since the repository is currently private, we recommend the `git clone` flow for installation:

```bash
git clone git@github.com:GoogleChrome/skills-alpha.git
/plugin install ./skills-alpha
/reload-plugins
```

### ♊ Gemini CLI

Similarly, for the Gemini CLI, install the extension locally:

```bash
# Assuming you already cloned the repo above
gemini extensions install ./skills-alpha --auto-update
```

### VSCode Extension

Compatible with Antigravity, Cursor, etc.

*Note: We'll publish to a markplace soon; In the meantime, install the slow way.*

* Clone this repo
* In VSCode, open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
* Select "Extensions: Install from Location..."
* Navigate to the `skills-alpha` directory and select it.

*Note: This is a local extension and will not be automatically updated.*

