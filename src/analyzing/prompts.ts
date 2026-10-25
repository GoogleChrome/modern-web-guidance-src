/**
 * Centralized LLM prompts, formatters, response schemas, and content-hashed version constants across the analyzing pipeline.
 *
 * Provides a single place to inspect, audit, and evolve prompts for:
 * - Guide Triage (guide-triage.ts)
 * - LLM Verifier candidate verification (llm-verifier.ts)
 * - Detection Eval judge fact-checking (detection-eval.ts)
 * - Synthetic single-shot update generation simulation (update-eval.ts)
 *
 * Implements R27, R28, R29, R30, and R31 with deterministic content hashing and thinking budget configuration.
 */

import { createHash } from 'node:crypto';

export const PROMPT_MODEL = 'gemini-3.8-flash';
export const GATE0_THINKING_BUDGET = 2048;
export const PHASE2_THINKING_BUDGET = 1024;
export const JUDGE_THINKING_BUDGET = 2048;
export const FIX_SIMULATION_THINKING_BUDGET = 1024;

/**
 * Computes a deterministic 8-character SHA-256 hash across prompt model, system prompt,
 * user prompt template source, response schema, and thinking budget per R31.
 */
export function computePromptContentHash(params: {
  readonly model: string;
  readonly systemPrompt: string;
  readonly userPromptTemplateSource: string;
  readonly schema: unknown;
  readonly thinkingBudget: number;
  readonly temperature?: number;
  readonly enableSearchGrounding?: boolean;
}): string {
  const payload = [
    params.model,
    params.systemPrompt,
    params.userPromptTemplateSource,
    JSON.stringify(params.schema),
    String(params.thinkingBudget),
    String(params.temperature ?? 0.0),
    String(params.enableSearchGrounding ?? false),
  ].join('\n---\n');
  return createHash('sha256').update(payload).digest('hex').slice(0, 8);
}

// ============================================================================
// 1. Gate 0 Catalog Triage (R27, R31)
// ============================================================================

