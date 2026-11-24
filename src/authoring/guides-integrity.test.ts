import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import matter from '@11ty/gray-matter';
import { marked } from 'marked';

// Import shared utilities
import { scanAllGuides, processGuideInventory } from '../core/guide-validation.ts';
import { replaceMacros, MACRO_PATTERN } from '../core/macros.ts';
import { validateGraderExpectationCoverage, formatCoverageFailureMessage } from '../core/grader-coverage.ts';
import type { GraderLintViolation, GraderRuleId } from '../core/grader-lint.ts';
import { gitExec } from '../core/git-utils.ts';
import { rootDir } from '../core/paths.ts';
import { findStaleTargets } from './dev.ts';

const REPO_ROOT = rootDir;

// Legacy allowlists/ratchets for pre-existing corpus violations so zero new regressions can land.
const LEGACY_GRADER_VIOLATION_LIMITS: Record<string, Partial<Record<GraderRuleId, number>>> = {
  'guides/forms/switch/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 2 },
  'guides/html/html/targets/devtools-times/grader.ts': { 'no-unguarded-every': 2 },
  'guides/html/prerendering-custom-elements/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 1 },
  'guides/html/shadow-dom/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 1 },
  'guides/html/web-components/targets/daily-grind/grader.ts': { 'no-unguarded-every': 2 },
  'guides/security/local-network-access/targets/devtools-times/grader.ts': { 'no-unguarded-every': 1 },
  'guides/security/secure-external-subresources/targets/daily-grind/grader.ts': { 'no-unguarded-every': 1 },
  'guides/ui-behaviors/2d-panning/targets/daily-grind/grader.ts': { 'no-unguarded-every': 2 },
  'guides/ui-behaviors/consistent-cross-document-transitions/targets/devtools-times/grader.ts': { 'no-unguarded-every': 4 },
  'guides/ui-behaviors/drag-and-drop/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 1 },
  'guides/ui-components/app-menus/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 1 },
  'guides/ui-components/breadcrumbs/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 1 },
  'guides/ui-components/carousel/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 2 },
  'guides/ui-components/menu/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 43 },
  'guides/ui-components/progress/targets/daily-grind/grader.ts': { 'no-unguarded-every': 1 },
  'guides/ui-components/progress-ring/targets/daily-grind/grader.ts': { 'no-early-return-before-assertion': 1 },
  'guides/ui-components/spinner/targets/daily-grind/grader.ts': { 'no-unguarded-every': 1 },
  'guides/user-experience/natural-interactions/targets/daily-grind/grader.ts': { 'no-fixed-timeout': 5 },
};

const LEGACY_DIRTY_PATCHES = new Set([
  'guides/accessibility/accessibility/targets/daily-grind/patches/codex-solution.patch',
  'guides/css/css/targets/daily-grind/patches/antigravity-solution.patch',
  'guides/forms/slider/targets/daily-grind/patches/codex-solution.patch',
  'guides/performance/interaction-paint-timing/targets/daily-grind/patches/antigravity-solution.patch',
  'guides/performance/optimize-image-priority/targets/daily-grind/patches/codex-solution.patch',
  'guides/security/passkey-management/targets/daily-grind/patches/claude-solution.patch',
  'guides/security/passkey-management/targets/daily-grind/patches/codex-solution.patch',
  'guides/security/quick-sign-ins/targets/daily-grind/patches/antigravity-solution.patch',
  'guides/ui-behaviors/prevent-page-scroll-under-modal-dialog/targets/daily-grind/patches/codex-solution.patch',
  'guides/ui-components/hovercard/targets/daily-grind/patches/codex-solution.patch',
  'guides/ui-components/progress-ring/targets/daily-grind/patches/codex-solution.patch',
  'guides/ui-components/tabs/targets/daily-grind/patches/antigravity-solution.patch',
  'guides/visual-design/custom-text-decorations/targets/daily-grind/patches/codex-solution.patch',
  'guides/webmcp/agentic-forms/targets/daily-grind/patches/codex-solution.patch',
]);

