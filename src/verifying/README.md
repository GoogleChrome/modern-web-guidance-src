# Live Browser Verification (`modern-web-guidance verify`)

Runs a headless Chromium audit against a live URL (and optionally `legacy-scan`
against a local directory) to catch runtime, layout, accessibility, CWV, and
modernization regressions with framework-aware `file:line:col` attribution.

## Usage

```bash
# Desktop live audit
modern-web-guidance verify http://localhost:3000

# Mobile viewport (390x844, DPR 3, touch) + 4x CPU throttling
modern-web-guidance verify http://localhost:3000 --mobile --cpu-throttle 4

# CI regression diffing with GitHub Actions annotations
modern-web-guidance verify http://localhost:3000 --json > baseline.json
modern-web-guidance verify http://localhost:3000 --baseline baseline.json --github

# Combine live browser checks with static legacy-scan
modern-web-guidance verify http://localhost:3000 --dir ./src
```

## Architecture

- `browser-audit.ts` + `source-locator.ts` — pure, browser-safe TypeScript compiled into an IIFE (`window.__mwgAudit`) at build time and reusable directly by DevTools / IDE extensions.
- `cdp.ts` — zero-dependency Node 22 WebSocket CDP client (Playwright headless shell or local Chrome).
- `verify.ts` — orchestrates CDP runtime/hydration/network listeners, compiled DOM audit, `DOMDebugger.getEventListeners` click-handler checks, Escape focus-trap probing, `legacy-scan`, and `--baseline` filtering.
- `cli.ts` — CLI flags and human / `--json` / `--github` formatters.
