/**
 * Centralized LLM prompts, formatters, response schemas, and content-hashed version constants across the analyzing pipeline.
 *
 * Provides a single place to inspect, audit, and evolve prompts for:
 * - LLM Verifier candidate verification (llm-verifier.ts)
 * - Detection Eval judge fact-checking (detection-eval.ts)
 *
 * Provides deterministic content hashing and thinking budget configuration.
 */

import { computePromptContentHash } from '../llm-verifier.ts';

export const PROMPT_MODEL = 'gemini-3.8-flash';
export const JUDGE_THINKING_BUDGET = 2048;

export {
  computePromptContentHash,
  VERIFIER_THINKING_BUDGET,
  VERIFIER_SYSTEM_PROMPT,
  VERIFIER_RESPONSE_SCHEMA,
  VERIFIER_USER_PROMPT_TEMPLATE,
  type VerifierPromptFindingInput,
  type VerifierPromptRuleInput,
  formatVerifierPrompt,
  computeVerifierPromptVersion,
  VERIFIER_PROMPT_VERSION,
} from '../llm-verifier.ts';

export const JUDGE_SYSTEM_PROMPT = `You are an expert web platform modernization judge evaluating whether a static code finding is a legitimate instance of legacy web platform code that should be modernized according to a Modern Web Guidance guide.

The Modern Web Guidance mission is to identify old web patterns and brownfield library workarounds, and modernize them with standard web platform features to reduce dependencies and improve browser behavior.

Core Evaluation Principles:
- ASSUME MODERN PLATFORM SUPPORT: Target environments support the guide's modern web platform feature unless the code is inside an explicit feature-detection or fallback guard. Never reject a finding solely on browser support, runtime availability, or spec draft maturity.
- GUIDES OFTEN ONLY SHOW THE MODERN "AFTER" API: Many guides in this catalog focus solely on teaching the modern web platform solution and do not include an explicit "Before" section or list every legacy library/workaround. Do NOT require the legacy pattern to be explicitly mentioned or quoted in guide.md. Use both guide.md AND your general knowledge of web development history and the web ecosystem to recognize when the highlighted code is a real legacy workaround, pre-standard idiom, or third-party library pattern that the guide's modern feature replaces.
- INCREMENTAL DEPENDENCY REDUCTION IS A LEGIT MODERNIZE TARGET: Replacing a clean call site of an old library (moment, jQuery, etc.) is 'legit-modernize-target' even if other places in the file or app still use that library. Never vote 'loses-behavior' or 'no-payoff' just because the library is still imported or used elsewhere in the file.
- CROSS-LAYER (JS -> CSS/HTML) REPLACEMENTS TAUGHT BY THE GUIDE ARE LEGIT MODERNIZE TARGETS: A modernization does not need to be a 1-line token swap at a single AST node (e.g., replacing .fadeOut(300, () => el.remove()) with CSS @starting-style + getAnimations() is 'legit-modernize-target').
- STANDARDIZED NATIVE UI EQUIVALENTS ARE LEGIT MODERNIZE TARGETS: e.g., replacing ::-webkit-scrollbar-thumb { border-radius; :hover } with scrollbar-color / scrollbar-width is 'legit-modernize-target', NOT 'loses-behavior'. Only vote 'loses-behavior' on scrollbars when the CSS uses bespoke track/thumb art (linear-gradient, box-shadow, background images, multi-piece buttons) that scrollbar-color cannot represent.

Detective-then-Judge methodology:
1. \`matches_before_syntax\`: Does the highlighted code match an old workaround, pre-standard API, vendor-prefixed syntax, or library helper described or implied by the guide (including legacy libraries or workarounds that the guide's modern feature directly replaces)?
2. \`has_fallback_or_feature_guard\`: Is this code an intentional progressive-enhancement fallback (@supports not (...)), feature-detection guard, ponyfill, or polyfill?
3. \`modern_feature_applies_here\`: Does the modern web platform feature cover the capabilities needed at this call site without losing required behavior? (Always assume the modern feature is available).
4. \`has_meaningful_payoff\`: Does modernizing this site provide a real win (simplifying code, improving platform behavior, or incrementally reducing usage of a legacy library), rather than a zero-payoff syntax swap?
5. \`reasoning\`: Concise, objective reasoning explaining your factual analysis.
6. \`verdict\`: One of the following 7 values strictly aligned with the criteria below:
   - 'legit-modernize-target': Genuine legacy pattern where applying the guide is a clean win (the code matches the legacy/"Before" pattern or library workaround replaced by this guide, is not an intentional fallback, covers needed capabilities, and has meaningful payoff).
   - 'not-old-pattern': Matcher misfired — this code isn't even doing the legacy pattern the guide replaces (detector mistake / token collision).
   - 'fallback-or-guard': Intentional fallback, @supports check, feature guard, ponyfill, or polyfill.
   - 'loses-behavior': Old pattern, but modern feature lacks capabilities used here (non-1:1 library component migration, custom side effects, order-dependent geometry, incompatible API contract, or unsupported library feature).
   - 'no-payoff': Matches old syntax and modern feature applies, but rewriting here changes nothing meaningful (no-op syntax swap / zero-payoff syntax swap).
   - 'guide-wrong': The guide's advice is bad or overstates what the feature does for this case (the guide itself is wrong to call this pattern a problem).
   - 'unsure': Insufficient context in snippet/file to tell.`;

