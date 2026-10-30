import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  buildGeminiRequestBody,
  checkCanaries,
  computeExplainerContextHash,
  computeJudgeInputProvenance,
  computePromptGuideHash,
  deriveJudgeVerdictFromFacts,
  evaluateJudgeMetrics,
  evaluateJudgeStability,
  extractCodeSnippet,
  formatBlindCardPrompt,
  isJudgeVerdict,
  isPositiveVerdict,
  normalizeJudgeVerdict,
  verdictsAgree,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_VERSION,
  loadGuideSummariesMap,
  loadPaulIrishScoredCards,
  parseGuideSummaryMarkdown,
  parseJudgeJsonContent,
  prepareBlindCards,
  runJudgeDirect,
  type BlindCardPayload,
  type CalibrationDeckItem,
  type CanaryCard,
  type GuideSummaryInfo,
  type JudgeResult,
  type JudgeVerdict,
} from './detection-eval.ts';

export function mockGeminiResponse(payload: unknown, status = 200): Response {
  return new Response(
    typeof payload === 'string' ? payload : JSON.stringify(payload),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

const SAMPLE_GUIDE_SUMMARY: GuideSummaryInfo = {
  guideId: 'calculate-event-differentials',
  problem: 'Date subtraction suffers from daylight saving and leap second drift.',
  markdownBody:
    '# Calculate Event Differentials\n\nDate subtraction suffers from daylight saving and leap second drift.\n\n## Before\nManual subtraction.\n\n## Now\nTemporal.ZonedDateTime.',
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

function makeJudgeResult(
  cardId: string,
  verdict: JudgeVerdict,
  overrides: Partial<JudgeResult> = {},
): JudgeResult {
  const isPos = isPositiveVerdict(verdict);
  return {
    cardId,
    verdict,
    facts: {
      matches_before_syntax: verdict !== 'not-old-pattern',
      has_fallback_or_feature_guard: verdict === 'fallback-or-guard',
      modern_feature_applies_here: isPos || verdict === 'no-payoff',
      has_meaningful_payoff: isPos,
      reasoning: 'ok',
      verdict,
      rawVerdict: verdict,
    },
    ...overrides,
  };
}

describe('judge type guards', () => {
  it('identifies valid judge verdicts, positive verdicts, normalization, and agreement', () => {
    const valid = [
      'legit-modernize-target',
      'not-old-pattern',
      'fallback-or-guard',
      'loses-behavior',
      'no-payoff',
      'guide-wrong',
      'unsure',
      'right',
      'leave-it',
    ];
    assert.deepStrictEqual(valid.map(isJudgeVerdict), Array(valid.length).fill(true));
    assert.deepStrictEqual(['wrong', 123, null].map(isJudgeVerdict), [false, false, false]);

    assert.deepStrictEqual(
      ['legit-modernize-target', 'right', 'legit'].map(isPositiveVerdict),
      [true, true, true],
    );
    assert.deepStrictEqual(
      ['not-old-pattern', 'fallback-or-guard', 'loses-behavior', 'no-payoff', 'guide-wrong', 'unsure'].map(
        isPositiveVerdict,
      ),
      [false, false, false, false, false, false],
    );

    assert.equal(normalizeJudgeVerdict('right'), 'legit-modernize-target');
    assert.equal(normalizeJudgeVerdict('legit'), 'legit-modernize-target');
    assert.equal(normalizeJudgeVerdict('false_positive'), 'not-old-pattern');
    assert.equal(normalizeJudgeVerdict('leave-it'), 'leave-it');
    assert.equal(normalizeJudgeVerdict('legit-modernize-target'), 'legit-modernize-target');

    assert.equal(verdictsAgree('legit-modernize-target', 'right'), true);
    assert.equal(verdictsAgree('leave-it', 'fallback-or-guard'), true);
    assert.equal(verdictsAgree('leave-it', 'loses-behavior'), true);
    assert.equal(verdictsAgree('leave-it', 'no-payoff'), true);
    assert.equal(verdictsAgree('fallback-or-guard', 'leave-it'), true);
    assert.equal(verdictsAgree('not-old-pattern', 'leave-it'), false);
  });
});

describe('blind card formatting & request construction', () => {
  it('formats blind card prompt and builds Gemini request body without internal metadata', () => {
    const prompt = formatBlindCardPrompt(SAMPLE_BLIND_CARD);
    assert.match(prompt, /## Modern Web Guidance Guide/);
    assert.match(prompt, /calculate-event-differentials/);
    assert.match(prompt, /Date subtraction suffers from daylight saving/);
    assert.match(prompt, /scripts\/analyze\.js/);
    assert.match(prompt, /line: 42/i);
    assert.match(prompt, /const delta = \(d1\.getTime\(\)/);
    assert.doesNotMatch(prompt, /v1-analyzer|DATE_EVENT_DIFFERENTIAL_ARITHMETIC|uses-old-pattern/i);

    const body = buildGeminiRequestBody(SAMPLE_BLIND_CARD) as {
      generationConfig: { responseMimeType: string; temperature: number };
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.temperature, 0.2);
    assert.equal(body.contents.length, 1);
    assert.match(body.contents[0].parts[0].text, /scripts\/analyze\.js/);
  });

  it('excludes all guide-triage.json fields and dossier text from formatted judge prompt', async () => {
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('no-op syntax swap'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('non-1:1 library component migration'));

    const tmpRoot = await mkdtemp(join(tmpdir(), 'judge-no-triage-'));
    const origEvalDir = process.env.ANALYZER_EVAL_DATA_DIR;
    try {
      const guidesDir = join(tmpRoot, 'guides', 'css', 'individual-transform-properties');
      const evalDir = join(tmpRoot, 'eval-data');
      await mkdir(guidesDir, { recursive: true });
      await mkdir(join(evalDir, 'findings'), { recursive: true });

      await writeFile(
        join(guidesDir, 'guide.md'),
        '# Individual Transform Properties\n\nUse CSS `translate`, `rotate`, and `scale` properties to animate transforms independently.\n',
        'utf8',
      );
      await writeFile(
        join(evalDir, 'findings', '2026-10-19-guide-explainers-171.json'),
        JSON.stringify([
          {
            guideId: 'individual-transform-properties',
            combinedExcerpt:
              'CSSWGTransforms-2 explainer: individual transform properties avoid repeating other transform functions in keyframes.',
          },
        ]),
        'utf8',
      );
      await writeFile(
        join(evalDir, 'guide-triage.json'),
        JSON.stringify([
          {
            guideId: 'individual-transform-properties',
            classification: 'detectable',
            replaces: ['SENTINEL_REPLACES_PATTERN'],
            doesNotReplace: ['SENTINEL_DOES_NOT_REPLACE_BOUNDARY'],
            brownfieldTarget: 'SENTINEL_BROWNFIELD_TARGET',
            reason: 'SENTINEL_TRIAGE_REASON',
          },
        ]),
        'utf8',
      );

      process.env.ANALYZER_EVAL_DATA_DIR = evalDir;
      const summaries = await loadGuideSummariesMap(join(tmpRoot, 'guides'));
      const summary = summaries.get('individual-transform-properties');
      assert.ok(summary);

      const card: BlindCardPayload = {
        cardId: 'card-triage-isolation-1',
        repo: 'sample-repo',
        file: 'src/styles.css',
        line: 12,
        guideId: 'individual-transform-properties',
        guideSummary: summary,
        codeSnippet: '  transform: translateX(10px) rotate(45deg);',
      };

      const prompt = formatBlindCardPrompt(card);
      const requestBodyJson = JSON.stringify(buildGeminiRequestBody(card));

      assert.match(prompt, /## Modern Web Guidance Guide \(individual-transform-properties\)/);
      assert.match(prompt, /animate transforms independently/);
      assert.match(prompt, /## Upstream Feature Explainer & Motivation Context/);
      assert.match(prompt, /CSSWGTransforms-2 explainer/);

      const forbiddenSubstrings = [
        'Technical Reference Dossier',
        'doesNotReplace',
        'brownfieldTarget',
        'SENTINEL_REPLACES_PATTERN',
        'SENTINEL_DOES_NOT_REPLACE_BOUNDARY',
        'SENTINEL_BROWNFIELD_TARGET',
        'SENTINEL_TRIAGE_REASON',
      ];
      assert.deepStrictEqual(
        forbiddenSubstrings.filter((s) => prompt.includes(s) || requestBodyJson.includes(s)),
        [],
      );
    } finally {
      if (origEvalDir === undefined) {
        delete process.env.ANALYZER_EVAL_DATA_DIR;
      } else {
        process.env.ANALYZER_EVAL_DATA_DIR = origEvalDir;
      }
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('parseJudgeJsonContent & deriveJudgeVerdictFromFacts', () => {
  it('parses valid Detective-then-Judge JSON and cross-checks all 7 verdict branches', () => {
    const cases: Array<{
      id: string;
      facts: [boolean, boolean, boolean, boolean];
      rawVerdict: JudgeVerdict;
      expected: JudgeVerdict;
    }> = [
      { id: 'c1', facts: [false, false, false, false], rawVerdict: 'not-old-pattern', expected: 'not-old-pattern' },
      { id: 'c2', facts: [true, true, true, true], rawVerdict: 'legit-modernize-target', expected: 'fallback-or-guard' },
      { id: 'c3', facts: [true, false, true, true], rawVerdict: 'legit-modernize-target', expected: 'legit-modernize-target' },
      { id: 'c4', facts: [true, false, false, false], rawVerdict: 'loses-behavior', expected: 'loses-behavior' },
      { id: 'c5', facts: [true, false, true, false], rawVerdict: 'no-payoff', expected: 'no-payoff' },
      { id: 'c6', facts: [true, false, true, true], rawVerdict: 'unsure', expected: 'unsure' },
      { id: 'c7', facts: [true, false, true, true], rawVerdict: 'guide-wrong', expected: 'guide-wrong' },
      { id: 'c8', facts: [true, false, true, true], rawVerdict: 'no-payoff', expected: 'legit-modernize-target' },
      { id: 'c9', facts: [true, false, true, true], rawVerdict: 'loses-behavior', expected: 'legit-modernize-target' },
      { id: 'c10', facts: [true, false, true, true], rawVerdict: 'fallback-or-guard', expected: 'legit-modernize-target' },
    ];

    const actual = cases.map((c) => {
      const [
        matches_before_syntax,
        has_fallback_or_feature_guard,
        modern_feature_applies_here,
        has_meaningful_payoff,
      ] = c.facts;
      const raw = JSON.stringify({
        matches_before_syntax,
        has_fallback_or_feature_guard,
        modern_feature_applies_here,
        has_meaningful_payoff,
        reasoning: 'Reason.',
        verdict: c.rawVerdict,
      });
      const res = parseJudgeJsonContent(raw, c.id);
      const derived = deriveJudgeVerdictFromFacts(
        {
          matches_before_syntax,
          has_fallback_or_feature_guard,
          modern_feature_applies_here,
          has_meaningful_payoff,
        },
        c.rawVerdict,
      );
      return {
        cardId: res.cardId,
        verdict: res.verdict,
        rawVerdict: res.facts.rawVerdict,
        derived,
      };
    });

    assert.deepStrictEqual(
      actual,
      cases.map((c) => ({
        cardId: c.id,
        verdict: c.expected,
        rawVerdict: c.rawVerdict,
        derived: c.expected,
      })),
    );

    assert.throws(() => parseJudgeJsonContent('Not valid JSON', 'card-002'), /not valid JSON/i);
    assert.throws(
      () => parseJudgeJsonContent(JSON.stringify({ verdict: 'right' }), 'card-003'),
      /does not match schema/i,
    );
  });
});

describe('canary checking, stability, and metrics', () => {
  it('checks canaries and flags leniency leaks on negative controls', () => {
    const canaries: CanaryCard[] = [
      { cardId: 'canary-pos-1', expectedVerdict: 'legit-modernize-target' },
      { cardId: 'canary-pos-2', expectedVerdict: 'legit-modernize-target' },
      { cardId: 'canary-neg-1', expectedVerdict: 'not-old-pattern' },
      { cardId: 'canary-neg-2', expectedVerdict: 'fallback-or-guard' },
    ];

    const clean = checkCanaries(
      [
        makeJudgeResult('canary-pos-1', 'legit-modernize-target'),
        makeJudgeResult('canary-pos-2', 'legit-modernize-target'),
        makeJudgeResult('canary-neg-1', 'not-old-pattern'),
        makeJudgeResult('canary-neg-2', 'fallback-or-guard'),
      ],
      canaries,
    );
    assert.equal(clean.passed, true);
    assert.equal(clean.tnr, 1.0);
    assert.equal(clean.tpr, 1.0);
    assert.equal(clean.violations.length, 0);

    const lenient = checkCanaries(
      [
        makeJudgeResult('canary-pos-1', 'legit-modernize-target'),
        makeJudgeResult('canary-pos-2', 'legit-modernize-target'),
        makeJudgeResult('canary-neg-1', 'legit-modernize-target'),
        makeJudgeResult('canary-neg-2', 'fallback-or-guard'),
      ],
      canaries,
    );
    assert.equal(lenient.passed, false);
    assert.equal(lenient.tnr, 0.5);
    assert.equal(lenient.violations.length, 1);
    assert.equal(lenient.violations[0].cardId, 'canary-neg-1');
  });

  it('evaluates 3-run stability, majority consensus, 3-way splits, and provenance guards', () => {
    const makeRun = (): JudgeResult[] => [
      makeJudgeResult('c1', 'legit-modernize-target'),
      makeJudgeResult('c2', 'not-old-pattern'),
      makeJudgeResult('c3', 'fallback-or-guard'),
    ];
    const perfect = evaluateJudgeStability([makeRun(), makeRun(), makeRun()]);
    assert.equal(perfect.stabilityRate, 1.0);
    assert.equal(perfect.krippendorffAlpha, 1.0);
    assert.equal(perfect.gwetAc1, 1.0);
    assert.deepEqual(
      perfect.consensusResults.map((r) => r.verdict),
      ['legit-modernize-target', 'not-old-pattern', 'fallback-or-guard'],
    );

    const majority = evaluateJudgeStability([
      [makeJudgeResult('c1', 'legit-modernize-target')],
      [makeJudgeResult('c1', 'legit-modernize-target')],
      [makeJudgeResult('c1', 'no-payoff')],
    ]);
    assert.equal(majority.stabilityRate, 0.0);
    assert.equal(majority.consensusResults[0].verdict, 'legit-modernize-target');

    const baseProv = computeJudgeInputProvenance(SAMPLE_BLIND_CARD);
    const makePass = (verdict: JudgeVerdict, overrides: Partial<JudgeResult> = {}): JudgeResult[] => [
      makeJudgeResult(SAMPLE_BLIND_CARD.cardId, verdict, {
        ...baseProv,
        provenance: baseProv,
        rawResponse: `{"verdict":"${verdict}"}`,
        error: 'transient-pass-warning',
        ...overrides,
      }),
    ];

    const split = evaluateJudgeStability([
      makePass('legit-modernize-target'),
      makePass('not-old-pattern'),
      makePass('no-payoff'),
    ]);
    const consensus = split.consensusResults[0];
    assert.equal(consensus.verdict, 'unsure');
    assert.equal(consensus.facts.verdict, 'unsure');
    assert.equal(consensus.facts.rawVerdict, 'unsure');
    assert.equal(consensus.promptGuideHash, baseProv.promptGuideHash);
    assert.equal(consensus.ruleHash, baseProv.ruleHash);
    assert.equal('rawResponse' in consensus, false);
    assert.equal('error' in consensus, false);

    assert.throws(
      () =>
        evaluateJudgeStability([
          makePass('legit-modernize-target'),
          makePass('legit-modernize-target', { explainerContextHash: 'deadbeef1234' }),
          makePass('legit-modernize-target'),
        ]),
      /Stability run provenance mismatch.*explainerContextHash/,
    );
    assert.throws(
      () =>
        evaluateJudgeStability([
          makePass('legit-modernize-target'),
          makePass('legit-modernize-target'),
          makePass('legit-modernize-target', { promptGuideHash: 'cafebabe5678' }),
        ]),
      /Stability run provenance mismatch.*promptGuideHash/,
    );
    assert.throws(
      () =>
        evaluateJudgeStability([
          makePass('legit-modernize-target'),
          makePass('legit-modernize-target', { cardId: 'other-card' }),
          makePass('legit-modernize-target'),
        ]),
      /Stability run cardId mismatch/,
    );
  });

  it('computes agreement and sensitivity/specificity in evaluateJudgeMetrics', () => {
    const metrics = evaluateJudgeMetrics(
      [
        makeJudgeResult('c1', 'legit-modernize-target'),
        makeJudgeResult('c2', 'legit-modernize-target'),
        makeJudgeResult('c3', 'not-old-pattern'),
        makeJudgeResult('c4', 'fallback-or-guard'),
      ],
      new Map([
        ['c1', 'legit-modernize-target'],
        ['c2', 'legit-modernize-target'],
        ['c3', 'not-old-pattern'],
        ['c4', 'fallback-or-guard'],
      ]),
      new Set(['c3', 'c4']),
    );
    assert.equal(metrics.krippendorffAlpha, 1.0);
    assert.equal(metrics.gwetAc1, 1.0);
    assert.equal(metrics.sensitivitySpecificity.tpr, 1.0);
    assert.equal(metrics.sensitivitySpecificity.tnr, 1.0);
    assert.equal(metrics.retainedDroppedRate, 1.0);
    assert.equal(metrics.misfireAgreement, 1.0);
    assert.equal(metrics.actionabilityAgreement, 1.0);
  });
});

describe('code snippet slicing, blind cards prep, and direct judge runner', () => {
  it('extracts snippet around target line and prepares blind cards', async () => {
    const file = ['line 1', 'line 2', 'line 3', 'target line 4', 'line 5', 'line 6'].join('\n');
    const snippet = extractCodeSnippet(file, 4, 1);
    assert.match(snippet, />    4 \| target line 4/);
    assert.match(snippet, /   3 \| line 3/);
    assert.match(snippet, /   5 \| line 5/);
    assert.doesNotMatch(snippet, /line 1/);

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
    const blindCards = await prepareBlindCards(
      items,
      new Map([['calculate-event-differentials', SAMPLE_GUIDE_SUMMARY]]),
    );
    assert.equal(blindCards.length, 1);
    assert.equal(blindCards[0].cardId, 'test-1');
    assert.equal(blindCards[0].codeSnippet, '  const d = a - b;');
    assert.equal(blindCards[0].guideSummary.guideId, 'calculate-event-differentials');
  });

  it('executes runJudgeDirect with mock fetch and attaches full input provenance', async () => {
    const cardWithExplainer: BlindCardPayload = {
      ...SAMPLE_BLIND_CARD,
      cardId: 'card-prov-1',
      ruleId: 'calculate-event-differentials',
      ruleHash: 'rulehash1234',
      guideSummary: {
        ...SAMPLE_GUIDE_SUMMARY,
        explainerContext: 'TC39 Temporal explainer excerpt.',
      },
    };

    const expectedProvenance = computeJudgeInputProvenance(cardWithExplainer);
    assert.equal(expectedProvenance.judgeVersion, JUDGE_VERSION);
    assert.equal(
      expectedProvenance.promptGuideHash,
      computePromptGuideHash(SAMPLE_GUIDE_SUMMARY.markdownBody),
    );
    assert.equal(
      expectedProvenance.explainerContextHash,
      computeExplainerContextHash('TC39 Temporal explainer excerpt.'),
    );
    assert.match(expectedProvenance.explainerContextHash, /^[0-9a-f]{12}$/);
    assert.equal(expectedProvenance.ruleId, 'calculate-event-differentials');
    assert.match(expectedProvenance.ruleGuideHash, /^[0-9a-f]{12}$/);
    assert.equal(expectedProvenance.ruleHash, 'rulehash1234');

    const mockDirectFetch: typeof fetch = async () =>
      mockGeminiResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    matches_before_syntax: true,
                    has_fallback_or_feature_guard: false,
                    modern_feature_applies_here: true,
                    has_meaningful_payoff: true,
                    reasoning: 'Matches old Date subtraction.',
                    verdict: 'legit-modernize-target',
                  }),
                },
              ],
            },
          },
        ],
      });

    const run0 = await runJudgeDirect([cardWithExplainer], {
      apiKey: 'test-key',
      fetchFn: mockDirectFetch,
    });
    const run1 = await runJudgeDirect([cardWithExplainer], {
      apiKey: 'test-key',
      fetchFn: mockDirectFetch,
    });
    const run2 = await runJudgeDirect([cardWithExplainer], {
      apiKey: 'test-key',
      fetchFn: mockDirectFetch,
    });

    assert.deepStrictEqual(run0[0].provenance, expectedProvenance);
    assert.deepStrictEqual(run0[0].facts.provenance, expectedProvenance);

    const consensusRow = evaluateJudgeStability([run0, run1, run2]).consensusResults[0];
    assert.equal(consensusRow.judgeVersion, JUDGE_VERSION);
    assert.equal(consensusRow.promptGuideHash, expectedProvenance.promptGuideHash);
    assert.equal(consensusRow.explainerContextHash, expectedProvenance.explainerContextHash);
    assert.equal(consensusRow.ruleId, 'calculate-event-differentials');
    assert.equal(consensusRow.ruleGuideHash, expectedProvenance.ruleGuideHash);
    assert.equal(consensusRow.ruleHash, 'rulehash1234');
    assert.deepStrictEqual(consensusRow.provenance, expectedProvenance);
    assert.deepStrictEqual(consensusRow.facts.provenance, expectedProvenance);
    assert.equal('rawResponse' in consensusRow, false);
    assert.equal('error' in consensusRow, false);
  });
});

describe('guide summary extraction and scored card loading', () => {
  it('fails fast when ANALYZER_EVAL_DATA_DIR is unset', async () => {
    const orig = process.env.ANALYZER_EVAL_DATA_DIR;
    delete process.env.ANALYZER_EVAL_DATA_DIR;
    try {
      await assert.rejects(
        () => loadGuideSummariesMap(),
        /ANALYZER_EVAL_DATA_DIR environment variable is not set/,
      );
      await assert.rejects(
        () => loadPaulIrishScoredCards(),
        /ANALYZER_EVAL_DATA_DIR environment variable is not set/,
      );
    } finally {
      if (orig) process.env.ANALYZER_EVAL_DATA_DIR = orig;
    }
  });

  it('hashes exact prompt markdownBody bytes in promptGuideHash and rejects sentinels', () => {
    const rawWithFrontmatter = `---\nname: sample\ndescription: Frontmatter desc\n---\n\n# Sample Title\n\n{{macro_token}}\n\nBody text sent to model.\n`;
    const parsed = parseGuideSummaryMarkdown(rawWithFrontmatter, 'sample');
    assert.equal(parsed.problem, 'Frontmatter desc');
    assert.ok(parsed.guideHash);
    assert.ok(parsed.promptGuideHash);
    assert.notEqual(parsed.promptGuideHash, parsed.guideHash);
    assert.equal(parsed.promptGuideHash, computePromptGuideHash(parsed.markdownBody));

    const prov = computeJudgeInputProvenance({
      ...SAMPLE_BLIND_CARD,
      guideHash: 'aaaaaaaaaaaa',
      guideSummary: { ...parsed, guideHash: 'bbbbbbbbbbbb' },
    });
    assert.equal(prov.promptGuideHash, computePromptGuideHash(parsed.markdownBody));
    assert.notEqual(prov.promptGuideHash, 'aaaaaaaaaaaa');
    assert.notEqual(prov.promptGuideHash, 'bbbbbbbbbbbb');

    assert.throws(
      () =>
        computeJudgeInputProvenance({
          ...SAMPLE_BLIND_CARD,
          guideHash: 'aaaaaaaaaaaa',
          guideSummary: { ...SAMPLE_GUIDE_SUMMARY, markdownBody: '   ' },
        }),
      /missing required guideSummary\.markdownBody/,
    );

    const sentinels = ['canary', 'calibration', '', 'none'];
    assert.deepStrictEqual(
      sentinels.map((sentinel) => {
        try {
          computeJudgeInputProvenance({ ...SAMPLE_BLIND_CARD, ruleHash: sentinel });
          return 'ok';
        } catch (e) {
          return (e as Error).message.includes('invalid/sentinel ruleHash') ? 'threw-ruleHash' : 'unexpected';
        }
      }),
      sentinels.map(() => 'threw-ruleHash'),
    );
    assert.deepStrictEqual(
      sentinels.map((sentinel) => {
        try {
          computeJudgeInputProvenance({ ...SAMPLE_BLIND_CARD, guideHash: sentinel });
          return 'ok';
        } catch (e) {
          return (e as Error).message.includes('invalid/sentinel guideHash') ? 'threw-guideHash' : 'unexpected';
        }
      }),
      sentinels.map(() => 'threw-guideHash'),
    );
  });

  it('fails fast on missing/corrupt explainers and empty/missing guide dirs unless allowMissingExplainers is set', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'guide-summaries-failfast-'));
    try {
      const guidesDir = join(tempRoot, 'guides');
      const guideFolder = join(guidesDir, 'css', 'sample-guide');
      await mkdir(guideFolder, { recursive: true });
      await writeFile(join(guideFolder, 'guide.md'), '# Sample Guide\n\nBody for sample guide.\n', 'utf8');

      const missingExplainersPath = join(tempRoot, 'missing-explainers.json');
      await assert.rejects(
        () => loadGuideSummariesMap(guidesDir, { explainersPath: missingExplainersPath }),
        /Failed to read required guide explainers file/,
      );

      const allowedMap = await loadGuideSummariesMap(guidesDir, {
        explainersPath: missingExplainersPath,
        allowMissingExplainers: true,
      });
      assert.equal(allowedMap.size, 1);
      assert.ok(allowedMap.get('sample-guide')?.promptGuideHash);

      const corruptExplainersPath = join(tempRoot, 'corrupt-explainers.json');
      await writeFile(corruptExplainersPath, '{not valid json', 'utf8');
      await assert.rejects(
        () =>
          loadGuideSummariesMap(guidesDir, {
            explainersPath: corruptExplainersPath,
            allowMissingExplainers: true,
          }),
        /Failed to parse guide explainers JSON/,
      );

      const emptyExplainersPath = join(tempRoot, 'empty-explainers.json');
      await writeFile(emptyExplainersPath, '[]', 'utf8');
      await assert.rejects(
        () => loadGuideSummariesMap(guidesDir, { explainersPath: emptyExplainersPath }),
        /expected a non-empty array/,
      );

      const validExplainersPath = join(tempRoot, 'valid-explainers.json');
      await writeFile(
        validExplainersPath,
        JSON.stringify([
          { guideId: 'sample-guide', combinedExcerpt: 'W3C CSSWG specification motivation.' },
        ]),
        'utf8',
      );
      const enrichedMap = await loadGuideSummariesMap(guidesDir, {
        explainersPath: validExplainersPath,
      });
      assert.equal(
        enrichedMap.get('sample-guide')?.explainerContext,
        'W3C CSSWG specification motivation.',
      );
      assert.equal(
        enrichedMap.get('sample-guide')?.explainerContextHash,
        computeExplainerContextHash('W3C CSSWG specification motivation.'),
      );

      const emptyGuidesDir = join(tempRoot, 'empty-guides');
      await mkdir(emptyGuidesDir, { recursive: true });
      await assert.rejects(
        () => loadGuideSummariesMap(emptyGuidesDir, { allowMissingExplainers: true }),
        /loaded 0 guides/,
      );

      await assert.rejects(
        () => loadGuideSummariesMap(join(tempRoot, 'does-not-exist'), { allowMissingExplainers: true }),
        /ENOENT/,
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('loads the human-scored cards from canonical files when ANALYZER_EVAL_DATA_DIR is set', async (t) => {
    if (!process.env.ANALYZER_EVAL_DATA_DIR) {
      t.skip('ANALYZER_EVAL_DATA_DIR not set');
      return;
    }
    const { cards, humanVerdicts } = await loadPaulIrishScoredCards();
    assert.ok(cards.length >= 90);
    assert.equal(humanVerdicts.size, cards.length);
    assert.equal(humanVerdicts.get('2547b2ba6d74'), 'not-old-pattern');
    assert.equal(humanVerdicts.get('7f2a96f62a4c'), 'not-old-pattern');
    assert.equal(humanVerdicts.get('c8147e8fdf52'), undefined);
  });
});
