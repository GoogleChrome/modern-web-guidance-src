import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGeminiRequestBody,
  checkCanaries,
  deriveJudgeVerdictFromFacts,
  evaluateJudgeMetrics,
  evaluateJudgeStability,
  extractCodeSnippet,
  formatBlindCardPrompt,
  isDetectiveFactCheck,
  isJudgeVerdict,
  loadGuideSummaryFromMarkdown,
  loadPaulIrishScoredCards,
  parseGuideSummaryMarkdown,
  parseJudgeJsonContent,
  prepareBlindCards,
  runJudgeBatch,
  runJudgeDirect,
  type BlindCardPayload,
  type CalibrationDeckItem,
  type CanaryCard,
  type DetectiveFactCheck,
  type GuideSummaryInfo,
  type JudgeResult,
} from './judge.ts';

const SAMPLE_GUIDE_SUMMARY: GuideSummaryInfo = {
  guideId: 'calculate-event-differentials',
  problem: 'Date subtraction suffers from daylight saving and leap second drift.',
  before: 'Manual Date timestamp millisecond subtraction.',
  now: 'Temporal.ZonedDateTime or Temporal.PlainDate duration methods.',
  oldWayExamples: ['date1.getTime() - date2.getTime()', '(d1 - d2) / 1000'],
  markdownBody: '# Calculate Event Differentials\n\nDate subtraction suffers from daylight saving and leap second drift.\n\n## Before\nManual subtraction.\n\n## Now\nTemporal.ZonedDateTime.',
};

const SAMPLE_BLIND_CARD: BlindCardPayload = {
  cardId: 'abc123def456',
  repo: 'lighthouse-2020',
  file: 'scripts/analyze.js',
  line: 42,
  guideId: 'calculate-event-differentials',
  guideSummary: SAMPLE_GUIDE_SUMMARY,
  codeSnippet: '  const delta = (d1.getTime() - d2.getTime()) / 86400000;',
};

describe('judge type guards', () => {
  it('identifies valid judge verdicts', () => {
    assert.equal(isJudgeVerdict('right'), true);
    assert.equal(isJudgeVerdict('not-old-pattern'), true);
    assert.equal(isJudgeVerdict('leave-it'), true);
    assert.equal(isJudgeVerdict('guide-wrong'), true);
    assert.equal(isJudgeVerdict('unsure'), true);
    assert.equal(isJudgeVerdict('wrong'), false);
    assert.equal(isJudgeVerdict(123), false);
    assert.equal(isJudgeVerdict(null), false);
  });

  it('validates DetectiveFactCheck shape', () => {
    const valid: DetectiveFactCheck = {
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: true,
      reasoning: 'Matches old Date millisecond subtraction pattern directly.',
      verdict: 'right',
    };
    assert.equal(isDetectiveFactCheck(valid), true);

    assert.equal(isDetectiveFactCheck({ ...valid, verdict: 'invalid' }), false);
    assert.equal(isDetectiveFactCheck({ ...valid, matches_before_syntax: 'yes' }), false);
    assert.equal(isDetectiveFactCheck(null), false);
  });
});