export const GATE0_SYSTEM_PROMPT = `You are an expert static analysis triage classifier for the Modern Web Guidance catalog.
Your task is to classify whether a published feature guide has a statically detectable brownfield target.

You must classify the guide into exactly one of three Gate 0 buckets:
1. 'detectable':
   The guide replaces one or more concrete, identifiable legacy browser APIs, CSS property/selector workarounds, DOM markup patterns, or third-party npm packages in brownfield code.
   Use guide.md AND the provided Upstream Explainer & Motivation Context (which states the problem the spec was created to solve and what developers did before it existed) to classify the guide.
   Boundary rule: If a guide's feature replaces a specific legacy API, CSS property/selector, DOM attribute, or npm package in package.json, classify as 'detectable' and list those in candidateTechniques.
   If a guide teaches a modern HTML/CSS/JS feature that directly replaces imperative JS boilerplate or legacy library triggers (e.g. declarative HTML attributes replacing imperative open/close listeners, or native HTML form attributes replacing missing/manual autofill wiring), classify as 'detectable'.
   Guard against ungrounded over-calling: Do NOT classify a guide as 'detectable' merely because you can invent a hypothetical or tangential workaround from general knowledge. To classify as 'detectable', there must be a concrete, recognizable legacy API, CSS property/selector workaround, DOM attribute/pattern, or specific third-party npm library that developers actually used for this exact problem (supported by guide.md, the Explainer's motivation/prior-art, or established ecosystem usage).
2. 'ui-recipe-multi-part':
   The guide teaches how to combine multiple HTML/CSS/JS parts to build a general UI component, widget, or layout pattern where legacy implementations vary wildly and lack a specific legacy API, library, or single technique being replaced.
   Boundary rule: If the guide teaches an architectural composition with no specific legacy API or library replaced, classify as 'ui-recipe-multi-part'. If there are still plausible heuristic hooks to search for in code, list them in candidateTechniques and set borderline: true.
3. 'skip-no-old-way':
   The guide introduces a net-new web platform capability (e.g. WebGPU, WebNN, Passkeys, Prompt API, View Transitions between pages) with no direct legacy browser workaround to migrate from.
   If a guide introduces a capability that was not previously achievable in client-side code (or where the explainer states it was not possible before), classify as 'skip-no-old-way'.

Guidelines for classification:
- Read the entire guide markdown carefully, paying attention to the problem statement, code examples, and the underlying modern API.
- Also inspect the Upstream Explainer & Motivation Context if provided.
- Do NOT require quoting a "Before" section from guide.md to classify a guide as 'detectable'. Guides frequently focus only on the modern solution. Use ecosystem knowledge and explainer context to determine if common legacy workarounds, npm libraries, or idioms exist.
- 1-to-1 Viability Check and Scope Boundaries for 'detectable':
  1. True 1-to-1 Functional Replacement (replaces vs. doesNotReplace): The guide's modern feature must directly replace the legacy pattern 1-to-1. Both single-purpose npm micro-libraries (e.g. 'autosize', 'fitty', 'humanize-duration') and broader libraries whose common/basic use case is replaced by the modern feature (e.g. 'select2' / 'choices.js' for custom-styled selects, '@floating-ui/dom' / '@popperjs/core' for dropdown/menu positioning) belong in 'replaces' and 'candidateTechniques'. Any unsupported advanced library capabilities that the modern feature does NOT replace (such as remote 'ajax:' search, multi-select tag comboboxes, canvas zoom/pan transforms, or DOM-to-PDF screenshot rendering) must be listed in 'doesNotReplace', NEVER in 'replaces' or 'candidateTechniques'.
  2. Idiomatic Pattern Isolation vs. Bare General-Purpose APIs: Do NOT discard valid legacy idioms that utilize general-purpose APIs. Specific legacy idioms like ResizeObserver callbacks toggling responsive breakpoint classes (before @container), IntersectionObserver callbacks toggling active nav/marker classes, scroll event listeners reading scrollY for progress indicators, or mutable Date math (before Temporal) ARE valid legacy targets: specify the exact idiom in 'replaces' and list non-legacy uses of that API (e.g. resizing a <canvas> pixel buffer, virtual scrolling, lazy-loading images, or epoch timestamp math) in 'doesNotReplace'.
  3. Comprehensive Pattern Listing: List all concrete legacy techniques in 'replaces' and 'candidateTechniques'. Empirical wild prevalence is evaluated downstream via GitMirror queries rather than pre-judged at triage.
- Identify all concrete legacy techniques in 'candidateTechniques' (array of strings, e.g. ["legacy-library-name", "custom wrapper"]).
- Set 'borderline' to true if the classification is ambiguous or on the boundary between buckets, false otherwise.
- Set 'brownfieldTarget' to a concise summary of candidateTechniques (e.g. candidateTechniques joined by "; "), or "none (multi-part UI recipe)" / "none (greenfield capability)".
- Set 'evidenceFromGuide' to evidence from the guide text, explainer context, or web ecosystem knowledge identifying the legacy pattern or lack thereof.
- Set 'reason' to a single crisp sentence explaining the classification decision.
- Set 'evidenceSource' to 'guide', 'explainer', 'search', 'ecosystem-knowledge', or 'none' indicating which primary source justified your classification.`;

export const GATE0_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    classification: {
      type: 'STRING',
      enum: ['detectable', 'ui-recipe-multi-part', 'skip-no-old-way'],
    },
    candidateTechniques: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'List of specific legacy techniques, npm libraries, JS idioms, CSS properties/selectors, or DOM patterns replaced by the guide. Empty array if none.',
    },
    replaces: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Specific 1-to-1 legacy techniques, libraries, or workarounds directly replaced by the modern feature.',
    },
    doesNotReplace: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Adjacent or non-1-to-1 techniques, libraries, or capabilities that the modern feature does NOT replace.',
    },
    borderline: {
      type: 'BOOLEAN',
      description: 'True if the classification is borderline or ambiguous, false if clear-cut.',
    },
    brownfieldTarget: {
      type: 'STRING',
      description: 'Summary of the legacy target, candidate techniques joined, or none.',
    },
    evidenceFromGuide: {
      type: 'STRING',
      description: 'Evidence from the guide text or web ecosystem knowledge identifying the legacy pattern or lack thereof.',
    },
    reason: {
      type: 'STRING',
      description: 'A crisp explanation of the classification decision.',
    },
    evidenceSource: {
      type: 'STRING',
      enum: ['guide', 'explainer', 'search', 'ecosystem-knowledge', 'none'],
      description: 'Primary source of evidence that justified the classification.',
    },
  },
  required: [
    'classification',
    'candidateTechniques',
    'borderline',
    'brownfieldTarget',
    'evidenceFromGuide',
    'reason',
    'evidenceSource',
  ],
};

