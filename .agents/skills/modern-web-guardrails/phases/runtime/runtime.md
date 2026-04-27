# Command: runtime

Triggers a live Lighthouse audit v13.1 over the running application surface.

## Purpose
Executes tests against a target URL to extract actual baseline runtime violations.

## Detailed Steps
1. Infer the test URL from dev servers, a `homepage` field in `package.json`, or prompts.
2. Run commands:
```bash
npx lighthouse <URL> --only-audits=baseline,deprecations,errors-in-console --output=html --output-path=./results/audit.html --chrome-flags="--headless"
npx lighthouse <URL> --only-audits=baseline,deprecations,errors-in-console --output=json --output-path=./results/report.json --quiet
```

## Extracted Information
Extract `.audits.baseline` and `.audits.deprecations` fields. Statuses are filtered by:
- `"limited"`: conflicts with all baseline configs.
- `"low"`: Newly Available. Conflicts with `widely` only.
- `"high"`: Widely Available.
