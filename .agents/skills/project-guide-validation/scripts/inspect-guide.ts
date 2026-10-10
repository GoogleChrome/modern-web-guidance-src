import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { classifyGuide, inventoryGuide, processGuideInventory } from '../../../../src/core/guide-validation.ts';
import { rootDir } from '../../../../src/core/paths.ts';
import { resolveInclude } from '../../../../src/core/include.ts';
import { replaceMacros } from '../../../../src/core/macros.ts';

const args = process.argv.slice(2);
const printRendered = !args.includes('--no-render');
const targets = args.filter((a) => !a.startsWith('--'));

if (targets.length === 0) {
  console.error('Usage: node .agents/skills/project-guide-validation/scripts/inspect-guide.ts [--no-render] <guide-dir-or-file> [...]');
  process.exit(1);
}

let hasErrors = false;

for (const input of targets) {
  const abs = path.resolve(input);
  const guideDir = abs.endsWith('guide.md') ? path.dirname(abs) : abs;
  const relDir = path.relative(rootDir, guideDir);
  const guidePath = path.join(guideDir, 'guide.md');

  if (!fs.existsSync(guidePath)) {
    console.error(`❌ Guide not found: ${relDir}/guide.md`);
    hasErrors = true;
    continue;
  }

  const inv = inventoryGuide(guideDir);
  const { errors } = processGuideInventory([inv]);
  const raw = fs.readFileSync(guidePath, 'utf8');
  const lines = raw.split('\n');

  if (lines.filter((l) => l.trim().startsWith('```')).length % 2 !== 0) {
    errors.push(`Odd number of code block fences (\`\`\`) in ${relDir}/guide.md.`);
  }
  if (lines.some((l) => /^(<<<<<<<|=======|>>>>>>>)/.test(l))) {
    errors.push(`Git conflict marker found in ${relDir}/guide.md.`);
  }

  const warnings: string[] = [];
  if (inv.hasGuide && !inv.isStub && !inv.draft && !inv.isDisciplineGuide && (!inv.hasExpectations || inv.expectationsEmpty)) {
    warnings.push(`Completed guide ${relDir} is missing a non-empty expectations.md.`);
  }

  const { content: body } = matter(raw);
  for (const [, featureId] of body.matchAll(/\{\{\s*FEATURE_FALLBACKS\(\s*["']([^"']+)["']\s*\)\s*\}\}/g)) {
    if (!resolveInclude(`features/${featureId}.md#fallbacks`, guidePath).content?.trim()) {
      warnings.push(`FEATURE_FALLBACKS("${featureId}") has no #fallbacks section in features/${featureId}.md (prefer BASELINE_STATUS or add #fallbacks).`);
    }
  }

  if (!inv.isDisciplineGuide && inv.hasExpectations && inv.targets?.some((t) => t.hasGrader)) {
    try {
      const { validateGraderExpectationCoverage, formatCoverageFailureMessage } = await import('../../../../src/core/grader-coverage.ts');
      for (const t of inv.targets.filter((t) => t.hasGrader)) {
        const cov = await validateGraderExpectationCoverage(path.join(guideDir, 'expectations.md'), path.join(t.dir, 'grader.ts'));
        if (!cov.isComplete) errors.push(formatCoverageFailureMessage(cov, rootDir));
      }
    } catch {
      warnings.push('Skipped semantic grader expectation coverage check (run pnpm install to enable).');
    }
  }

  console.log(`=== ${relDir} (${classifyGuide(inv)}) — features: ${inv.featureIds.join(', ') || '(none)'} ===`);
  for (const w of warnings) console.warn(`⚠️  ${w}`);
  for (const e of errors) console.error(`❌ ${e}`);
  if (errors.length === 0) console.log('✅ Validation passed.');
  else hasErrors = true;

  if (printRendered && body.trim() && errors.length === 0) {
    console.log('\n--- Rendered Guide (skills-cli target) ---');
    console.log(replaceMacros(body, guidePath, { target: 'skills-cli' }).trim());
    console.log('--- End Rendered Guide ---\n');
  }
}

if (hasErrors) process.exit(1);