export const GATE0_USER_PROMPT_TEMPLATE = `## Guide: \${guide.guideId} (Category: \${guide.category})

### Full Guide Markdown:
\`\`\`markdown
\${guide.markdownContent}
\`\`\`

Analyze the entire guide markdown above and classify it into one of: 'detectable', 'ui-recipe-multi-part', or 'skip-no-old-way'.
Identify candidateTechniques (if any), borderline flag, brownfieldTarget, cite evidenceFromGuide (from the guide or web ecosystem knowledge), and provide a 1-sentence reason.`;

export interface Gate0PromptGuideInput {
  readonly guideId: string;
  readonly category: string;
  readonly markdownContent: string;
  readonly guideHash?: string;
  readonly explainerContext?: string;
}

export function formatGate0Prompt(guide: Gate0PromptGuideInput): string {
  const explainerSection =
    guide.explainerContext && guide.explainerContext.trim().length > 0
      ? `\n\n### Upstream W3C / TC39 / ChromeStatus Explainer & Motivation Context:\n${guide.explainerContext.trim()}`
      : '';

  return `## Guide: ${guide.guideId} (Category: ${guide.category})

### Full Guide Markdown:
\`\`\`markdown
${guide.markdownContent}
\`\`\`${explainerSection}

Analyze the entire guide markdown above and classify it into one of: 'detectable', 'ui-recipe-multi-part', or 'skip-no-old-way'.
Identify candidateTechniques (if any), borderline flag, brownfieldTarget, cite evidenceFromGuide (from the guide, explainer, or web ecosystem knowledge), select evidenceSource, and provide a 1-sentence reason.`;
}

export function computeGate0PromptVersion(
  temperature = 0.0,
  enableSearchGrounding = true,
): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: GATE0_SYSTEM_PROMPT,
    userPromptTemplateSource: formatGate0Prompt.toString(),
    schema: GATE0_RESPONSE_SCHEMA,
    thinkingBudget: GATE0_THINKING_BUDGET,
    temperature,
    enableSearchGrounding,
  });
  return `${PROMPT_MODEL}:gate0-v2-${hash}`;
}

export const GATE0_PROMPT_VERSION = computeGate0PromptVersion();

// ============================================================================
// 2. Phase 2 Verification (R28, R31)
// ============================================================================

export const PHASE2_SYSTEM_PROMPT = `You are an expert static analysis Phase 2 verifier for Modern Web Guidance.
Your task is to verify whether candidate static analysis matches from Phase 1 represent genuine targets for web platform modernization according to the rule's summary, Phase 2 rubric, and the accompanying guide.md, or whether they should be dropped as false positives.

Follow these verification principles:
1. Examine the AST slice and surrounding context carefully alongside the full guide.md markdown.
2. Check against the rule's keepWhen criteria: if the code implements an old workaround or library pattern that should be modernized with standard web platform features taught in guide.md, mark keep = true.
3. Check against the rule's dropWhen criteria: if the match is a false positive (e.g. non-DOM domain such as audio/canvas/gaming when checking DOM, unrelated business logic, or code already protected by modern feature detection guards), mark keep = false.
4. DEFAULT TO KEEP: When unsure, KEEP the finding (keep = true). Only drop (keep = false) when a dropWhen item or the guide's scope in guide.md clearly rules it out.
5. Output concise, objective reasoning explaining why this finding should be kept or dropped.
6. Provide your confidence level ('high', 'medium', or 'low').`;

export const PHASE2_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    keep: { type: 'BOOLEAN' },
    reason: { type: 'STRING' },
    confidence: {
      type: 'STRING',
      enum: ['high', 'medium', 'low'],
    },
  },
  required: ['keep', 'reason', 'confidence'],
};

