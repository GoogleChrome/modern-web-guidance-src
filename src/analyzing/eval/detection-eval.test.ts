import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  type GuideSummaryInfo,
  type JudgeResult,
} from './detection-eval.ts';

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
    assert.equal(isJudgeVerdict('legit-modernize-target'), true);
    assert.equal(isJudgeVerdict('not-old-pattern'), true);
    assert.equal(isJudgeVerdict('fallback-or-guard'), true);
    assert.equal(isJudgeVerdict('loses-behavior'), true);
    assert.equal(isJudgeVerdict('no-payoff'), true);
    assert.equal(isJudgeVerdict('guide-wrong'), true);
    assert.equal(isJudgeVerdict('unsure'), true);
    assert.equal(isJudgeVerdict('right'), true);
    assert.equal(isJudgeVerdict('leave-it'), true);
    assert.equal(isJudgeVerdict('wrong'), false);
    assert.equal(isJudgeVerdict(123), false);
    assert.equal(isJudgeVerdict(null), false);
  });

  it('validates isPositiveVerdict, normalizeJudgeVerdict, and verdictsAgree', () => {
    assert.equal(isPositiveVerdict('legit-modernize-target'), true);
    assert.equal(isPositiveVerdict('right'), true);
    assert.equal(isPositiveVerdict('legit'), true);
    assert.equal(isPositiveVerdict('not-old-pattern'), false);
    assert.equal(isPositiveVerdict('fallback-or-guard'), false);
    assert.equal(isPositiveVerdict('loses-behavior'), false);
    assert.equal(isPositiveVerdict('no-payoff'), false);
    assert.equal(isPositiveVerdict('guide-wrong'), false);
    assert.equal(isPositiveVerdict('unsure'), false);

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

  it('formats blind card prompt including explainerContext when present on guideSummary', () => {
    const cardWithExplainer: BlindCardPayload = {
      ...SAMPLE_BLIND_CARD,
      cardId: 'card-with-explainer-1',
      guideSummary: {
        ...SAMPLE_GUIDE_SUMMARY,
        explainerContext: 'TC39 Temporal explainer: Date subtraction fails around DST boundaries and developers used moment.',
      },
    };
    const prompt = formatBlindCardPrompt(cardWithExplainer);

    assert.match(prompt, /## Modern Web Guidance Guide \(calculate-event-differentials\)/);
    assert.match(prompt, /## Upstream Feature Explainer & Motivation Context \(calculate-event-differentials\)/);
    assert.match(prompt, /developers used moment/);
  });

  it('excludes all guide-triage.json fields and dossier text from the formatted judge prompt even when triage entries exist', async () => {
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
        [
          '---',
          'name: individual-transform-properties',
          'description: Animate translate, rotate, and scale independently.',
          '---',
          '',
          '# Individual Transform Properties',
          '',
          'Use CSS `translate`, `rotate`, and `scale` properties to animate transforms independently.',
        ].join('\n'),
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

      const triageEntry = {
        guideId: 'individual-transform-properties',
        classification: 'detectable',
        detection: 'ast-pattern-SENTINEL_DETECTION',
        updateScope: 'cross-layer-refactor',
        changesSomethingForDeveloper: 'SENTINEL_PAYOFF_TEXT_FROM_TRIAGE',
        isLikeForLikeSwapAtSite: 'SENTINEL_SWAP_TEXT_FROM_TRIAGE',
        candidateTechniques: ['SENTINEL_CANDIDATE_TECHNIQUE'],
        replaces: ['SENTINEL_REPLACES_PATTERN'],
        doesNotReplace: ['SENTINEL_DOES_NOT_REPLACE_BOUNDARY'],
        falsePositiveTraps: ['SENTINEL_FALSE_POSITIVE_TRAP'],
        rationale: 'SENTINEL_TRIAGE_RATIONALE',
        brownfieldTarget: 'SENTINEL_BROWNFIELD_TARGET',
        evidenceFromGuide: 'SENTINEL_EVIDENCE_FROM_GUIDE',
        reason: 'SENTINEL_TRIAGE_REASON',
        provenance: {
          methodVersion: 'spec-two-stage-v1',
          model: 'gemini-2.5-pro',
          evaluatedAt: '2026-10-20T20:00:00.000Z',
          sources: ['guides/css/individual-transform-properties/guide.md'],
        },
      };
      await writeFile(join(evalDir, 'guide-triage.json'), JSON.stringify([triageEntry]), 'utf8');

      process.env.ANALYZER_EVAL_DATA_DIR = evalDir;
      const summaries = await loadGuideSummariesMap(join(tmpRoot, 'guides'));
      const summary = summaries.get('individual-transform-properties');
      assert.ok(summary, 'Expected guide summary to load');

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

      // Guide body, upstream explainer, and code snippet stay present
      assert.match(prompt, /## Modern Web Guidance Guide \(individual-transform-properties\)/);
      assert.match(prompt, /animate transforms independently/);
      assert.match(prompt, /## Upstream Feature Explainer & Motivation Context/);
      assert.match(prompt, /CSSWGTransforms-2 explainer/);
      assert.match(prompt, /transform: translateX\(10px\) rotate\(45deg\);/);

      // No dossier headers, triage field keys, or triage text appear anywhere in prompt or request payload
      const forbiddenSubstrings = [
        'Technical Reference Dossier',
        'Does NOT Replace',
        'Known False-Positive Traps',
        'Local Swap',
        'Update Scope',
        'changesSomethingForDeveloper',
        'isLikeForLikeSwapAtSite',
        'doesNotReplace',
        'falsePositiveTraps',
        'candidateTechniques',
        'brownfieldTarget',
        'evidenceFromGuide',
        'SENTINEL_DETECTION',
        'SENTINEL_PAYOFF_TEXT_FROM_TRIAGE',
        'SENTINEL_SWAP_TEXT_FROM_TRIAGE',
        'SENTINEL_CANDIDATE_TECHNIQUE',
        'SENTINEL_REPLACES_PATTERN',
        'SENTINEL_DOES_NOT_REPLACE_BOUNDARY',
        'SENTINEL_FALSE_POSITIVE_TRAP',
        'SENTINEL_TRIAGE_RATIONALE',
        'SENTINEL_BROWNFIELD_TARGET',
        'SENTINEL_EVIDENCE_FROM_GUIDE',
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

    if (process.env.ANALYZER_EVAL_DATA_DIR) {
      const liveMap = await loadGuideSummariesMap();
      const rawTriage = JSON.parse(
        await readFile(join(process.env.ANALYZER_EVAL_DATA_DIR, 'guide-triage.json'), 'utf8'),
      ) as Array<Record<string, unknown>>;
      const itpTriage = rawTriage.find((entry) => entry.guideId === 'individual-transform-properties');
      const itpSummary = liveMap.get('individual-transform-properties');
      assert.ok(itpTriage, 'Expected individual-transform-properties entry in guide-triage.json');
      assert.ok(itpSummary, 'Expected individual-transform-properties summary from guides/');

      const livePrompt = formatBlindCardPrompt({
        cardId: 'card-live-triage-isolation',
        file: 'src/styles.css',
        line: 12,
        guideId: 'individual-transform-properties',
        guideSummary: itpSummary,
        codeSnippet: '  transform: translateX(10px) rotate(45deg);',
      });
      assert.equal(livePrompt.includes('Technical Reference Dossier'), false);
      if (typeof itpTriage.changesSomethingForDeveloper === 'string' && itpTriage.changesSomethingForDeveloper.trim()) {
        assert.equal(livePrompt.includes(itpTriage.changesSomethingForDeveloper.trim()), false);
      }
    }
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

  it('throws an explicit error when markdownBody is missing (fail fast)', () => {
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

  it('only presents markdownBody when present and avoids injecting brownfield rubric', () => {
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
      has_meaningful_payoff: true,
      reasoning: 'Legacy millisecond subtraction with no guard.',
      verdict: 'legit-modernize-target',
    });

    const result = parseJudgeJsonContent(raw, 'card-001');
    assert.equal(result.cardId, 'card-001');
    assert.equal(result.verdict, 'legit-modernize-target');
    assert.equal(result.facts.matches_before_syntax, true);
    assert.equal(result.facts.has_fallback_or_feature_guard, false);
    assert.equal(result.facts.modern_feature_applies_here, true);
    assert.equal(result.facts.has_meaningful_payoff, true);
  });

  it('cross-checks and computes unambiguous verdicts from 4 boolean facts per 7-verdict taxonomy', () => {
    // 1. !matches_before_syntax -> 'not-old-pattern'
    const rawNotOld = JSON.stringify({
      matches_before_syntax: false,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: false,
      has_meaningful_payoff: false,
      reasoning: 'Not the old pattern.',
      verdict: 'not-old-pattern',
    });
    const res1 = parseJudgeJsonContent(rawNotOld, 'c1');
    assert.equal(res1.verdict, 'not-old-pattern');
    assert.equal(res1.facts.rawVerdict, 'not-old-pattern');

    // 2. matches_before_syntax && has_fallback_or_feature_guard -> 'fallback-or-guard'
    const rawFallback = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: true,
      modern_feature_applies_here: true,
      has_meaningful_payoff: true,
      reasoning: 'Protected by feature guard.',
      verdict: 'legit-modernize-target',
    });
    const res2 = parseJudgeJsonContent(rawFallback, 'c2');
    assert.equal(res2.verdict, 'fallback-or-guard');
    assert.equal(res2.facts.rawVerdict, 'legit-modernize-target');

    // 3. matches_before_syntax && !has_fallback && modern_feature_applies_here && has_meaningful_payoff -> 'legit-modernize-target'
    const rawLegit = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: true,
      has_meaningful_payoff: true,
      reasoning: 'Clean legacy match.',
      verdict: 'legit-modernize-target',
    });
    const res3 = parseJudgeJsonContent(rawLegit, 'c3');
    assert.equal(res3.verdict, 'legit-modernize-target');
    assert.equal(res3.facts.rawVerdict, 'legit-modernize-target');

    // 4. matches_before_syntax && !has_fallback && !modern_feature_applies_here -> 'loses-behavior'
    const rawLoses = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: false,
      has_meaningful_payoff: false,
      reasoning: 'Modern replacement lacks required capabilities.',
      verdict: 'loses-behavior',
    });
    const res4 = parseJudgeJsonContent(rawLoses, 'c4');
    assert.equal(res4.verdict, 'loses-behavior');
    assert.equal(res4.facts.rawVerdict, 'loses-behavior');

    // 5. matches_before_syntax && modern_applies but has_meaningful_payoff: false -> 'no-payoff'
    const rawNoPayoff = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: true,
      has_meaningful_payoff: false,
      reasoning: 'Single-function :hover transform is a zero-payoff syntax swap.',
      verdict: 'no-payoff',
    });
    const res5 = parseJudgeJsonContent(rawNoPayoff, 'c5');
    assert.equal(res5.verdict, 'no-payoff');
    assert.equal(res5.facts.rawVerdict, 'no-payoff');

    // 6. rawVerdict === 'unsure' is preserved
    const rawUnsure = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: true,
      has_meaningful_payoff: true,
      reasoning: 'Unsure about surrounding context.',
      verdict: 'unsure',
    });
    const res6 = parseJudgeJsonContent(rawUnsure, 'c6');
    assert.equal(res6.verdict, 'unsure');
    assert.equal(res6.facts.rawVerdict, 'unsure');

    // 7. rawVerdict === 'guide-wrong' is preserved
    const rawGuideWrong = JSON.stringify({
      matches_before_syntax: true,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: true,
      has_meaningful_payoff: true,
      reasoning: 'Guide gives bad advice for this case.',
      verdict: 'guide-wrong',
    });
    const res7 = parseJudgeJsonContent(rawGuideWrong, 'c7');
    assert.equal(res7.verdict, 'guide-wrong');
    assert.equal(res7.facts.rawVerdict, 'guide-wrong');
  });

  it('deriveJudgeVerdictFromFacts covers all truth table branches strictly', () => {
    // rawVerdict === 'guide-wrong' always returns 'guide-wrong'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true, has_meaningful_payoff: true },
        'guide-wrong',
      ),
      'guide-wrong',
    );

    // !matches_before_syntax -> 'not-old-pattern'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: false, has_fallback_or_feature_guard: false, modern_feature_applies_here: true, has_meaningful_payoff: true },
        'legit-modernize-target',
      ),
      'not-old-pattern',
    );

    // has_fallback_or_feature_guard -> 'fallback-or-guard'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: true, modern_feature_applies_here: true, has_meaningful_payoff: true },
        'legit-modernize-target',
      ),
      'fallback-or-guard',
    );

    // !modern_feature_applies_here -> 'loses-behavior'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: false, has_meaningful_payoff: true },
        'loses-behavior',
      ),
      'loses-behavior',
    );

    // has_meaningful_payoff: false -> 'no-payoff'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true, has_meaningful_payoff: false },
        'legit-modernize-target',
      ),
      'no-payoff',
    );

    // When all 4 booleans pass, 4 binary criteria are authoritative
    // and cannot be overridden by contradictory string verdicts like 'no-payoff', 'loses-behavior', 'fallback-or-guard'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true, has_meaningful_payoff: true },
        'no-payoff',
      ),
      'legit-modernize-target',
    );

    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true, has_meaningful_payoff: true },
        'loses-behavior',
      ),
      'legit-modernize-target',
    );

    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true, has_meaningful_payoff: true },
        'fallback-or-guard',
      ),
      'legit-modernize-target',
    );

    // rawVerdict === 'unsure' -> 'unsure'
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true, has_meaningful_payoff: true },
        'unsure',
      ),
      'unsure',
    );

    // clean legit modernize target match
    assert.equal(
      deriveJudgeVerdictFromFacts(
        { matches_before_syntax: true, has_fallback_or_feature_guard: false, modern_feature_applies_here: true, has_meaningful_payoff: true },
        'legit-modernize-target',
      ),
      'legit-modernize-target',
    );
  });

  it('throws an error on malformed or non-JSON output per Fail Fast', () => {
    assert.throws(
      () => parseJudgeJsonContent('Not valid JSON at all', 'card-002'),
      /not valid JSON/i,
    );
  });

  it('throws an error on JSON output missing required schema fields per Fail Fast', () => {
    assert.throws(
      () => parseJudgeJsonContent(JSON.stringify({ verdict: 'right' }), 'card-003'),
      /does not match schema/i,
    );
  });
});