const LEGACY_HEDGED_EXPECTATIONS = new Set([
  'guides/accessibility/respect-os-text-scale/expectations.md',
  'guides/css/calculate-with-intrinsic-sizes/expectations.md',
  'guides/css/css-layout/expectations.md',
  'guides/css/design-token-reactivity/expectations.md',
  'guides/forms/forms/expectations.md',
  'guides/forms/slider/expectations.md',
  'guides/performance/full-session-analytics/expectations.md',
  'guides/performance/improve-next-page-load-performance/expectations.md',
  'guides/ui-atoms/position-aware-tooltips/expectations.md',
  'guides/ui-behaviors/drag/expectations.md',
  'guides/ui-behaviors/swipe-to-remove/expectations.md',
]);

describe('Guides Validation (Single Source of Truth)', () => {
  const guides = scanAllGuides();
  const staleTargets = findStaleTargets(REPO_ROOT);

  if (guides.length === 0) {
    test('No guides found', () => {
      assert.fail('No guides found in the workspace');
    });
    return;
  }

  it('ensures all guide IDs are unique', () => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const guide of guides) {
      if (seen.has(guide.name)) {
        duplicates.add(guide.name);
      }
      seen.add(guide.name);
    }
    if (duplicates.size > 0) {
      assert.fail(`Duplicate guide IDs found: ${Array.from(duplicates).join(', ')}`);
    }
  });

  for (const guide of guides) {
    const relativeDir = path.relative(REPO_ROOT, guide.dir);

    it(`validates ${relativeDir}`, () => {
      const result = processGuideInventory([guide]);
      
      if (result.hasError) {
        assert.fail(`Validation errors found in ${relativeDir}:\n${result.errors.join('\n')}`);
      }
    });

    it(`validates markdown soundness for ${relativeDir}`, () => {
      const guidePath = path.join(guide.dir, 'guide.md');
      if (!fs.existsSync(guidePath)) return;

      const content = fs.readFileSync(guidePath, 'utf8');

      // 1. Check frontmatter with @11ty/gray-matter
      try {
        const { data } = matter(content);
        assert.ok(data, 'Frontmatter should be parsable');
      } catch (e) {
        assert.fail(`Frontmatter parsing failed: ${e}`);
      }

      // 2. Check for unclosed code blocks (fence count)
      // Note: We use a simple fence count check because standard parsers like marked
      // silently consume unclosed blocks to the end of the file. Since many guides
      // legitimately end with a code block, checking if the last token is a code block
      // yields too many false positives. Linters are also too noisy with style rules.
      const lines = content.split('\n');
      const fenceLines = lines.filter(line => line.trim().startsWith('```'));
      if (fenceLines.length % 2 !== 0) {
        assert.fail(`Odd number of code block fences (\`\`\`) in ${relativeDir}. Likely an unclosed code block.`);
      }

      // 3. Check with marked
      try {
        const tokens = marked.lexer(content);
        assert.ok(tokens.length > 0, 'Marked should produce tokens');
      } catch (e) {
        assert.fail(`Marked parsing failed: ${e}`);
      }

      // 4. Check for git conflict markers at the start of a line
      const conflictMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
      for (const marker of conflictMarkers) {
        if (lines.some(l => l.startsWith(marker))) {
          assert.fail(`File contains git conflict marker "${marker}" in ${relativeDir}`);
        }
      }
    });

    // Transclusion macros silently return "" for missing files/sections, which
    // validateMacros (error-throw based) does not catch. Guard against
    // accidentally referencing a path/section that doesn't exist.
    //
    // Excluded macros:
    // - FEATURE_ISSUES: "" is its documented return when #issues is empty/missing,
    //   so an empty result is not a bug.
    // - BASELINE_STATUS: not a transclusion macro; it either returns content or
    //   throws (already caught by validateMacros), so a non-empty check is redundant.
    it(`validates transclusion macros for ${relativeDir}`, () => {
      const guidePath = path.join(guide.dir, 'guide.md');
      if (!fs.existsSync(guidePath)) return;

      const { content: body } = matter(fs.readFileSync(guidePath, 'utf8'));
      const REQUIRED = new Set(['INCLUDE', 'FEATURE', 'FEATURE_FALLBACKS']);

      for (const match of body.matchAll(MACRO_PATTERN)) {
        const [full, name] = match;
        if (!REQUIRED.has(name)) continue;
        const result = replaceMacros(full, guidePath);
        if (!result.trim()) {
          assert.fail(`${full} in ${relativeDir} returned empty content (file or section not found).`);
        }
      }
    });

    const targetsDir = path.join(guide.dir, 'targets');
    const expectationsPath = path.join(guide.dir, 'expectations.md');

    // Discipline guide graders only cover the expectations relevant to each target app.
    if (!guide.isDisciplineGuide && fs.existsSync(targetsDir) && fs.existsSync(expectationsPath)) {
      const targetApps = fs.readdirSync(targetsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name);

      for (const targetApp of targetApps) {
        const targetGraderPath = path.join(targetsDir, targetApp, 'grader.ts');
        if (!fs.existsSync(targetGraderPath)) continue;

        it(`validates expectation coverage for target ${relativeDir}/targets/${targetApp}`, async () => {
          // Stale graders (expectations.md modified after grader.ts) are tracked in #1815.
          const relGrader = path.relative(REPO_ROOT, targetGraderPath).split(path.sep).join('/');
          if (staleTargets.has(relGrader)) return;

          const result = await validateGraderExpectationCoverage(expectationsPath, targetGraderPath);
          if (!result.isComplete) {
            assert.fail(formatCoverageFailureMessage(result, REPO_ROOT));
          }
        });
      }
    }
  }

  it('checks all tracked files for conflict markers', () => {
    const files = gitExec(['ls-files'], { cwd: REPO_ROOT }).trim().split('\n');
    const extensions = ['.md', '.html', '.txt', '.yaml', '.yml'];
    const conflictMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
    const failedFiles: string[] = [];

    for (const file of files) {
      const ext = path.extname(file);
      if (!extensions.includes(ext)) continue;

      const filePath = path.resolve(REPO_ROOT, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileLines = content.split('\n');
        for (const marker of conflictMarkers) {
          if (fileLines.some(l => l.startsWith(marker))) {
            failedFiles.push(`${file} (contains "${marker}")`);
            break;
          }
        }
      } catch (e) {
        // Ignore files that cannot be read
      }
    }

    if (failedFiles.length > 0) {
      assert.fail(`Conflict markers found in the following files:\n${failedFiles.join('\n')}`);
    }
  });

  it('validates all feature override keys in .github/atls.json', async () => {
    const { validateFeature } = await import('../core/baseline.ts');
    const atlsPath = path.join(REPO_ROOT, '.github', 'atls.json');
    const atlsConfig = JSON.parse(fs.readFileSync(atlsPath, 'utf8'));
    const featureIds = Object.keys(atlsConfig.web_features || {});

    for (const fid of featureIds) {
      const res = validateFeature(fid);
      if (!res.isValid) {
        assert.fail(`Feature ID "${fid}" in .github/atls.json is invalid: ${res.errorMessage}`);
      }
    }
  });

  it('validates that pending temporary feature groups and compat_features are valid', async () => {
    const { groups } = await import('web-features');
    const pendingPath = path.join(REPO_ROOT, 'features', 'pending-web-features.json');
    const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));

    for (const [fid, entry] of Object.entries<{ group?: string | string[]; compat_features?: string | string[] }>(pending)) {
      const entryGroups = entry.group === undefined ? [] : [entry.group].flat();
      for (const group of entryGroups) {
        if (!(group in groups)) {
          assert.fail(`Feature ID "${fid}" in features/pending-web-features.json has unknown group "${group}"`);
        }
      }

      const compatKeys = entry.compat_features === undefined ? [] : [entry.compat_features].flat();
      for (const bcdKey of compatKeys) {
        assert.ok(
          typeof bcdKey === 'string' && bcdKey.trim().length > 0 && bcdKey.includes('.'),
          `Feature ID "${fid}" in features/pending-web-features.json has invalid compat_features entry "${bcdKey}"`
        );
      }
    }
  });

  it('ensures feature-to-groups.gen.json is synchronized with .github/atls.json', async () => {
    const { buildFeatureToGroupsJson, FEATURE_TO_GROUPS_PATH } = await import('../ci/generate-feature-to-groups.ts');
    assert.strictEqual(
      fs.readFileSync(FEATURE_TO_GROUPS_PATH, 'utf8'),
      buildFeatureToGroupsJson(),
      'src/ci/feature-to-groups.gen.json is out of date. Run: node src/ci/generate-feature-to-groups.ts'
    );
  });

  it('validates that all features/tmp-*.md files are registered in features/pending-web-features.json', async () => {
    const { validateFeature } = await import('../core/baseline.ts');
    const featuresDir = path.join(REPO_ROOT, 'features');
    const files = fs.readdirSync(featuresDir);

    for (const file of files) {
      if (file.startsWith('tmp-') && file.endsWith('.md')) {
        const tmpId = file.slice(0, -3);
        const res = validateFeature(tmpId);
        if (!res.isValid) {
          assert.fail(`Feature snippet file "features/${file}" uses unregistered feature ID: ${res.errorMessage}`);
        }
      }
    }
  });

  it('validates that all feature IDs and fields in features/origin-trials.json are valid', async () => {
    const { validateFeature } = await import('../core/baseline.ts');
    const otPath = path.join(REPO_ROOT, 'features', 'origin-trials.json');
    const otRegistry = JSON.parse(fs.readFileSync(otPath, 'utf8'));

    for (const [fid, entry] of Object.entries<any>(otRegistry)) {
      const res = validateFeature(fid);
      if (!res.isValid) {
        assert.fail(`Feature ID "${fid}" in features/origin-trials.json is invalid: ${res.errorMessage}`);
      }
      assert.ok(
        typeof entry.chromestatus_url === 'string' && entry.chromestatus_url.startsWith('https://chromestatus.com/feature/'),
        `Origin trial "${fid}" must have a valid chromestatus_url`
      );
    }
  });

  it('validates that all feature IDs and fields in features/volatile-features.json are valid', async () => {
    const { validateFeature } = await import('../core/baseline.ts');
    const volatilePath = path.join(REPO_ROOT, 'features', 'volatile-features.json');
    const volatileRegistry = JSON.parse(fs.readFileSync(volatilePath, 'utf8'));

    for (const [fid, entry] of Object.entries<any>(volatileRegistry)) {
      const res = validateFeature(fid);
      if (!res.isValid) {
        assert.fail(`Feature ID "${fid}" in features/volatile-features.json is invalid: ${res.errorMessage}`);
      }
      assert.ok(
        typeof entry.reason === 'string' && entry.reason.length > 0,
        `Volatile feature "${fid}" must specify a non-empty reason (e.g., 'recent-single-engine' or 'built-in-ai')`
      );
    }
  });

  it('correctly evaluates volatile feature active status', async () => {
    const { isVolatileActive } = await import('../core/feature-gates.ts');

    assert.strictEqual(isVolatileActive({ reason: 'recent-single-engine' }), true);
    assert.strictEqual(isVolatileActive({ reason: 'built-in-ai' }), true);
    assert.strictEqual(isVolatileActive(undefined), false);
  });

  it('validates that all graders conform to static anti-pattern checks (ratcheted)', async () => {
    const { checkAllGraders, formatViolations } = await import('../core/grader-lint.ts');
    const violations = checkAllGraders({ repoRoot: REPO_ROOT });
    const regressions = new Map<string, GraderLintViolation[]>();

    for (const [file, list] of violations) {
      const limits = LEGACY_GRADER_VIOLATION_LIMITS[file] ?? {};
      const counts = new Map<GraderRuleId, number>();
      for (const v of list) counts.set(v.ruleId, (counts.get(v.ruleId) ?? 0) + 1);
      const excessRules = new Set([...counts].filter(([rule, n]) => n > (limits[rule] ?? 0)).map(([rule]) => rule));
      if (excessRules.size > 0) regressions.set(file, list.filter(v => excessRules.has(v.ruleId)));
    }

    if (regressions.size > 0) {
      assert.fail(`New static grader anti-pattern violations found in ${regressions.size} file(s):\n${formatViolations(regressions)}`);
    }
  });

  it('prevents new target patches from committing build or dependency artifacts', () => {
    const patchFiles = gitExec(['ls-files', '--', 'guides/*/*/targets/*/patches/*.patch'], { cwd: REPO_ROOT })
      .trim()
      .split('\n')
      .filter(Boolean);
    const dirtyPathRe =
      /^(?:\+\+\+ b\/|rename to |Binary files .* and b\/|diff --git a\/\S+ b\/)(?:.*\/)?(?:node_modules\/|dist\/|(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$)/;
    const regressions: string[] = [];

    for (const relPatch of patchFiles) {
      if (LEGACY_DIRTY_PATCHES.has(relPatch)) continue;
      const lines = fs.readFileSync(path.join(REPO_ROOT, relPatch), 'utf8').split('\n');
      const dirtyLine = lines.find(l => dirtyPathRe.test(l));
      if (dirtyLine) regressions.push(`${relPatch}: ${dirtyLine}`);
    }

    assert.deepStrictEqual(regressions, [], `Dirty patch artifacts found:\n${regressions.join('\n')}`);
  });

  it('validates task.md format/guide-leak rules and expectations.md hedge words', () => {
    const guideMentionRe =
      /modern[- ]web[- ]guidance|\bMWG\b|\bguide\.md\b|\bSKILL\.md\b|\b(?:follow(?:ing)?|read|use|consult|per|according to)\s+(?:the\s+)?(?:[\w-]+\s+)?(?:guide|skill)\b/i;
    const hedgeRe = /\bSHOULD\b|\b(?:[Pp]referably|[Ii]deally|[Oo]ptionally)\b/;
    const taskFiles = gitExec(['ls-files', '--', 'guides/*/*/targets/*/task.md'], { cwd: REPO_ROOT })
      .trim()
      .split('\n')
      .filter(Boolean);
    const expFiles = gitExec(['ls-files', '--', 'guides/*/*/expectations.md'], { cwd: REPO_ROOT })
      .trim()
      .split('\n')
      .filter(Boolean);
    const errors: string[] = [];

    for (const relTask of taskFiles) {
      const content = fs.readFileSync(path.join(REPO_ROOT, relTask), 'utf8');
      const nonEmpty = content.split('\n').filter(l => l.trim() !== '');
      const prompt = content.replace(/^\s*-\s+/, '').trim();
      if (nonEmpty.length !== 1 || !/^- \S/.test(nonEmpty[0]) || prompt.endsWith('?')) {
        errors.push(`${relTask}: task.md must be a single imperative "- " line`);
      }
      if (guideMentionRe.test(prompt)) {
        errors.push(`${relTask}: task.md must not mention guide/skill/MWG`);
      }
    }

    for (const relExp of expFiles) {
      if (LEGACY_HEDGED_EXPECTATIONS.has(relExp)) continue;
      const stripped = fs.readFileSync(path.join(REPO_ROOT, relExp), 'utf8').replace(/`[^`]*`/g, ' ');
      const hedged = stripped.split('\n').find(l => /^([-*]|\d+[.)])\s+/.test(l) && hedgeRe.test(l));
      if (hedged) errors.push(`${relExp}: unambiguous hedge word in "${hedged.trim()}"`);
    }

    assert.deepStrictEqual(errors, [], errors.join('\n'));
  });
});