export const PHASE2_USER_PROMPT_TEMPLATE = `## Modern Web Guidance Guide (\${rule.guideId})
\`\`\`markdown
\${guideMarkdown}
\`\`\`

## Rule: \${rule.id}
Summary: \${rule.summary}

### Keep When:
\${keepList}

### Drop When:
\${dropList}

## Finding Location
- File: \${finding.file}
- Line: \${finding.line}
- Matcher Message: \${finding.message}

## Code Context (AST Slice)
\`\`\`
\${contextSnippet}
\`\`\``;

export interface VerifierPromptFindingInput {
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly contextSlice?: string;
  readonly codeSnippet?: string;
}

export type Phase2PromptFindingInput = VerifierPromptFindingInput;

export interface VerifierPromptRuleInput {
  readonly id: string;
  readonly guideId?: string;
  readonly summary: string;
  readonly verifierRubric: {
    readonly keepWhen: readonly string[];
    readonly dropWhen: readonly string[];
  };
}

export type Phase2PromptRuleInput = VerifierPromptRuleInput;

export function formatVerifierPrompt(
  finding: VerifierPromptFindingInput,
  rule: VerifierPromptRuleInput,
  guideMarkdown?: string,
): string {
  const keepList = rule.verifierRubric.keepWhen.map((item) => `- ${item}`).join('\n');
  const dropList = rule.verifierRubric.dropWhen.map((item) => `- ${item}`).join('\n');
  const contextSnippet = (finding.contextSlice || finding.codeSnippet || '').trim();

  if (!guideMarkdown || !guideMarkdown.trim()) {
    throw new Error(
      `formatVerifierPrompt failed: guideMarkdown is required for rule ${rule.id} (guide ${rule.guideId ?? rule.id}). Failing fast per R28/O55a.`,
    );
  }

  const guideSection = `## Modern Web Guidance Guide (${rule.guideId || rule.id})\n\`\`\`markdown\n${guideMarkdown.trim()}\n\`\`\`\n\n`;

  return `${guideSection}## Rule: ${rule.id}
Summary: ${rule.summary}

### Keep When:
${keepList}

### Drop When:
${dropList}

## Finding Location
- File: ${finding.file}
- Line: ${finding.line}
- Matcher Message: ${finding.message}

## Code Context (AST Slice)
\`\`\`
${contextSnippet}
\`\`\``;
}

export function computePhase2PromptVersion(): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: PHASE2_SYSTEM_PROMPT,
    userPromptTemplateSource: formatVerifierPrompt.toString(),
    schema: PHASE2_RESPONSE_SCHEMA,
    thinkingBudget: PHASE2_THINKING_BUDGET,
    temperature: 0.0,
    enableSearchGrounding: false,
  });
  return `${PROMPT_MODEL}:phase2-v2-guide-${hash}`;
}

export const PHASE2_PROMPT_VERSION = computePhase2PromptVersion();
export const VERIFIER_PROMPT_VERSION = PHASE2_PROMPT_VERSION;
export const formatPhase2Prompt = formatVerifierPrompt;
export const buildVerifierPrompt = formatVerifierPrompt;
export const buildPhase2Prompt = formatVerifierPrompt;
export const VERIFIER_SYSTEM_PROMPT = PHASE2_SYSTEM_PROMPT;
export const VERIFIER_RESPONSE_SCHEMA = PHASE2_RESPONSE_SCHEMA;
export const VERIFIER_THINKING_BUDGET = PHASE2_THINKING_BUDGET;

// ============================================================================
// 3. Evaluation Judge (R29, R31)
// ============================================================================

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

export const JUDGE_USER_PROMPT_TEMPLATE = `## Modern Web Guidance Guide (\${card.guideId})
\${card.guideSummary.markdownBody}

## Code Location
- File: \${card.file}
- Line: \${card.line}

## Code Snippet
\`\`\`
\${card.codeSnippet}
\`\`\``;

