/**
 * Centralized LLM prompts, formatters, response schemas, and content-hashed version constants across the analyzing pipeline.
 *
 * Provides a single place to inspect, audit, and evolve prompts for:
 * - Gate 0 catalog triage (gate0.ts)
 * - Phase 2 candidate verification (phase2.ts)
 * - Evaluation judge fact-checking (judge.ts)
 * - Synthetic single-shot fix generation simulation (fix-harness.ts)
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
}): string {
  const payload = [
    params.model,
    params.systemPrompt,
    params.userPromptTemplateSource,
    JSON.stringify(params.schema),
    String(params.thinkingBudget),
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
   Guides often only show the modern "After" API. Use both guide.md AND your knowledge of the web ecosystem (legacy npm packages in package.json like select2/chosen-js, moment-timezone/getTimezoneOffset() for timezone math, legacy CSS workarounds like ::-webkit-scrollbar, vendor prefixes, or DOM attributes) to identify whether concrete old techniques exist.
   Boundary rule: If a guide's feature replaces a specific legacy API, CSS property/selector, DOM attribute, or npm package in package.json, classify as 'detectable' and list those in candidateTechniques.
2. 'ui-recipe-multi-part':
   The guide teaches how to combine multiple HTML/CSS/JS parts to build a general UI component, widget, or layout pattern where legacy implementations vary wildly and lack a specific legacy API, library, or single technique being replaced.
   Boundary rule: If the guide teaches an architectural composition with no specific legacy API or library replaced, classify as 'ui-recipe-multi-part'. If there are still plausible heuristic hooks to search for in code, list them in candidateTechniques and set borderline: true.
3. 'skip-no-old-way':
   The guide introduces a net-new web platform capability (e.g. WebGPU, WebNN, Passkeys, Prompt API, View Transitions between pages) with no direct legacy browser workaround to migrate from.
   The capability simply could not be implemented previously with a legacy browser API, standard polyfill, or direct CSS workaround.

Guidelines for classification:
- Read the entire guide markdown carefully, paying attention to the problem statement, code examples, and the underlying modern API.
- Do NOT require quoting a "Before" section from guide.md to classify a guide as 'detectable'. Guides frequently focus only on the modern solution. Use ecosystem knowledge to determine if common legacy workarounds, npm libraries, or idioms exist.
- Do NOT pre-judge whether downstream static rules will have false positives; that is evaluated during detection rule development and held-out scoring. Gate 0 only asks whether concrete legacy techniques exist.
- Identify all concrete legacy techniques in 'candidateTechniques' (array of strings, e.g. ["select2", "chosen-js", "custom dropdown wrapper"]).
- Set 'borderline' to true if the classification is ambiguous or on the boundary between buckets, false otherwise.
- Set 'brownfieldTarget' to a concise summary of candidateTechniques (e.g. candidateTechniques joined by "; "), or "none (multi-part UI recipe)" / "none (greenfield capability)".
- Set 'evidenceFromGuide' to evidence from the guide text or web ecosystem knowledge identifying the legacy pattern or lack thereof.
- Set 'reason' to a single crisp sentence explaining the classification decision.`;

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
  },
  required: [
    'classification',
    'candidateTechniques',
    'borderline',
    'brownfieldTarget',
    'evidenceFromGuide',
    'reason',
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
}

export function formatGate0Prompt(guide: Gate0PromptGuideInput): string {
  return `## Guide: ${guide.guideId} (Category: ${guide.category})

### Full Guide Markdown:
\`\`\`markdown
${guide.markdownContent}
\`\`\`

Analyze the entire guide markdown above and classify it into one of: 'detectable', 'ui-recipe-multi-part', or 'skip-no-old-way'.
Identify candidateTechniques (if any), borderline flag, brownfieldTarget, cite evidenceFromGuide (from the guide or web ecosystem knowledge), and provide a 1-sentence reason.`;
}

export function computeGate0PromptVersion(): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: GATE0_SYSTEM_PROMPT,
    userPromptTemplateSource: GATE0_USER_PROMPT_TEMPLATE,
    schema: GATE0_RESPONSE_SCHEMA,
    thinkingBudget: GATE0_THINKING_BUDGET,
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

export interface Phase2PromptFindingInput {
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly astSlice?: string;
  readonly codeSnippet?: string;
}

export interface Phase2PromptRuleInput {
  readonly id: string;
  readonly guideId?: string;
  readonly summary: string;
  readonly phase2Rubric: {
    readonly keepWhen: readonly string[];
    readonly dropWhen: readonly string[];
  };
}

export function formatPhase2Prompt(
  finding: Phase2PromptFindingInput,
  rule: Phase2PromptRuleInput,
  guideMarkdown?: string,
): string {
  const keepList = rule.phase2Rubric.keepWhen.map((item) => `- ${item}`).join('\n');
  const dropList = rule.phase2Rubric.dropWhen.map((item) => `- ${item}`).join('\n');
  const contextSnippet = (finding.astSlice || finding.codeSnippet || '').trim();

  let guideSection = '';
  if (guideMarkdown && guideMarkdown.trim()) {
    guideSection = `## Modern Web Guidance Guide (${rule.guideId || rule.id})\n\`\`\`markdown\n${guideMarkdown.trim()}\n\`\`\`\n\n`;
  }

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
    userPromptTemplateSource: PHASE2_USER_PROMPT_TEMPLATE,
    schema: PHASE2_RESPONSE_SCHEMA,
    thinkingBudget: PHASE2_THINKING_BUDGET,
  });
  return `${PROMPT_MODEL}:phase2-v2-guide-${hash}`;
}

export const PHASE2_PROMPT_VERSION = computePhase2PromptVersion();

// ============================================================================
// 3. Evaluation Judge (R29, R31)
// ============================================================================

export const JUDGE_SYSTEM_PROMPT = `You are an expert web platform modernization judge evaluating whether a static code finding is a legitimate instance of legacy web platform code that should be modernized according to a Modern Web Guidance guide.

The Modern Web Guidance mission is to identify old web patterns and brownfield library workarounds, and modernize them with standard web platform features to reduce dependencies and improve browser behavior.

You must follow the Detective-then-Judge methodology:
First extract structured facts:
1. \`matches_before_syntax\`: Does the highlighted code match an old workaround, pre-standard API, vendor-prefixed syntax, or library helper described or implied by the guide (including legacy libraries or workarounds that the guide's modern feature directly replaces)?
2. \`has_fallback_or_feature_guard\`: Is this code protected by a feature guard (e.g. checking for modern API support, fallback branch, ponyfill, or polyfill)?
3. \`modern_feature_applies_here\`: Does the modern web platform replacement apply here to modernize this code or eliminate the legacy workaround?
4. \`reasoning\`: Concise, objective reasoning explaining your factual analysis.
5. \`verdict\`: One of the following 5 values strictly aligned with the criteria below:
   - 'right': The code really is the legacy/"Before" pattern (or legacy library/workaround replaced by this guide), is not an intentional fallback, and the guide's modern way makes sense here.
   - 'not-old-pattern': The code isn't doing the legacy thing at all (detector mistake / token collision).
   - 'leave-it': It IS the old pattern, but it should stay: either a deliberate fallback/feature-guard/polyfill, non-browser code, OR the guide's modern replacement wouldn't work for this specific use case.
   - 'guide-wrong': The guide itself is wrong to call this pattern a problem.
   - 'unsure': Insufficient context to determine.`;

export const JUDGE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    matches_before_syntax: { type: 'BOOLEAN' },
    has_fallback_or_feature_guard: { type: 'BOOLEAN' },
    modern_feature_applies_here: { type: 'BOOLEAN' },
    reasoning: { type: 'STRING' },
    verdict: {
      type: 'STRING',
      enum: ['right', 'not-old-pattern', 'leave-it', 'guide-wrong', 'unsure'],
    },
  },
  required: [
    'matches_before_syntax',
    'has_fallback_or_feature_guard',
    'modern_feature_applies_here',
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
  readonly phase2Rubric?: unknown;
  readonly problem?: string;
  readonly before?: string;
  readonly now?: string;
  readonly ruleSummary?: string;
}

export interface BlindCardPromptInput {
  readonly cardId?: string;
  readonly file: string;
  readonly line: number;
  readonly guideId: string;
  readonly codeSnippet: string;
  readonly guideSummary: BlindCardGuideSummaryInput;
}

export function formatBlindCardPrompt(card: BlindCardPromptInput): string {
  const markdownBody = card.guideSummary.markdownBody?.trim();
  if (!markdownBody) {
    throw new Error(
      `formatBlindCardPrompt failed: card ${card.cardId ?? 'unknown'} (guideId: "${card.guideId}") is missing required guideSummary.markdownBody. Failing fast per R29.`,
    );
  }

  return `## Modern Web Guidance Guide (${card.guideId})
${markdownBody}

## Code Location
- File: ${card.file}
- Line: ${card.line}

## Code Snippet
\`\`\`
${card.codeSnippet}
\`\`\``;
}

export function computeJudgePromptVersion(): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPromptTemplateSource: JUDGE_USER_PROMPT_TEMPLATE,
    schema: JUDGE_RESPONSE_SCHEMA,
    thinkingBudget: JUDGE_THINKING_BUDGET,
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
- Eliminate EVERY instance of the flagged legacy pattern within this code window.
- Explicitly include the modern platform API/property from the guide directly in your patchedWindow.
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
- Eliminate EVERY instance of the flagged legacy pattern within this code window.
- Explicitly include the modern platform API/property from the guide directly in your patchedWindow.
- If this finding is a false positive or intentional fallback that should be kept, return the original window unchanged in patchedWindow.`;
}

export function computeSyntheticFixPromptVersion(): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: SYNTHETIC_FIX_SIMULATION_PROMPT,
    userPromptTemplateSource: FIX_USER_PROMPT_TEMPLATE,
    schema: FIX_RESPONSE_SCHEMA,
    thinkingBudget: FIX_SIMULATION_THINKING_BUDGET,
  });
  return `${PROMPT_MODEL}:fix-sim-v2-${hash}`;
}

export const SYNTHETIC_FIX_PROMPT_VERSION = computeSyntheticFixPromptVersion();
