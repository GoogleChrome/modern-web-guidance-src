# Command: discover

Discovers all files and configurations declaring browser compatibility baselines.

## Purpose
Reads configurations from ESLint, Stylelint, Browserslist, and custom config files to build a table of declared baselines.

## Detailed Steps

### ESLint (covers JS, TS, HTML, and CSS files)
Look for these config files, in order of precedence:
1. `eslint.config.mjs` / `eslint.config.js` / `eslint.config.cjs` (ESLint 9+ flat config)
2. `.eslintrc.json` / `.eslintrc.js` / `.eslintrc.yaml` / `.eslintrc.yml` (ESLint 8 legacy)
3. `eslintConfig` field in `package.json`

Within each file, extract the `available` option (and any allow-list exceptions) from these rules:
- `@html-eslint/use-baseline` (`@html-eslint/eslint-plugin`)
- `@eslint/css/use-baseline` (`@eslint/css`)
- `baseline-js/recommended` (`eslint-plugin-baseline-js`)

### Stylelint (covers CSS, SCSS, Less, and inline styles in HTML)
Look for these config files:
1. `stylelint.config.mjs` / `stylelint.config.js` / `stylelint.config.cjs`
2. `.stylelintrc` / `.stylelintrc.json` / `.stylelintrc.yaml` / `.stylelintrc.yml`
3. `stylelint` field in `package.json`

Extract setting from:
- `stylelint-plugin-use-baseline/use-baseline`

### Browserslist
Check:
1. `browserslist` field in `package.json`
2. `.browserslistrc` in project root

## Output Format
A markdown table detailing:
- Config file
- Tool
- Rule
- Setting
- Covers (file types)
