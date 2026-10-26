import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePromptContentHash,
  computeGuideTriagePromptVersion,
  computeVerifierPromptVersion,
  computeJudgePromptVersion,
  computeUpdateSimulationPromptVersion,
  formatBlindCardPrompt,
  formatUpdateSimulationPrompt,
  formatGuideTriagePrompt,
  formatVerifierPrompt,
  UPDATE_SIMULATION_RESPONSE_SCHEMA,
  UPDATE_SIMULATION_THINKING_BUDGET,
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
  UPDATE_SIMULATION_PROMPT_VERSION,
  UPDATE_SIMULATION_PROMPT,
} from './prompts.ts';

describe('prompts: content-hashed versions', () => {
  it('includes model name in all 4 prompt version strings', () => {
    assert.ok(GUIDE_TRIAGE_PROMPT_VERSION.startsWith(`${PROMPT_MODEL}:`), 'Guide Triage version includes model');
    assert.ok(VERIFIER_PROMPT_VERSION.startsWith(`${PROMPT_MODEL}:`), 'Verifier version includes model');
    assert.ok(JUDGE_VERSION.startsWith(`${PROMPT_MODEL}:`), 'Judge version includes model');
    assert.ok(UPDATE_SIMULATION_PROMPT_VERSION.startsWith(`${PROMPT_MODEL}:`), 'Update version includes model');
  });

  it('matches deterministic 8-char SHA-256 hash for Guide Triage', () => {
    const expectedHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: GUIDE_TRIAGE_SYSTEM_PROMPT,
      userPromptTemplateSource: formatGuideTriagePrompt.toString(),
      schema: GUIDE_TRIAGE_RESPONSE_SCHEMA,
      thinkingBudget: GUIDE_TRIAGE_THINKING_BUDGET,
      temperature: 0.0,
      enableSearchGrounding: true,
    });
    assert.strictEqual(GUIDE_TRIAGE_PROMPT_VERSION, `${PROMPT_MODEL}:gate0-v2-${expectedHash}`);
    assert.match(GUIDE_TRIAGE_PROMPT_VERSION, /^gemini-3\.8-flash:gate0-v2-[0-9a-f]{8}$/);
    assert.strictEqual(computeGuideTriagePromptVersion(), GUIDE_TRIAGE_PROMPT_VERSION);
  });

  it('matches deterministic 8-char SHA-256 hash for Verifier', () => {
    const expectedHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: VERIFIER_SYSTEM_PROMPT,
      userPromptTemplateSource: formatVerifierPrompt.toString(),
      schema: VERIFIER_RESPONSE_SCHEMA,
      thinkingBudget: VERIFIER_THINKING_BUDGET,
      temperature: 0.0,
      enableSearchGrounding: false,
    });
    assert.strictEqual(VERIFIER_PROMPT_VERSION, `${PROMPT_MODEL}:phase2-v2-guide-${expectedHash}`);
    assert.match(VERIFIER_PROMPT_VERSION, /^gemini-3\.8-flash:phase2-v2-guide-[0-9a-f]{8}$/);
    assert.strictEqual(computeVerifierPromptVersion(), VERIFIER_PROMPT_VERSION);
  });

  it('matches deterministic 8-char SHA-256 hash for Judge', () => {
    const expectedHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userPromptTemplateSource: formatBlindCardPrompt.toString(),
      schema: JUDGE_RESPONSE_SCHEMA,
      thinkingBudget: JUDGE_THINKING_BUDGET,
      temperature: 0.2,
      enableSearchGrounding: false,
    });
    assert.strictEqual(JUDGE_VERSION, `${PROMPT_MODEL}:detective-v6-spec22-${expectedHash}`);
    assert.match(JUDGE_VERSION, /^gemini-3\.8-flash:detective-v6-spec22-[0-9a-f]{8}$/);
    assert.strictEqual(computeJudgePromptVersion(), JUDGE_VERSION);
  });

  it('matches deterministic 8-char SHA-256 hash for Synthetic Update', () => {
    const expectedHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: UPDATE_SIMULATION_PROMPT,
      userPromptTemplateSource: formatUpdateSimulationPrompt.toString(),
      schema: UPDATE_SIMULATION_RESPONSE_SCHEMA,
      thinkingBudget: UPDATE_SIMULATION_THINKING_BUDGET,
      temperature: 0.0,
      enableSearchGrounding: false,
    });
    assert.strictEqual(UPDATE_SIMULATION_PROMPT_VERSION, `${PROMPT_MODEL}:fix-sim-v2-${expectedHash}`);
    assert.match(UPDATE_SIMULATION_PROMPT_VERSION, /^gemini-3\.8-flash:fix-sim-v2-[0-9a-f]{8}$/);
    assert.strictEqual(computeUpdateSimulationPromptVersion(), UPDATE_SIMULATION_PROMPT_VERSION);
  });
});