describe('blind card formatting & request construction', () => {
  it('formats blind card prompt without revealing rule IDs, tools, or prior verdicts', () => {
    const prompt = formatBlindCardPrompt(SAMPLE_BLIND_CARD);

    assert.match(prompt, /## Modern Web Guidance Guide/);
    assert.match(prompt, /calculate-event-differentials/);
    assert.match(prompt, /Date subtraction suffers from daylight saving/);
    assert.match(prompt, /scripts\/analyze\.js/);
    assert.match(prompt, /line: 42/i);
    assert.match(prompt, /const delta = \(d1\.getTime\(\)/);

    // Strict blind guarantee: no rule IDs or tools
    assert.doesNotMatch(prompt, /v1-analyzer/i);
    assert.doesNotMatch(prompt, /DATE_EVENT_DIFFERENTIAL_ARITHMETIC/);
    assert.doesNotMatch(prompt, /uses-old-pattern/);
  });

  it('builds Gemini request body with JSON schema and temperature 0.2', () => {
    const body = buildGeminiRequestBody(SAMPLE_BLIND_CARD) as {
      generationConfig: { responseMimeType: string; temperature: number };
      contents: Array<{ parts: Array<{ text: string }> }>;
    };

    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.temperature, 0.2);
    assert.equal(body.contents.length, 1);
    assert.match(body.contents[0].parts[0].text, /scripts\/analyze\.js/);
  });

  it('throws an explicit error when markdownBody is missing (R29 fail fast)', () => {
    const cardWithoutMarkdown = {
      cardId: 'card-novel-001',
      repo: 'test-repo',
      file: 'src/example.ts',
      line: 15,
      guideId: 'novel-future-guide',
      guideSummary: {
        guideId: 'novel-future-guide',
        problem: 'Novel problem description',
        before: 'Old workaround syntax',
        now: 'New platform feature',
        ruleSummary: 'Flag legacy workaround X in user forms',
      },
      codeSnippet: 'const oldWay = true;',
    };

    assert.throws(
      () => formatBlindCardPrompt(cardWithoutMarkdown),
      /missing required guideSummary\.markdownBody/,
    );
  });

  it('only presents markdownBody when present and avoids injecting brownfield rubric (R11, R19)', () => {
    const cardWithMarkdown = {
      cardId: 'card-pure-guide-001',
      repo: 'test-repo',
      file: 'src/login.html',
      line: 10,
      guideId: 'autofill-sign-in-form',
      guideSummary: {
        guideId: 'autofill-sign-in-form',
        problem: 'Sign-in form lacks autocomplete',
        before: '<input type="password">',
        now: '<input autocomplete="current-password">',
        markdownBody: '# Autofill Sign-in Form\n\nEnsure autocomplete="username" and "current-password".',
      },
      codeSnippet: '<input type="text" name="user">',
    };

    const prompt = formatBlindCardPrompt(cardWithMarkdown);
    assert.match(prompt, /## Modern Web Guidance Guide \(autofill-sign-in-form\)/);
    assert.match(prompt, /Ensure autocomplete="username" and "current-password"/);
    assert.doesNotMatch(prompt, /## Brownfield Workarounds Target/);
  });
});

describe('parseJudgeJsonContent', () => {
  it('parses valid Detective-then-Judge JSON', () => {
    const raw = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: true,
      reasoning: 'Legacy millisecond subtraction with no guard.',
      verdict: 'right',
    });

    const result = parseJudgeJsonContent(raw, 'card-001');
    assert.equal(result.cardId, 'card-001');
    assert.equal(result.verdict, 'right');
    assert.equal(result.facts.matches_before_syntax, true);
    assert.equal(result.facts.has_fallback_or_feature_guard, false);
    assert.equal(result.facts.modern_feature_applies_here, true);
  });

  it('cross-checks and computes unambiguous verdicts from 3 boolean facts (R29 and Spec §2.2)', () => {
    // 1. !matches_before_syntax -> 'not-old-pattern' regardless of model verdict
    const rawNotOld = JSON.stringify({
      matches_before_syntax: false,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: false,
      reasoning: 'Not the old pattern.',
      verdict: 'unsure',
    });
    const res1 = parseJudgeJsonContent(rawNotOld, 'c1');
    assert.equal(res1.verdict, 'not-old-pattern');
    assert.equal(res1.facts.rawVerdict, 'unsure');

    // 2. matches_before_syntax && has_fallback_or_feature_guard -> 'leave-it'
    const rawLeaveIt = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: true,
      modern_feature_applies_here: true,
      reasoning: 'Protected by feature guard.',
      verdict: 'right',
    });
    const res2 = parseJudgeJsonContent(rawLeaveIt, 'c2');
    assert.equal(res2.verdict, 'leave-it');
    assert.equal(res2.facts.rawVerdict, 'right');

    // 3. matches_before_syntax && !has_fallback_or_feature_guard && modern_feature_applies_here -> 'right'
    const rawRight = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: true,
      reasoning: 'Clean legacy match.',
      verdict: 'right',
    });
    const res3 = parseJudgeJsonContent(rawRight, 'c3');
    assert.equal(res3.verdict, 'right');
    assert.equal(res3.facts.rawVerdict, 'right');

    // 4. matches_before_syntax && !has_fallback_or_feature_guard && !modern_feature_applies_here -> 'leave-it' (Spec §2.2)
    const rawNoModern = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: false,
      reasoning: 'Modern replacement would not work for this case.',
      verdict: 'leave-it',
    });
    const res4 = parseJudgeJsonContent(rawNoModern, 'c4');
    assert.equal(res4.verdict, 'leave-it');
    assert.equal(res4.facts.rawVerdict, 'leave-it');

    // 5. rawVerdict === 'unsure' is preserved and NOT overwritten to 'right' (O55f)
    const rawUnsure = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: true,
      reasoning: 'Unsure about surrounding context.',
      verdict: 'unsure',
    });
    const res5 = parseJudgeJsonContent(rawUnsure, 'c5');
    assert.equal(res5.verdict, 'unsure');
    assert.equal(res5.facts.rawVerdict, 'unsure');
  });

  it('deriveJudgeVerdictFromFacts covers all truth table branches strictly (O55f)', () => {
    // rawVerdict === 'guide-wrong' always returns 'guide-wrong'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true },
        'guide-wrong',
      ),
      'guide-wrong',
    );

    // !matches_before_syntax -> 'not-old-pattern'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: false, has_fallback_or_feature_guard: false, modern_feature_applies_here: true },
        'right',
      ),
      'not-old-pattern',
    );

    // has_fallback_or_feature_guard -> 'leave-it'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: true, modern_feature_applies_here: true },
        'right',
      ),
      'leave-it',
    );

    // !modern_feature_applies_here -> 'leave-it' (Spec §2.2)
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: false },
        'leave-it',
      ),
      'leave-it',
    );

    // rawVerdict === 'unsure' -> 'unsure'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true },
        'unsure',
      ),
      'unsure',
    );

    // clean right match
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true },
        'right',
      ),
      'right',
    );
  });

  it('throws an error on malformed or non-JSON output per Fail Fast (R22)', () => {
    assert.throws(
      () => parseJudgeJsonContent('Not valid JSON at all', 'card-002'),
      /not valid JSON/i,
    );
  });

  it('throws an error on JSON output missing required schema fields per Fail Fast (R22)', () => {
    assert.throws(
      () => parseJudgeJsonContent(JSON.stringify({ verdict: 'right' }), 'card-003'),
      /does not match schema/i,
    );
  });
});

