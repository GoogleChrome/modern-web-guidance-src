import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePromptContentHash,
  computeGate0PromptVersion,
  computePhase2PromptVersion,
  computeJudgePromptVersion,
  computeSyntheticFixPromptVersion,
  formatBlindCardPrompt,
  formatFixSimulationPrompt,
  formatGate0Prompt,
  formatPhase2Prompt,
  FIX_RESPONSE_SCHEMA,
  FIX_SIMULATION_THINKING_BUDGET,
  FIX_USER_PROMPT_TEMPLATE,
  GATE0_PROMPT_VERSION,
  GATE0_RESPONSE_SCHEMA,
  GATE0_SYSTEM_PROMPT,
  GATE0_THINKING_BUDGET,
  GATE0_USER_PROMPT_TEMPLATE,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_THINKING_BUDGET,
  JUDGE_USER_PROMPT_TEMPLATE,
  JUDGE_VERSION,
  PHASE2_PROMPT_VERSION,
  PHASE2_RESPONSE_SCHEMA,
  PHASE2_SYSTEM_PROMPT,
  PHASE2_THINKING_BUDGET,
  PHASE2_USER_PROMPT_TEMPLATE,
  PROMPT_MODEL,
  SYNTHETIC_FIX_PROMPT_VERSION,
  SYNTHETIC_FIX_SIMULATION_PROMPT,
} from './prompts.ts';

describe('prompts: content-hashed versions (R31)', () => {
  it('includes model name in all 4 prompt version strings', () => {
    assert.ok(GATE0_PROMPT_VERSION.startsWith(`${PROMPT_MODEL}:`), 'Gate 0 version includes model');
    assert.ok(PHASE2_PROMPT_VERSION.startsWith(`${PROMPT_MODEL}:`), 'Phase 2 version includes model');
    assert.ok(JUDGE_VERSION.startsWith(`${PROMPT_MODEL}:`), 'Judge version includes model');
    assert.ok(SYNTHETIC_FIX_PROMPT_VERSION.startsWith(`${PROMPT_MODEL}:`), 'Fix version includes model');
  });

  it('matches deterministic 8-char SHA-256 hash for Gate 0', () => {
    const expectedHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: GATE0_SYSTEM_PROMPT,
      userPromptTemplateSource: formatGate0Prompt.toString(),
      schema: GATE0_RESPONSE_SCHEMA,
      thinkingBudget: GATE0_THINKING_BUDGET,
      temperature: 0.0,
      enableSearchGrounding: true,
    });
    assert.strictEqual(GATE0_PROMPT_VERSION, `${PROMPT_MODEL}:gate0-v2-${expectedHash}`);
    assert.match(GATE0_PROMPT_VERSION, /^gemini-3\.8-flash:gate0-v2-[0-9a-f]{8}$/);
    assert.strictEqual(computeGate0PromptVersion(), GATE0_PROMPT_VERSION);
  });

  it('matches deterministic 8-char SHA-256 hash for Phase 2', () => {
    const expectedHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: PHASE2_SYSTEM_PROMPT,
      userPromptTemplateSource: formatPhase2Prompt.toString(),
      schema: PHASE2_RESPONSE_SCHEMA,
      thinkingBudget: PHASE2_THINKING_BUDGET,
      temperature: 0.0,
      enableSearchGrounding: false,
    });
    assert.strictEqual(PHASE2_PROMPT_VERSION, `${PROMPT_MODEL}:phase2-v2-guide-${expectedHash}`);
    assert.match(PHASE2_PROMPT_VERSION, /^gemini-3\.8-flash:phase2-v2-guide-[0-9a-f]{8}$/);
    assert.strictEqual(computePhase2PromptVersion(), PHASE2_PROMPT_VERSION);
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

  it('matches deterministic 8-char SHA-256 hash for Synthetic Fix', () => {
    const expectedHash = computePromptContentHash({
      model: PROMPT_MODEL,
      systemPrompt: SYNTHETIC_FIX_SIMULATION_PROMPT,
      userPromptTemplateSource: formatFixSimulationPrompt.toString(),
      schema: FIX_RESPONSE_SCHEMA,
      thinkingBudget: FIX_SIMULATION_THINKING_BUDGET,
      temperature: 0.0,
      enableSearchGrounding: false,
    });
    assert.strictEqual(SYNTHETIC_FIX_PROMPT_VERSION, `${PROMPT_MODEL}:fix-sim-v2-${expectedHash}`);
    assert.match(SYNTHETIC_FIX_PROMPT_VERSION, /^gemini-3\.8-flash:fix-sim-v2-[0-9a-f]{8}$/);
    assert.strictEqual(computeSyntheticFixPromptVersion(), SYNTHETIC_FIX_PROMPT_VERSION);
  });
});

describe('prompts: prompt formatters and schema validation (R27–R30)', () => {
  it('formatGate0Prompt formats guide with candidateTechniques and borderline instructions', () => {
    const formatted = formatGate0Prompt({
      guideId: 'test-guide',
      category: 'css',
      markdownContent: '# Test Guide\n\nUse text-wrap: balance.',
    });
    assert.match(formatted, /## Guide: test-guide \(Category: css\)/);
    assert.match(formatted, /Use text-wrap: balance\./);
    assert.match(formatted, /candidateTechniques/);
    assert.match(formatted, /borderline flag/);
  });

  it('formatGate0Prompt includes upstream explainer context when provided', () => {
    const formatted = formatGate0Prompt({
      guideId: 'test-guide',
      category: 'css',
      markdownContent: '# Test Guide\n\nUse text-wrap: balance.',
      explainerContext: 'CSSWG proposal: developers currently use JS libraries like balance-text.',
    });
    assert.match(formatted, /### Upstream W3C \/ TC39 \/ ChromeStatus Explainer & Motivation Context:/);
    assert.match(formatted, /developers currently use JS libraries like balance-text\./);
  });

  it('formatPhase2Prompt includes full guide.md when provided', () => {
    const formatted = formatPhase2Prompt(
      {
        file: 'src/main.ts',
        line: 12,
        message: 'Legacy text balancing',
        astSlice: 'const balanced = balanceText(el);',
      },
      {
        id: 'improve-text-layout-and-legibility',
        guideId: 'improve-text-layout-and-legibility',
        summary: 'Replace JS balancing with text-wrap: balance',
        phase2Rubric: {
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

  it('formatBlindCardPrompt throws when markdownBody is missing (R29 fail fast)', () => {
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

  it('JUDGE_SYSTEM_PROMPT includes R45 leave-it and not-old-pattern criteria', () => {
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes('Genuine legacy pattern where applying the guide is a clean win'),
    );
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes(
        "Matcher misfired — this code isn't even doing the legacy pattern the guide replaces",
      ),
    );
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('no-op syntax swap'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('non-1:1 library component migration'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('custom side effects'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('order-dependent geometry'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('incompatible API contract'));
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes(
        "The guide's advice is bad or overstates what the feature does for this case",
      ),
    );
  });

  it('formatFixSimulationPrompt formats fix request cleanly', () => {
    const formatted = formatFixSimulationPrompt({
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