export const JUDGE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    matches_before_syntax: { type: 'BOOLEAN' },
    has_fallback_or_feature_guard: { type: 'BOOLEAN' },
    modern_feature_applies_here: { type: 'BOOLEAN' },
    has_meaningful_payoff: { type: 'BOOLEAN' },
    reasoning: { type: 'STRING' },
    verdict: {
      type: 'STRING',
      enum: [
        'legit-modernize-target',
        'not-old-pattern',
        'fallback-or-guard',
        'loses-behavior',
        'no-payoff',
        'guide-wrong',
        'unsure',
      ],
    },
  },
  required: [
    'matches_before_syntax',
    'has_fallback_or_feature_guard',
    'modern_feature_applies_here',
    'has_meaningful_payoff',
    'reasoning',
    'verdict',
  ],
};

export interface BlindCardGuideSummaryInput {
  readonly guideId?: string;
  readonly markdownBody?: string;
  readonly explainerContext?: string;
}

export interface BlindCardPromptInput {
  readonly cardId?: string;
  readonly file: string;
  readonly line: number;
  readonly guideId: string;
  readonly codeSnippet: string;
  readonly guideSummary: BlindCardGuideSummaryInput;
}

/**
 * Formats a blind card finding for unbiased evaluation by human raters and the Detection Eval Judge.
 */
export function formatBlindCardPrompt(card: BlindCardPromptInput): string {
  const markdownBody = card.guideSummary.markdownBody?.trim();
  if (!markdownBody) {
    throw new Error(
      `formatBlindCardPrompt failed: card ${card.cardId ?? 'unknown'} (guideId: "${card.guideId}") is missing required guideSummary.markdownBody. Failing fast.`,
    );
  }

  const explainerSection = card.guideSummary.explainerContext?.trim()
    ? `\n\n## Upstream Feature Explainer & Motivation Context (${card.guideId})\n${card.guideSummary.explainerContext.trim()}`
    : '';

  return `## Modern Web Guidance Guide (${card.guideId})
${markdownBody}${explainerSection}

## Code Location
- File: ${card.file}
- Line: ${card.line}

## Code Snippet
\`\`\`
${card.codeSnippet}
\`\`\``;
}

export function computeJudgePromptVersion(
  temperature = 0.2,
): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPromptTemplateSource: formatBlindCardPrompt.toString(),
    schema: JUDGE_RESPONSE_SCHEMA,
    thinkingBudget: JUDGE_THINKING_BUDGET,
    temperature,
    enableSearchGrounding: false,
  });
  return `${PROMPT_MODEL}:detective-v7-${hash}`;
}

export const JUDGE_VERSION = computeJudgePromptVersion();