describe('canary checking', () => {
  const canaries: CanaryCard[] = [
    { cardId: 'canary-pos-1', expectedVerdict: 'right' },
    { cardId: 'canary-pos-2', expectedVerdict: 'right' },
    { cardId: 'canary-neg-1', expectedVerdict: 'not-old-pattern' },
    { cardId: 'canary-neg-2', expectedVerdict: 'leave-it' },
  ];

  it('passes when all negative controls are rejected and positives pass', () => {
    const results: JudgeResult[] = [
      {
        cardId: 'canary-pos-1',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: 'ok',
          verdict: 'right',
        },
      },
      {
        cardId: 'canary-pos-2',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: 'ok',
          verdict: 'right',
        },
      },
      {
        cardId: 'canary-neg-1',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          reasoning: 'ok',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'canary-neg-2',
        verdict: 'leave-it',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          reasoning: 'ok',
          verdict: 'leave-it',
        },
      },
    ];

    const check = checkCanaries(results, canaries);
    assert.equal(check.passed, true);
    assert.equal(check.tnr, 1.0);
    assert.equal(check.tpr, 1.0);
    assert.equal(check.violations.length, 0);
  });

  it('fails when a false-positive canary is erroneously labeled right (leniency leak)', () => {
    const lenientResults: JudgeResult[] = [
      {
        cardId: 'canary-pos-1',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: 'ok',
          verdict: 'right',
        },
      },
      {
        cardId: 'canary-pos-2',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: 'ok',
          verdict: 'right',
        },
      },
      // Leaked false positive: marked right instead of not-old-pattern!
      {
        cardId: 'canary-neg-1',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: 'ok',
          verdict: 'right',
        },
      },
      {
        cardId: 'canary-neg-2',
        verdict: 'leave-it',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          reasoning: 'ok',
          verdict: 'leave-it',
        },
      },
    ];

    const check = checkCanaries(lenientResults, canaries);
    assert.equal(check.passed, false);
    assert.equal(check.tnr, 0.5); // 1 out of 2 negatives failed
    assert.equal(check.violations.length, 1);
    assert.equal(check.violations[0].cardId, 'canary-neg-1');
  });
});

