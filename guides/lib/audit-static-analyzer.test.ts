import test from 'node:test';
import assert from 'node:assert';
import {
  matchesWildcardPattern,
  discoverAuditCapsules,
  extractUnpromptedLocators,
  extractStaticFileRegexSignals,
  extractProseExpectations,
} from './audit-static-analyzer.ts';
import {
  normalizeGrade,
  generateSummaryMarkdown,
  generateSummaryHtml,
  generateCapsuleHtml,
  buildDeterministicBaselineAssessment,
} from './audit-report-generator.ts';
import type { DiscoveredCapsule, StaticAuditSignals } from './audit-types.ts';

test('matchesWildcardPattern correctly filters guideIds and guideNames', () => {
  assert.strictEqual(
    matchesWildcardPattern('css/animate-to-intrinsic-sizes', 'animate-to-intrinsic-sizes', 'css/*'),
    true
  );
  assert.strictEqual(
    matchesWildcardPattern('css/animate-to-intrinsic-sizes', 'animate-to-intrinsic-sizes', '*intrinsic*'),
    true
  );
  assert.strictEqual(
    matchesWildcardPattern('css/animate-to-intrinsic-sizes', 'animate-to-intrinsic-sizes', 'forms/*'),
    false
  );
  assert.strictEqual(
    matchesWildcardPattern('forms/autofill-address-form', 'autofill-address-form', 'forms/autofill-*'),
    true
  );
});

