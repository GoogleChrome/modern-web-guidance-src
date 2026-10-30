import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePromptContentHash,
  computeGuideTriagePromptVersion,
  computeVerifierPromptVersion,
  computeJudgePromptVersion,
  formatBlindCardPrompt,
  formatGuideTriagePrompt,
  formatVerifierPrompt,
  GUIDE_TRIAGE_PROMPT_VERSION,
  GUIDE_TRIAGE_RESPONSE_SCHEMA,
  GUIDE_TRIAGE_SYSTEM_PROMPT,
  GUIDE_TRIAGE_THINKING_BUDGET,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_THINKING_BUDGET,
  JUDGE_VERSION,
  VERIFIER_PROMPT_VERSION,
  VERIFIER_RESPONSE_SCHEMA,
  VERIFIER_SYSTEM_PROMPT,
  VERIFIER_THINKING_BUDGET,
  PROMPT_MODEL,
} from './prompts.ts';

describe('prompts: content-hashed versions', () => {
  it('matches deterministic 8-char SHA-256 hashes and pinned version identities', () => {
    const triageHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: GUIDE_TRIAGE_SYSTEM_PROMPT,
      userPromptTemplateSource: formatGuideTriagePrompt.toString(),
      schema: GUIDE_TRIAGE_RESPONSE_SCHEMA,
      thinkingBudget: GUIDE_TRIAGE_THINKING_BUDGET,
      temperature: 0.0,
      enableSearchGrounding: true,
    });
    assert.strictEqual(GUIDE_TRIAGE_PROMPT_VERSION, `${PROMPT_MODEL}:gate0-v2-${triageHash}`);
    assert.match(GUIDE_TRIAGE_PROMPT_VERSION, /^gemini-3\.8-flash:gate0-v2-[0-9a-f]{8}$/);
    assert.strictEqual(computeGuideTriagePromptVersion(), GUIDE_TRIAGE_PROMPT_VERSION);

    const verifierHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: VERIFIER_SYSTEM_PROMPT,
      userPromptTemplateSource: formatVerifierPrompt.toString(),
      schema: VERIFIER_RESPONSE_SCHEMA,
      thinkingBudget: VERIFIER_THINKING_BUDGET,
      temperature: 0.0,
      enableSearchGrounding: false,
    });
    assert.strictEqual(VERIFIER_PROMPT_VERSION, `${PROMPT_MODEL}:phase2-v2-guide-${verifierHash}`);
    assert.strictEqual(VERIFIER_PROMPT_VERSION, 'gemini-3.8-flash:phase2-v2-guide-e3c8dc91');
    assert.strictEqual(computeVerifierPromptVersion(), VERIFIER_PROMPT_VERSION);

    const judgeHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userPromptTemplateSource: formatBlindCardPrompt.toString(),
      schema: JUDGE_RESPONSE_SCHEMA,
      thinkingBudget: JUDGE_THINKING_BUDGET,
      temperature: 0.2,
      enableSearchGrounding: false,
    });
    assert.strictEqual(JUDGE_VERSION, `${PROMPT_MODEL}:detective-v7-${judgeHash}`);
    assert.strictEqual(JUDGE_VERSION, 'gemini-3.8-flash:detective-v7-6e9c8398');
    assert.strictEqual(computeJudgePromptVersion(), JUDGE_VERSION);
  });
});