describe('evaluateJudgeStability', () => {
  it('scores perfect stability on identical 3-run verdicts', () => {
    const makeRun = (): JudgeResult[] => [
      {
        cardId: 'c1',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: 'r',
          verdict: 'right',
        },
      },
      {
        cardId: 'c2',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          reasoning: 'r',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'c3',
        verdict: 'leave-it',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          reasoning: 'r',
          verdict: 'leave-it',
        },
      },
    ];

    const stability = evaluateJudgeStability([makeRun(), makeRun(), makeRun()]);
    assert.equal(stability.stabilityRate, 1.0);
    assert.equal(stability.krippendorffAlpha, 1.0);
    assert.equal(stability.gwetAc1, 1.0);
    assert.equal(stability.consensusResults[0].verdict, 'right');
    assert.equal(stability.consensusResults[1].verdict, 'not-old-pattern');
    assert.equal(stability.consensusResults[2].verdict, 'leave-it');
  });

  it('determines consensus majority vote when one run differs', () => {
    const run0: JudgeResult[] = [
      {
        cardId: 'c1',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: 'r',
          verdict: 'right',
        },
      },
    ];
    const run1: JudgeResult[] = [
      {
        cardId: 'c1',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: 'r',
          verdict: 'right',
        },
      },
    ];
    const run2: JudgeResult[] = [
      {
        cardId: 'c1',
        verdict: 'leave-it',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          reasoning: 'r',
          verdict: 'leave-it',
        },
      },
    ];

    const stability = evaluateJudgeStability([run0, run1, run2]);
    assert.equal(stability.stabilityRate, 0.0); // 0 out of 1 had all 3 identical
    assert.equal(stability.consensusResults[0].verdict, 'right'); // majority 2/3 voted right
  });
});

describe('evaluateJudgeMetrics', () => {
  it('computes agreement and PPI++ precision correctly', () => {
    const judgeResults: JudgeResult[] = [
      {
        cardId: 'c1',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: '',
          verdict: 'right',
        },
      },
      {
        cardId: 'c2',
        verdict: 'right',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          reasoning: '',
          verdict: 'right',
        },
      },
      {
        cardId: 'c3',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          reasoning: '',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'c4',
        verdict: 'leave-it',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          reasoning: '',
          verdict: 'leave-it',
        },
      },
    ];

    const humanGrades = new Map<string, string>([
      ['c1', 'right'],
      ['c2', 'right'],
      ['c3', 'not-old-pattern'],
      ['c4', 'leave-it'],
    ]);

    const droppedCardIds = new Set(['c3', 'c4']);

    const metrics = evaluateJudgeMetrics(judgeResults, humanGrades, droppedCardIds);
    assert.equal(metrics.krippendorffAlpha, 1.0);
    assert.equal(metrics.gwetAc1, 1.0);
    assert.equal(metrics.sensitivitySpecificity.tpr, 1.0);
    assert.equal(metrics.sensitivitySpecificity.tnr, 1.0);
    assert.equal(metrics.retainedDroppedRate, 1.0);
    assert.equal(metrics.ppiPrecision.estimate, 0.5);
  });
});

describe('code snippet slicing & blind cards prep', () => {
  it('extracts snippet around target line with cursor marker', () => {
    const file = ['line 1', 'line 2', 'line 3', 'target line 4', 'line 5', 'line 6'].join('\n');
    const snippet = extractCodeSnippet(file, 4, 1);

    assert.match(snippet, />    4 \| target line 4/);
    assert.match(snippet, /   3 \| line 3/);
    assert.match(snippet, /   5 \| line 5/);
    assert.doesNotMatch(snippet, /line 1/);
  });

  it('prepares blind cards from deck items with loaded summaries', async () => {
    const items: CalibrationDeckItem[] = [
      {
        cardId: 'test-1',
        repo: 'test-repo',
        commit: '1234567',
        guideId: 'calculate-event-differentials',
        sourceId: 'DATE_EVENT_DIFFERENTIAL_ARITHMETIC',
        file: 'test.js',
        line: 10,
        code: '  const d = a - b;',
      },
    ];

    const summaries = new Map<string, GuideSummaryInfo>([
      ['calculate-event-differentials', SAMPLE_GUIDE_SUMMARY],
    ]);

    // Dummy empty repos file since code snippet is already embedded
    const mockReposPath = '/tmp/dummy-repos.json';
    const { writeFile } = await import('node:fs/promises');
    await writeFile(mockReposPath, JSON.stringify([]));

    const blindCards = await prepareBlindCards(items, summaries, mockReposPath);
    assert.equal(blindCards.length, 1);
    assert.equal(blindCards[0].cardId, 'test-1');
    assert.equal(blindCards[0].codeSnippet, '  const d = a - b;');
    assert.equal(blindCards[0].guideSummary.guideId, 'calculate-event-differentials');
  });
});