export interface BlindCardGuideSummaryInput {
  readonly guideId?: string;
  readonly markdownBody?: string;
  readonly summary?: string;
  readonly verifierRubric?: unknown;
  readonly problem?: string;
  readonly before?: string;
  readonly now?: string;
  readonly ruleSummary?: string;
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
      `formatBlindCardPrompt failed: card ${card.cardId ?? 'unknown'} (guideId: "${card.guideId}") is missing required guideSummary.markdownBody. Failing fast per R29.`,
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
  return `${PROMPT_MODEL}:detective-v6-spec22-${hash}`;
}

export const JUDGE_VERSION = computeJudgePromptVersion();

// ============================================================================
// 4. Synthetic Fix Simulation (R30, R31)
// ============================================================================

export const SYNTHETIC_FIX_SIMULATION_PROMPT = `You are an expert web platform modernization engineer.
Your task is to refactor a legacy web pattern in a brownfield codebase using the standard modern web platform capability prescribed in the provided Modern Web Guide.

Guidelines:
1. Refactor the legacy pattern: Replace the flagged legacy workaround with the modern web platform feature taught in the guide.
2. Preserve user-visible behavior: Keep behavior the same for users (what they see, hear, and interact with). Do not delete or hollow out surrounding functions, handlers, classes, elements, or unrelated styles. Maintain existing names, exported signatures, and application structure.
3. Feature detection and fallbacks: If the guide indicates that modern browser support requires a feature check or progressive enhancement, add an appropriate feature guard.
4. Allow no change: If the finding is a false positive (not actually the legacy pattern) or already serves as a deliberate fallback/polyfill that should be retained, make no changes: return the original code window completely unchanged in "patchedWindow" and explain why in "explanation".
5. Output format: In "patchedWindow", provide the complete replacement text for the code window with valid syntax and no placeholders. In "explanation", provide a concise summary of the change or why no change was needed.`;

export const FIX_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    patchedWindow: {
      type: 'STRING',
      description:
        'The complete replacement text for the provided code window, incorporating the modern web platform feature and preserving surrounding application logic. If no change is warranted, return the original window unchanged.',
    },
    explanation: {
      type: 'STRING',
      description: 'Concise explanation of the modernization change or reason for no change.',
    },
  },
  required: ['patchedWindow', 'explanation'],
};

export const FIX_AGENT_SCHEMA = FIX_RESPONSE_SCHEMA;

export const FIX_USER_PROMPT_TEMPLATE = `## Modern Web Guide: \${params.guideId}
\${params.guideMarkdown}

## Analyzer Finding
- File: \${params.filePath}
- Line: \${params.line}
- Message: \${params.findingMessage}

## Target Code Window
\`\`\`
\${params.windowText}
\`\`\`

Refactor the code window to replace the legacy workaround with the modern web platform feature taught in the guide while preserving all surrounding application logic.
Important:
- If this finding is a false positive or intentional fallback that should be kept, return the original window unchanged in patchedWindow.`;

export interface FixSimulationPromptParams {
  readonly guideId: string;
  readonly guideMarkdown: string;
  readonly filePath: string;
  readonly line: number;
  readonly findingMessage: string;
  readonly windowText: string;
}

export function formatFixSimulationPrompt(params: FixSimulationPromptParams): string {
  return `## Modern Web Guide: ${params.guideId}
${params.guideMarkdown}

## Analyzer Finding
- File: ${params.filePath}
- Line: ${params.line}
- Message: ${params.findingMessage}

## Target Code Window
\`\`\`
${params.windowText}
\`\`\`

Refactor the code window to replace the legacy workaround with the modern web platform feature taught in the guide while preserving all surrounding application logic.
Important:
- If this finding is a false positive or intentional fallback that should be kept, return the original window unchanged in patchedWindow.`;
}

export function computeSyntheticFixPromptVersion(): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: SYNTHETIC_FIX_SIMULATION_PROMPT,
    userPromptTemplateSource: formatFixSimulationPrompt.toString(),
    schema: FIX_RESPONSE_SCHEMA,
    thinkingBudget: FIX_SIMULATION_THINKING_BUDGET,
    temperature: 0.0,
    enableSearchGrounding: false,
  });
  return `${PROMPT_MODEL}:fix-sim-v2-${hash}`;
}

export const SYNTHETIC_FIX_PROMPT_VERSION = computeSyntheticFixPromptVersion();
