---
name: project-maintenance
description: Routine maintenance workflows: checking vendored deps, web-features/compat dataset updates, and doc coherence.
---

# Repository Maintenance

## 1. Check Vendored Dependencies

```bash
# @vercel/detect-agent
echo "Upstream: $(npm info @vercel/detect-agent version)" && echo "Vendored: $(grep -o 'detect-agent@[0-9.]*' serving/skills-cli/telemetry/detect-agent.ts)"
```

When updating:
1. Update `serving/skills-cli/telemetry/detect-agent.ts` with upstream changes and bump the version header comment.
2. Run tests:
   ```bash
   node --test serving/skills-cli/telemetry/detect-agent.test.ts serving/skills-cli/telemetry/ClearcutLogger.test.ts
   ```

## 2. Web Standards & Compatibility Datasets

### web-features
Automated by `.github/workflows/update-web-features.yml` (Mon/Thu). To run or test manually:
```bash
pnpm update --recursive web-features
node --experimental-strip-types guides/generate-feature-to-groups.ts
node --experimental-strip-types guides/validate-after-web-feature-update.ts
```

### Browser Compat & WebRef Data
Periodically update baseline compat packages:
```bash
pnpm update @mdn/browser-compat-data @webref/css @webref/elements @webref/idl caniuse-lite mdn-data
```

## 3. Document Coherence & Link Integrity

```bash
node --experimental-strip-types scripts/coherence-audit.ts
```