test('discoverAuditCapsules auto-detects legacy vs new guide formats', () => {
  const cssCapsules = discoverAuditCapsules({ pattern: 'css/animate-to-intrinsic-sizes' });
  assert.strictEqual(cssCapsules.length, 1);
  assert.strictEqual(cssCapsules[0].guideFormat, 'legacy - top level guide');

  const translatorCapsules = discoverAuditCapsules({ pattern: 'built-in-ai/translator' });
  assert.ok(translatorCapsules.length > 0);
  for (const c of translatorCapsules) {
    assert.match(c.guideFormat, /^new - low level guide \(/);
  }
});

test('extractUnpromptedLocators identifies selectors in grader.ts absent from task.md', () => {
  const graderCode = `
    test('sample', async ({ page }) => {
      const trigger = page.locator('#faq-trigger');
      const allowed = page.locator('.prompted-card');
    });
  `;
  const taskContent = `Please create an interactive card with class .prompted-card`;
  const unprompted = extractUnpromptedLocators(graderCode, taskContent);

  assert.ok(unprompted.map((u) => u.selector).includes('#faq-trigger'));
  assert.ok(!unprompted.map((u) => u.selector).includes('.prompted-card'));
});

test('extractStaticFileRegexSignals detects fs.readFileSync and static HTML regex checks', () => {
  const graderCode = `
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/aria-expanded/i.test(html)).toBe(true);
  `;
  const res = extractStaticFileRegexSignals(graderCode);
  assert.strictEqual(res.fsReadFileSyncLines.length, 1);
  assert.strictEqual(res.staticRegexChecks.length, 1);
});

test('extractProseExpectations detects non-testable comment expectations', () => {
  const expMd = `
- The root element has interpolate-size applied.
- The guide or code comments explicitly state that interpolate-size is mandatory.
- The implementation notes that calc-size acts as an opt-in.
  `;
  const signals = extractProseExpectations(expMd);
  assert.strictEqual(signals.length, 2);
  assert.strictEqual(signals[0].bulletIndex, 2);
  assert.strictEqual(signals[1].bulletIndex, 3);
});

test('normalizeGrade strictly enforces HIGH, MEDIUM, LOW (no CRITICAL)', () => {
  assert.strictEqual(normalizeGrade('CRITICAL'), 'HIGH');
  assert.strictEqual(normalizeGrade('high'), 'HIGH');
  assert.strictEqual(normalizeGrade('MEDIUM'), 'MEDIUM');
  assert.strictEqual(normalizeGrade('low'), 'LOW');
  assert.strictEqual(normalizeGrade(undefined), 'MEDIUM');
});

test('generateSummaryMarkdown formats SUMMARY_AUDIT_EVALS.md with guide format and HIGH/MEDIUM/LOW grades', () => {
  const dummyCapsule: DiscoveredCapsule = {
    capsuleId: 'css/animate-to-intrinsic-sizes',
    guideId: 'css/animate-to-intrinsic-sizes',
    category: 'css',
    guideName: 'animate-to-intrinsic-sizes',
    guideFormat: 'legacy - top level guide',
    guideDirAbs: '/tmp',
    guideFilePath: '/tmp/guide.md',
    expectationsFilePath: '/tmp/expectations.md',
    graderFilePath: '/tmp/grader.ts',
    taskFilePath: '/tmp/task.md',
  };

  const dummyStatic: StaticAuditSignals = {
    embeddingCoverage: {
      isComplete: true,
      graderPath: '/tmp/grader.ts',
      expectationsPath: '/tmp/expectations.md',
      matches: [],
      missing: [],
    },
    fsReadFileSyncLines: [183],
    staticRegexChecks: [
      { lineNumber: 184, lineSnippet: 'expect(/aria-expanded/i.test(html)).toBe(true);' },
    ],
    unpromptedLocators: [
      {
        selector: '#faq-trigger',
        lineNumber: 106,
        lineSnippet: "const trigger = page.locator('#faq-trigger');",
        inTaskMd: false,
        inDemoHtml: true,
      },
    ],
    proseExpectationSignals: [
      {
        bulletIndex: 2,
        lineNumber: 2,
        text: '- The guide or code comments explicitly state that...',
        matchedKeyword: 'code comments',
      },
    ],
  };

  const assessment = buildDeterministicBaselineAssessment(dummyCapsule, dummyStatic);
  assert.ok(
    assessment.expectationIssues[0].proposedExpectationDraft,
    'Should populate proposedExpectationDraft on expectation issues'
  );

  // Verify expectations-only and grader-only scopes
  const expOnly = buildDeterministicBaselineAssessment(dummyCapsule, dummyStatic, 'expectations');
  assert.strictEqual(expOnly.graderIssues.length, 0);
  assert.strictEqual(expOnly.graderFidelityScore, 100);
  assert.ok(expOnly.expectationIssues.length > 0);

  const graderOnly = buildDeterministicBaselineAssessment(dummyCapsule, dummyStatic, 'grader');
  assert.strictEqual(graderOnly.expectationIssues.length, 0);
  assert.strictEqual(graderOnly.expectationCoverageScore, 100);
  assert.ok(graderOnly.graderIssues.length > 0);

  const itemResult = {
    ...dummyCapsule,
    timestamp: new Date().toISOString(),
    durationMs: 1200,
    turnsTaken: 2,
    consensusReached: true,
    staticSignals: dummyStatic,
    finalAssessment: assessment,
    adversarialHistory: [],
  };
  const md = generateSummaryMarkdown([itemResult], 'test-run-id');

  assert.ok(md.includes('SUMMARY_AUDIT_EVALS.md'));
  assert.ok(md.includes('legacy - top level guide'));
  assert.ok(md.includes('HIGH'));
  assert.ok(!md.includes('CRITICAL'));
  assert.ok(md.includes('#faq-trigger'));
  assert.ok(md.includes('Proposed Draft (`expectations.md`)'));
  assert.ok(md.includes('guides/css/animate-to-intrinsic-sizes/guide.md'));
  assert.ok(md.includes('guides/css/animate-to-intrinsic-sizes/expectations.md'));
  assert.ok(md.includes('guides/css/animate-to-intrinsic-sizes/grader.ts'));

  const html = generateSummaryHtml([itemResult], 'test-run-id');
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('Guide Expectations &amp; Grader Fidelity Audit'));
  assert.ok(html.includes('legacy - top level guide'));
  assert.ok(html.includes('#faq-trigger'));
  assert.ok(html.includes('Proposed Draft for'));
  assert.ok(html.includes('guides/css/animate-to-intrinsic-sizes/guide.md'));
  assert.ok(html.includes('guides/css/animate-to-intrinsic-sizes/expectations.md'));
  assert.ok(html.includes('guides/css/animate-to-intrinsic-sizes/grader.ts'));

  const itemHtml = generateCapsuleHtml(itemResult, 'test-run-id');
  assert.ok(itemHtml.includes('<!DOCTYPE html>'));
  assert.ok(itemHtml.includes('css/animate-to-intrinsic-sizes'));
  assert.ok(itemHtml.includes('guides/css/animate-to-intrinsic-sizes/guide.md'));
});

test('loadContextExpectationsGuidelines dynamically refreshes "Writing expectations.md" from CONTEXT.md', async () => {
  const { loadContextExpectationsGuidelines, buildAuditorInitialPrompt } = await import(
    '../audit-evals-prompts.ts'
  );
  const liveGuidelines = loadContextExpectationsGuidelines();
  assert.ok(liveGuidelines.includes('### Writing expectations.md'));
  assert.ok(liveGuidelines.includes('independently testable'));
  assert.ok(liveGuidelines.includes('positive requirements'));
  assert.ok(liveGuidelines.includes('negative requirements'));

  const prompt = buildAuditorInitialPrompt('audit-assessment.json', 'expectations');
  assert.ok(prompt.includes('### Writing expectations.md'));
  assert.ok(prompt.includes('independently testable'));
});