describe('prompts: prompt formatters and schema validation', () => {
  it('formatGuideTriagePrompt formats guide with candidateTechniques and borderline instructions', () => {
    const formatted = formatGuideTriagePrompt({
      guideId: 'test-guide',
      category: 'css',
      markdownContent: '# Test Guide\n\nUse text-wrap: balance.',
    });
    assert.match(formatted, /## Guide: test-guide \(Category: css\)/);
    assert.match(formatted, /Use text-wrap: balance\./);
    assert.match(formatted, /candidateTechniques/);
    assert.match(formatted, /borderline flag/);
  });

  it('formatGuideTriagePrompt includes upstream explainer context when provided', () => {
    const formatted = formatGuideTriagePrompt({
      guideId: 'test-guide',
      category: 'css',
      markdownContent: '# Test Guide\n\nUse text-wrap: balance.',
      explainerContext: 'CSSWG proposal: developers currently use JS libraries like balance-text.',
    });
    assert.match(formatted, /### Upstream W3C \/ TC39 \/ ChromeStatus Explainer & Motivation Context:/);
    assert.match(formatted, /developers currently use JS libraries like balance-text\./);
  });

  it('formatVerifierPrompt includes full guide.md when provided', () => {
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

  it('formatBlindCardPrompt throws when markdownBody is missing (fail fast)', () => {
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
  });

  it('formatBlindCardPrompt succeeds when markdownBody is provided', () => {
    const formatted = formatBlindCardPrompt({
      cardId: 'card-with-body',
      file: 'src/app.js',
      line: 5,
      guideId: 'dialog',
      codeSnippet: '$("#my-modal").show();',
      guideSummary: {
        markdownBody: '# Dialog Guide\n\nUse native <dialog> element.',
      },
    });

    assert.match(formatted, /## Modern Web Guidance Guide \(dialog\)/);
    assert.match(formatted, /Use native <dialog> element\./);
    assert.match(formatted, /\$\("#my-modal"\)\.show\(\);/);
  });

  it('formatBlindCardPrompt includes upstream explainer context when provided', () => {
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
    assert.match(formatted, /## Upstream Feature Explainer & Motivation Context \(dialog\)/);
    assert.match(formatted, /jquery-ui dialog or bootstrap modal/);
  });

  it('JUDGE_SYSTEM_PROMPT includes 7-verdict criteria and core grading rules', () => {
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes('Genuine legacy pattern where applying the guide is a clean win'),
    );
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes(
        "Matcher misfired — this code isn't even doing the legacy pattern the guide replaces",
      ),
    );
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('zero-payoff syntax swap'));
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes('INCREMENTAL DEPENDENCY REDUCTION IS A LEGIT MODERNIZE TARGET'),
    );
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes('CROSS-LAYER (JS -> CSS/HTML) REPLACEMENTS TAUGHT BY THE GUIDE'),
    );
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes('STANDARDIZED NATIVE UI EQUIVALENTS ARE LEGIT MODERNIZE TARGETS'),
    );
    assert.ok(JUDGE_SYSTEM_PROMPT.includes("'fallback-or-guard'"));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes("'loses-behavior'"));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes("'no-payoff'"));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes("'legit-modernize-target'"));
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes(
        "The guide's advice is bad or overstates what the feature does for this case",
      ),
    );
  });

  it('formatUpdateSimulationPrompt formats update request cleanly', () => {
    const formatted = formatUpdateSimulationPrompt({
      guideId: 'dialog',
      guideMarkdown: '# Dialog Guide\n\nUse <dialog>.',
      filePath: 'src/app.js',
      line: 10,
      findingMessage: 'Custom div modal',
      windowText: 'function open() { modal.style.display = "block"; }',
    });

    assert.match(formatted, /## Modern Web Guide: dialog/);
    assert.match(formatted, /## Target Code Window/);
    assert.match(formatted, /modal\.style\.display = "block"/);
    assert.match(formatted, /If this finding is a false positive or intentional fallback/);
  });
});