describe('prompts: prompt formatters and schema validation', () => {
  it('formats Guide Triage prompt with and without upstream explainer context', () => {
    const base = formatGuideTriagePrompt({
      guideId: 'test-guide',
      category: 'css',
      markdownContent: '# Test Guide\n\nUse text-wrap: balance.',
    });
    assert.match(base, /## Guide: test-guide \(Category: css\)/);
    assert.match(base, /Use text-wrap: balance\./);
    assert.match(base, /candidateTechniques/);
    assert.match(base, /borderline flag/);

    const withExplainer = formatGuideTriagePrompt({
      guideId: 'test-guide',
      category: 'css',
      markdownContent: '# Test Guide\n\nUse text-wrap: balance.',
      explainerContext: 'CSSWG proposal: developers currently use JS libraries like balance-text.',
    });
    assert.match(withExplainer, /### Upstream W3C \/ TC39 \/ ChromeStatus Explainer & Motivation Context:/);
    assert.match(withExplainer, /developers currently use JS libraries like balance-text\./);
  });

  it('formats Verifier prompt with full guide.md and rubric criteria', () => {
    const formatted = formatVerifierPrompt(
      {
        file: 'src/main.ts',
        line: 12,
        message: 'Legacy text balancing',
        contextSlice: 'const balanced = balanceText(el);',
      },
      {
        id: 'improve-text-layout-and-legibility',
        guideId: 'improve-text-layout-and-legibility',
        summary: 'Replace JS balancing with text-wrap: balance',
        verifierRubric: {
          keepWhen: ['JS library balancing headings'],
          dropWhen: ['Canvas/WebGL rendering'],
        },
      },
      '# Text Balancing Guide\n\nUse CSS text-wrap: balance for headlines.',
    );

    assert.match(formatted, /## Modern Web Guidance Guide \(improve-text-layout-and-legibility\)/);
    assert.match(formatted, /Use CSS text-wrap: balance for headlines\./);
    assert.match(formatted, /## Rule: improve-text-layout-and-legibility/);
    assert.match(formatted, /Keep When:\n- JS library balancing headings/);
    assert.match(formatted, /Drop When:\n- Canvas\/WebGL rendering/);
  });

  it('formats BlindCard prompt and fails fast when markdownBody is missing', () => {
    assert.throws(
      () =>
        formatBlindCardPrompt({
          cardId: 'card-no-body',
          file: 'src/app.js',
          line: 5,
          guideId: 'dialog',
          codeSnippet: '$("#my-modal").show();',
          guideSummary: {},
        }),
      /missing required guideSummary\.markdownBody/,
    );

    const formatted = formatBlindCardPrompt({
      cardId: 'card-with-explainer',
      file: 'src/app.js',
      line: 5,
      guideId: 'dialog',
      codeSnippet: '$("#my-modal").show();',
      guideSummary: {
        markdownBody: '# Dialog Guide\n\nUse native <dialog> element.',
        explainerContext: 'HTML dialog explainer: developers historically used jquery-ui dialog or bootstrap modal.',
      },
    });
    assert.match(formatted, /## Modern Web Guidance Guide \(dialog\)/);
    assert.match(formatted, /Use native <dialog> element\./);
    assert.match(formatted, /\$\("#my-modal"\)\.show\(\);/);
    assert.match(formatted, /## Upstream Feature Explainer & Motivation Context \(dialog\)/);
    assert.match(formatted, /jquery-ui dialog or bootstrap modal/);
  });

  it('includes 7-verdict criteria and core grading rules in JUDGE_SYSTEM_PROMPT', () => {
    const requiredSubstrings = [
      'Genuine legacy pattern where applying the guide is a clean win',
      "Matcher misfired — this code isn't even doing the legacy pattern the guide replaces",
      'zero-payoff syntax swap',
      'INCREMENTAL DEPENDENCY REDUCTION IS A LEGIT MODERNIZE TARGET',
      'CROSS-LAYER (JS -> CSS/HTML) REPLACEMENTS TAUGHT BY THE GUIDE',
      'STANDARDIZED NATIVE UI EQUIVALENTS ARE LEGIT MODERNIZE TARGETS',
      "'fallback-or-guard'",
      "'loses-behavior'",
      "'no-payoff'",
      "'legit-modernize-target'",
      "The guide's advice is bad or overstates what the feature does for this case",
    ];
    assert.deepStrictEqual(
      requiredSubstrings.filter((s) => !JUDGE_SYSTEM_PROMPT.includes(s)),
      [],
    );
  });
});