describe('canary checking', () => {
  const canaries: CanaryCard[] = [
    { cardId: 'canary-pos-1', expectedVerdict: 'legit-modernize-target' },
    { cardId: 'canary-pos-2', expectedVerdict: 'legit-modernize-target' },
    { cardId: 'canary-neg-1', expectedVerdict: 'not-old-pattern' },
    { cardId: 'canary-neg-2', expectedVerdict: 'fallback-or-guard' },
  ];

  it('passes when all negative controls are rejected and positives pass', () => {
    const results: JudgeResult[] = [
      {
        cardId: 'canary-pos-1',
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'ok',
          verdict: 'legit-modernize-target',
        },
      },
      {
        cardId: 'canary-pos-2',
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'ok',
          verdict: 'legit-modernize-target',
        },
      },
      {
        cardId: 'canary-neg-1',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          has_meaningful_payoff: false,
          reasoning: 'ok',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'canary-neg-2',
        verdict: 'fallback-or-guard',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          has_meaningful_payoff: false,
          reasoning: 'ok',
          verdict: 'fallback-or-guard',
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
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'ok',
          verdict: 'legit-modernize-target',
        },
      },
      {
        cardId: 'canary-pos-2',
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'ok',
          verdict: 'legit-modernize-target',
        },
      },
      // Leaked false positive: marked legit-modernize-target instead of not-old-pattern!
      {
        cardId: 'canary-neg-1',
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'ok',
          verdict: 'legit-modernize-target',
        },
      },
      {
        cardId: 'canary-neg-2',
        verdict: 'fallback-or-guard',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          has_meaningful_payoff: false,
          reasoning: 'ok',
          verdict: 'fallback-or-guard',
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
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'r',
          verdict: 'legit-modernize-target',
        },
      },
      {
        cardId: 'c2',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          has_meaningful_payoff: false,
          reasoning: 'r',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'c3',
        verdict: 'fallback-or-guard',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          has_meaningful_payoff: false,
          reasoning: 'r',
          verdict: 'fallback-or-guard',
        },
      },
    ];

    const stability = evaluateJudgeStability([makeRun(), makeRun(), makeRun()]);
    assert.equal(stability.stabilityRate, 1.0);
    assert.equal(stability.krippendorffAlpha, 1.0);
    assert.equal(stability.gwetAc1, 1.0);
    assert.equal(stability.consensusResults[0].verdict, 'legit-modernize-target');
    assert.equal(stability.consensusResults[1].verdict, 'not-old-pattern');
    assert.equal(stability.consensusResults[2].verdict, 'fallback-or-guard');
  });

  it('determines consensus majority vote when one run differs', () => {
    const run0: JudgeResult[] = [
      {
        cardId: 'c1',
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'r',
          verdict: 'legit-modernize-target',
        },
      },
    ];
    const run1: JudgeResult[] = [
      {
        cardId: 'c1',
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'r',
          verdict: 'legit-modernize-target',
        },
      },
    ];
    const run2: JudgeResult[] = [
      {
        cardId: 'c1',
        verdict: 'no-payoff',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: false,
          reasoning: 'r',
          verdict: 'no-payoff',
        },
      },
    ];

    const stability = evaluateJudgeStability([run0, run1, run2]);
    assert.equal(stability.stabilityRate, 0.0); // 0 out of 1 had all 3 identical
    assert.equal(stability.consensusResults[0].verdict, 'legit-modernize-target'); // majority 2/3 voted legit
  });

  it('sets facts.verdict and facts.rawVerdict to unsure on a 3-way split', () => {
    const baseProv = computeJudgeInputProvenance(SAMPLE_BLIND_CARD);
    const makePass = (verdict: JudgeResult['verdict']): JudgeResult[] => [
      {
        cardId: SAMPLE_BLIND_CARD.cardId,
        verdict,
        facts: {
          matches_before_syntax: verdict !== 'not-old-pattern',
          has_fallback_or_feature_guard: verdict === 'fallback-or-guard',
          modern_feature_applies_here: true,
          has_meaningful_payoff: verdict === 'legit-modernize-target',
          reasoning: `vote ${verdict}`,
          verdict,
          rawVerdict: verdict,
          provenance: baseProv,
        },
        judgeVersion: baseProv.judgeVersion,
        promptGuideHash: baseProv.promptGuideHash,
        explainerContextHash: baseProv.explainerContextHash,
        dossierHash: baseProv.dossierHash,
        ruleId: baseProv.ruleId,
        ruleGuideHash: baseProv.ruleGuideHash,
        ruleHash: baseProv.ruleHash,
        provenance: baseProv,
      },
    ];

    const split = evaluateJudgeStability([
      makePass('legit-modernize-target'),
      makePass('not-old-pattern'),
      makePass('no-payoff'),
    ]);
    assert.equal(split.consensusResults[0].verdict, 'unsure');
    assert.equal(split.consensusResults[0].facts.verdict, 'unsure');
    assert.equal(split.consensusResults[0].facts.rawVerdict, 'unsure');
    assert.equal(split.consensusResults[0].promptGuideHash, baseProv.promptGuideHash);
    assert.equal(split.consensusResults[0].ruleHash, baseProv.ruleHash);
  });

  it('throws when the 3 stability runs disagree on input provenance or cardId', () => {
    const baseProv = computeJudgeInputProvenance(SAMPLE_BLIND_CARD);
    const makePass = (overrides: Partial<JudgeResult> = {}): JudgeResult[] => [
      {
        cardId: SAMPLE_BLIND_CARD.cardId,
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: 'ok',
          verdict: 'legit-modernize-target',
          provenance: baseProv,
        },
        judgeVersion: baseProv.judgeVersion,
        promptGuideHash: baseProv.promptGuideHash,
        explainerContextHash: baseProv.explainerContextHash,
        dossierHash: baseProv.dossierHash,
        ruleId: baseProv.ruleId,
        ruleGuideHash: baseProv.ruleGuideHash,
        ruleHash: baseProv.ruleHash,
        provenance: baseProv,
        ...overrides,
      },
    ];

    assert.throws(
      () =>
        evaluateJudgeStability([
          makePass(),
          makePass({ explainerContextHash: 'deadbeef1234' }),
          makePass(),
        ]),
      /Stability run provenance mismatch.*explainerContextHash/,
    );
    assert.throws(
      () =>
        evaluateJudgeStability([
          makePass(),
          makePass(),
          makePass({ promptGuideHash: 'cafebabe5678' }),
        ]),
      /Stability run provenance mismatch.*promptGuideHash/,
    );
    assert.throws(
      () => evaluateJudgeStability([makePass(), makePass({ cardId: 'other-card' }), makePass()]),
      /Stability run cardId mismatch/,
    );
  });
});