describe('mocked direct and batch judge runners', () => {
  it('executes runJudgeDirect with mock fetch', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      matches_before_syntax: true,
                      has_fallback_or_feature_guard: false,
                      modern_feature_applies_here: true,
                      reasoning: 'Matches old Date subtraction.',
                      verdict: 'right',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const results = await runJudgeDirect([SAMPLE_BLIND_CARD], {
      apiKey: 'test-key',
      fetchFn: mockFetch,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].cardId, SAMPLE_BLIND_CARD.cardId);
    assert.equal(results[0].verdict, 'right');
    assert.equal(results[0].facts.matches_before_syntax, true);
  });

  it('throws an explicit error when batch API returns an error response instead of falling back', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response('Batch service unavailable', { status: 500 });
    };

    await assert.rejects(
      () =>
        runJudgeBatch([SAMPLE_BLIND_CARD], {
          apiKey: 'test-key',
          fetchFn: mockFetch,
        }),
      /Gemini Batch API creation failed with HTTP 500/,
    );
  });

  it('routes to direct execution when mode is direct', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      matches_before_syntax: true,
                      has_fallback_or_feature_guard: false,
                      modern_feature_applies_here: true,
                      reasoning: 'Matches directly.',
                      verdict: 'right',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const results = await runJudgeBatch([SAMPLE_BLIND_CARD], {
      apiKey: 'test-key',
      mode: 'direct',
      fetchFn: mockFetch,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].verdict, 'right');
  });
});

describe('guide summary extraction from markdown', () => {
  it('extracts problem, before, and now deterministically from markdown', () => {
    const sampleMd = `---
name: sample-feature
description: Sample feature description from frontmatter
web-feature-ids:
  - sample-feature
---

# Sample Feature

In the past, developers had to rely on complex JavaScript hacks to do this.
The modern Sample API now allows doing this natively in CSS.

## Implementation

Use the sample-feature property on the root element.
`;

    const summary = parseGuideSummaryMarkdown(sampleMd, 'sample-feature');
    assert.equal(summary.guideId, 'sample-feature');
    assert.equal(summary.problem, 'Sample feature description from frontmatter');
    assert.match(summary.before, /In the past/);
    assert.match(summary.now, /The modern Sample API/);
    assert.equal(summary.oldWayExamples, undefined);
  });

  it('loads real guide summary from guide.md', async () => {
    const summary = await loadGuideSummaryFromMarkdown('calculate-event-differentials');
    assert.equal(summary.guideId, 'calculate-event-differentials');
    assert.ok(summary.problem.length > 0);
    assert.ok(summary.before.length > 0);
    assert.ok(summary.now.length > 0);
    assert.equal(summary.oldWayExamples, undefined);
  });
});

describe('loadPaulIrishScoredCards', () => {
  it('loads the human-scored cards from canonical files excluding unsure and stubs', async () => {
    const { cards, humanVerdicts } = await loadPaulIrishScoredCards();
    assert.equal(cards.length, 119);
    assert.equal(humanVerdicts.size, 119);
    assert.equal(humanVerdicts.get('2547b2ba6d74'), 'not-old-pattern');
    assert.equal(humanVerdicts.get('7f2a96f62a4c'), 'not-old-pattern');
    assert.equal(humanVerdicts.get('c8147e8fdf52'), undefined); // 'unsure' excluded
  });
});
