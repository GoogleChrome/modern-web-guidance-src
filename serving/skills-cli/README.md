# Web Dev Guidance

A curated collection of agent skills and tools to web development.

## Installation

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

### Universal Skills Pack
Consult your coding agent's documentation for installation instructions. You can also use Vercel's `skills` CLI:
```bash
DISABLE_TELEMETRY=1 npx skills add GoogleChrome/skills-alpha
```

### VSCode Extension

Compatible with Antigravity, Cursor, etc.

*Note: We'll publish to a markplace soon; In the meantime, install the slow way.*

* Clone this repo
* In VSCode, open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
* Select "Extensions: Install from Location..."
* Navigate to the `skills-alpha` directory and select it.

*Note: This is a local extension and will not be automatically updated.*