describe('evaluateJudgeMetrics', () => {
  it('computes agreement and PPI++ precision correctly', () => {
    const judgeResults: JudgeResult[] = [
      {
        cardId: 'c1',
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: '',
          verdict: 'legit-modernize-target',
        },
      },
      {
        cardId: 'c2',
        verdict: 'legit-modernize-target',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: true,
          has_meaningful_payoff: true,
          reasoning: '',
          verdict: 'legit-modernize-target',
        },
      },
      {
        cardId: 'c3',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          has_meaningful_payoff: false,
          reasoning: '',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'c4',
        verdict: 'fallback-or-guard',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          has_meaningful_payoff: false,
          reasoning: '',
          verdict: 'fallback-or-guard',
        },
      },
    ];

    const humanGrades = new Map<string, string>([
      ['c1', 'legit-modernize-target'],
      ['c2', 'legit-modernize-target'],
      ['c3', 'not-old-pattern'],
      ['c4', 'fallback-or-guard'],
    ]);

    const droppedCardIds = new Set(['c3', 'c4']);

    const metrics = evaluateJudgeMetrics(judgeResults, humanGrades, droppedCardIds);
    assert.equal(metrics.krippendorffAlpha, 1.0);
    assert.equal(metrics.gwetAc1, 1.0);
    assert.equal(metrics.sensitivitySpecificity.tpr, 1.0);
    assert.equal(metrics.sensitivitySpecificity.tnr, 1.0);
    assert.equal(metrics.retainedDroppedRate, 1.0);
    assert.equal(metrics.misfireAgreement, 1.0);
    assert.equal(metrics.actionabilityAgreement, 1.0);
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
                      has_meaningful_payoff: true,
                      reasoning: 'Matches old Date subtraction.',
                      verdict: 'legit-modernize-target',
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
    assert.equal(results[0].verdict, 'legit-modernize-target');
    assert.equal(results[0].facts.matches_before_syntax, true);
    assert.equal(results[0].judgeVersion, JUDGE_VERSION);
    assert.match(results[0].promptGuideHash ?? '', /^[0-9a-f]{12}$/);
    assert.equal(
      results[0].promptGuideHash,
      computePromptGuideHash(SAMPLE_BLIND_CARD.guideSummary.markdownBody),
    );
    assert.equal(results[0].explainerContextHash, 'none');
    assert.equal(results[0].dossierHash, 'none');
    assert.equal(results[0].ruleId, 'calculate-event-differentials');
    assert.match(results[0].ruleGuideHash ?? '', /^[0-9a-f]{12}$/);
    assert.match(results[0].ruleHash ?? '', /^[0-9a-f]{12}$/);
    assert.deepStrictEqual(results[0].provenance, results[0].facts.provenance);
  });

  it('versions every verdict row across direct, batch, and 3-pass consensus with full input provenance', async () => {
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
    assert.equal(expectedProvenance.dossierHash, 'none');
    assert.equal(expectedProvenance.ruleId, 'calculate-event-differentials');
    assert.match(expectedProvenance.ruleGuideHash, /^[0-9a-f]{12}$/);
    assert.equal(expectedProvenance.ruleHash, 'rulehash1234');

    const mockDirectFetch: typeof fetch = async () =>
      new Response(
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
                      has_meaningful_payoff: true,
                      reasoning: 'Matches old Date subtraction.',
                      verdict: 'legit-modernize-target',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const run0 = await runJudgeDirect([cardWithExplainer], {
      apiKey: 'test-key',
      fetchFn: mockDirectFetch,
    });
    const run1 = await runJudgeDirect([cardWithExplainer], {
      apiKey: 'test-key',
      fetchFn: mockDirectFetch,
    });

    let batchPollCount = 0;
    const mockBatchFetch: typeof fetch = async () => {
      batchPollCount++;
      if (batchPollCount === 1) {
        return new Response(JSON.stringify({ name: 'batches/test-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          name: 'batches/test-123',
          done: true,
          response: {
            inlinedResponses: {
              inlinedResponses: [
                {
                  response: {
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
                                reasoning: 'Batch pass.',
                                verdict: 'legit-modernize-target',
                              }),
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const run2 = await runJudgeBatch([cardWithExplainer], {
      apiKey: 'test-key',
      pollIntervalMs: 1,
      fetchFn: mockBatchFetch,
    });

    assert.deepStrictEqual(run0[0].provenance, expectedProvenance);
    assert.deepStrictEqual(run2[0].provenance, expectedProvenance);

    const stability = evaluateJudgeStability([run0, run1, run2]);
    const consensusRow = stability.consensusResults[0];
    assert.equal(consensusRow.judgeVersion, JUDGE_VERSION);
    assert.equal(consensusRow.promptGuideHash, expectedProvenance.promptGuideHash);
    assert.equal(consensusRow.explainerContextHash, expectedProvenance.explainerContextHash);
    assert.equal(consensusRow.dossierHash, 'none');
    assert.equal(consensusRow.ruleId, 'calculate-event-differentials');
    assert.equal(consensusRow.ruleGuideHash, expectedProvenance.ruleGuideHash);
    assert.equal(consensusRow.ruleHash, 'rulehash1234');
    assert.deepStrictEqual(consensusRow.provenance, expectedProvenance);
    assert.deepStrictEqual(consensusRow.facts.provenance, expectedProvenance);
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
                      has_meaningful_payoff: true,
                      reasoning: 'Matches directly.',
                      verdict: 'legit-modernize-target',
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
    assert.equal(results[0].verdict, 'legit-modernize-target');
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

  it('fails fast in loadGuideSummariesMap when ANALYZER_EVAL_DATA_DIR is unset', async () => {
    const orig = process.env.ANALYZER_EVAL_DATA_DIR;
    delete process.env.ANALYZER_EVAL_DATA_DIR;
    try {
      await assert.rejects(
        () => loadGuideSummariesMap(),
        /ANALYZER_EVAL_DATA_DIR environment variable is not set/,
      );
    } finally {
      if (orig) process.env.ANALYZER_EVAL_DATA_DIR = orig;
    }
  });

  it('hashes exact prompt markdownBody bytes in promptGuideHash and rejects sentinels or missing markdownBody', () => {
    const rawWithFrontmatter = `---\nname: sample\ndescription: Frontmatter desc\n---\n\n# Sample Title\n\n{{macro_token}}\n\nBody text sent to model.\n`;
    const parsed = parseGuideSummaryMarkdown(rawWithFrontmatter, 'sample');
    assert.ok(parsed.guideHash);
    assert.ok(parsed.promptGuideHash);
    assert.notEqual(parsed.promptGuideHash, parsed.guideHash);
    assert.equal(parsed.promptGuideHash, computePromptGuideHash(parsed.markdownBody));

    // Even if card.guideHash or card.guideSummary.guideHash has a different raw hash, promptGuideHash hashes exact markdownBody.trim()
    const card: BlindCardPayload = {
      ...SAMPLE_BLIND_CARD,
      guideHash: 'aaaaaaaaaaaa',
      guideSummary: {
        ...parsed,
        guideHash: 'bbbbbbbbbbbb',
      },
    };
    const prov = computeJudgeInputProvenance(card);
    assert.equal(prov.promptGuideHash, computePromptGuideHash(parsed.markdownBody));
    assert.notEqual(prov.promptGuideHash, 'aaaaaaaaaaaa');
    assert.notEqual(prov.promptGuideHash, 'bbbbbbbbbbbb');

    // Missing markdownBody throws instead of falling back
    assert.throws(
      () =>
        computeJudgeInputProvenance({
          ...SAMPLE_BLIND_CARD,
          guideHash: 'aaaaaaaaaaaa',
          guideSummary: { ...SAMPLE_GUIDE_SUMMARY, markdownBody: '   ' },
        }),
      /missing required guideSummary\.markdownBody/,
    );

    // Sentinel strings on ruleHash or guideHash throw immediately
    for (const sentinel of ['canary', 'calibration', '', 'none']) {
      assert.throws(
        () => computeJudgeInputProvenance({ ...SAMPLE_BLIND_CARD, ruleHash: sentinel }),
        /invalid\/sentinel ruleHash/,
      );
      assert.throws(
        () => computeJudgeInputProvenance({ ...SAMPLE_BLIND_CARD, guideHash: sentinel }),
        /invalid\/sentinel guideHash/,
      );
    }
  });

  it('fails fast on missing/corrupt explainers, empty guide dirs, and corrupt summary JSON unless allowMissingExplainers is set', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'guide-summaries-failfast-'));
    try {
      const guidesDir = join(tempRoot, 'guides');
      const guideFolder = join(guidesDir, 'css', 'sample-guide');
      await mkdir(guideFolder, { recursive: true });
      await writeFile(
        join(guideFolder, 'guide.md'),
        '# Sample Guide\n\nBody for sample guide.\n',
        'utf8',
      );

      // 1. Missing explainers file throws by default
      const missingExplainersPath = join(tempRoot, 'missing-explainers.json');
      await assert.rejects(
        () => loadGuideSummariesMap(guidesDir, { explainersPath: missingExplainersPath }),
        /Failed to read required guide explainers file/,
      );

      // 2. Explicit allowMissingExplainers succeeds ONLY when explainers file is ENOENT
      const allowedMap = await loadGuideSummariesMap(guidesDir, {
        explainersPath: missingExplainersPath,
        allowMissingExplainers: true,
      });
      assert.equal(allowedMap.size, 1);
      assert.ok(allowedMap.get('sample-guide')?.promptGuideHash);

      // 3. Corrupt explainers JSON throws even when allowMissingExplainers is true
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

      // 4. Empty explainers array throws
      const emptyExplainersPath = join(tempRoot, 'empty-explainers.json');
      await writeFile(emptyExplainersPath, '[]', 'utf8');
      await assert.rejects(
        () => loadGuideSummariesMap(guidesDir, { explainersPath: emptyExplainersPath }),
        /expected a non-empty array/,
      );

      // 5. Valid explainers file populates explainerContext and explainerContextHash deterministically
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

      // 6. Empty guides directory throws
      const emptyGuidesDir = join(tempRoot, 'empty-guides');
      await mkdir(emptyGuidesDir, { recursive: true });
      await assert.rejects(
        () => loadGuideSummariesMap(emptyGuidesDir, { allowMissingExplainers: true }),
        /loaded 0 guides/,
      );

      // 7. Missing guides directory throws
      await assert.rejects(
        () =>
          loadGuideSummariesMap(join(tempRoot, 'does-not-exist'), {
            allowMissingExplainers: true,
          }),
        /ENOENT/,
      );

      // 8. Corrupt .json summary file throws instead of returning empty map
      const corruptSummariesJson = join(tempRoot, 'summaries.json');
      await writeFile(corruptSummariesJson, '{corrupt', 'utf8');
      await assert.rejects(
        () => loadGuideSummariesMap(corruptSummariesJson, { allowMissingExplainers: true }),
        /SyntaxError|JSON/,
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('loadPaulIrishScoredCards', () => {
  it('fails fast when ANALYZER_EVAL_DATA_DIR is unset', async () => {
    const orig = process.env.ANALYZER_EVAL_DATA_DIR;
    delete process.env.ANALYZER_EVAL_DATA_DIR;
    try {
      await assert.rejects(
        () => loadPaulIrishScoredCards(),
        /ANALYZER_EVAL_DATA_DIR environment variable is not set/,
      );
    } finally {
      if (orig) process.env.ANALYZER_EVAL_DATA_DIR = orig;
    }
  });

  it('loads the human-scored cards from canonical files excluding unsure, stubs, retired guides, and verifier drops', async (t) => {
    if (!process.env.ANALYZER_EVAL_DATA_DIR) {
      t.skip('ANALYZER_EVAL_DATA_DIR not set');
      return;
    }
    const { cards, humanVerdicts } = await loadPaulIrishScoredCards();
    assert.ok(cards.length >= 90);
    assert.equal(humanVerdicts.size, cards.length);
    assert.equal(humanVerdicts.get('2547b2ba6d74'), 'not-old-pattern');
    assert.equal(humanVerdicts.get('7f2a96f62a4c'), 'not-old-pattern');
    assert.equal(humanVerdicts.get('c8147e8fdf52'), undefined); // 'unsure' excluded
  });
});
