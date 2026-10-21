import {
  type BlindCardPayload,
  type CanaryCard,
  type CanaryCheckResult,
  checkCanaries,
  type DetectiveFactCheck,
  deriveJudgeVerdictFromFacts,
  evaluateJudgeMetrics,
  evaluateJudgeStability,
  type GuideSummaryInfo,
  isDetectiveFactCheck,
  isJudgeVerdict,
  JUDGE_MODEL,
  type JudgeEvaluationMetrics,
  type JudgeResult,
  type JudgeRunOptions,
  type JudgeVerdict,
  loadHumanGrades,
  parseJudgeJsonContent,
  runJudgeBatch,
  runJudgeDirect,
  type StabilityEvaluationResult,
  VALID_VERDICTS,
} from './judge.ts';
import {
  computePromptContentHash,
  formatBlindCardPrompt,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_THINKING_BUDGET,
  PROMPT_MODEL,
} from './prompts.ts';

export type {
  BlindCardPayload,
  CanaryCard,
  CanaryCheckResult,
  DetectiveFactCheck,
  GuideSummaryInfo,
  JudgeEvaluationMetrics,
  JudgeResult,
  JudgeRunOptions,
  JudgeVerdict,
  StabilityEvaluationResult,
};

export {
  checkCanaries,
  deriveJudgeVerdictFromFacts,
  evaluateJudgeMetrics,
  evaluateJudgeStability,
  formatBlindCardPrompt,
  isDetectiveFactCheck,
  isJudgeVerdict,
  JUDGE_MODEL,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_THINKING_BUDGET,
  loadHumanGrades,
  parseJudgeJsonContent,
  runJudgeBatch,
  runJudgeDirect,
  VALID_VERDICTS,
};

/**
 * Synchronized LLM judge system prompt (R45) with explicit verdict definitions
 * covering no-op syntax swaps, non-1:1 library migrations, custom side effects,
 * order-dependent geometry, and incompatible API contracts under `"leave-it"`.
 */
export const JUDGE_SYSTEM_PROMPT = `You are an expert web platform modernization judge evaluating whether a static code finding is a legitimate instance of legacy web platform code that should be modernized according to a Modern Web Guidance guide.

The Modern Web Guidance mission is to identify old web patterns and brownfield library workarounds, and modernize them with standard web platform features to reduce dependencies and improve browser behavior.

Core Evaluation Principles:
- ASSUME MODERN PLATFORM SUPPORT: Target environments support the guide's modern web platform feature unless the code is inside an explicit feature-detection or fallback guard. Never reject a finding solely on browser support, runtime availability, or spec draft maturity.
- GUIDES OFTEN ONLY SHOW THE MODERN "AFTER" API: Many guides in this catalog focus solely on teaching the modern web platform solution and do not include an explicit "Before" section or list every legacy library/workaround. Do NOT require the legacy pattern to be explicitly mentioned or quoted in guide.md. Use both guide.md AND your general knowledge of web development history and the web ecosystem to recognize when the highlighted code is a real legacy workaround, pre-standard idiom, or third-party library pattern that the guide's modern feature replaces.

Detective-then-Judge methodology:
1. \`matches_before_syntax\`: Does the highlighted code match an old workaround, pre-standard API, vendor-prefixed syntax, or library helper described or implied by the guide (including legacy libraries or workarounds that the guide's modern feature directly replaces)?
2. \`has_fallback_or_feature_guard\`: Is this code protected by a feature guard (e.g. checking for modern API support, fallback branch, ponyfill, or polyfill)?
3. \`modern_feature_applies_here\`: Does the modern web platform replacement apply here to modernize this code or eliminate the legacy workaround? (Always assume the modern feature is available).
4. \`reasoning\`: Concise, objective reasoning explaining your factual analysis.
5. \`verdict\`: One of the following 5 values strictly aligned with the criteria below:
   - "right": Genuine legacy pattern where applying the guide is a clean win.
   - "not-old-pattern": Matcher misfired — this code isn't even doing the legacy pattern the guide replaces.
   - "leave-it": Matches the old syntax and the guide is right in general, BUT the code here should be left alone — either because rewriting at this site changes nothing for the developer (no-op syntax swap), or because the code here is doing something extra (non-1:1 library component migration, custom side effects, order-dependent geometry, or incompatible API contract) that the modern feature does not cover.
   - "guide-wrong": The guide's advice is bad or overstates what the feature does for this case.
   - "unsure": Insufficient context to determine.`;

/**
 * Compute a deterministic content-hashed judge prompt version string for the R45 judge prompt.
 */
export function computeJudgePromptVersion(temperature = 0.2): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPromptTemplateSource: formatBlindCardPrompt.toString(),
    schema: JUDGE_RESPONSE_SCHEMA,
    thinkingBudget: JUDGE_THINKING_BUDGET,
    temperature,
    enableSearchGrounding: false,
  });
  return `${PROMPT_MODEL}:detective-v7-r45-${hash}`;
}

export const computeJudgeVersion = computeJudgePromptVersion;
export const JUDGE_VERSION = computeJudgePromptVersion();

/**
 * Construct a Gemini `generateContent` request body using the R45 `JUDGE_SYSTEM_PROMPT`.
 */
export function buildGeminiRequestBody(
  card: BlindCardPayload,
  temperature = 0.2,
): Record<string, unknown> {
  return {
    systemInstruction: {
      parts: [{ text: JUDGE_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: formatBlindCardPrompt(card) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: JUDGE_RESPONSE_SCHEMA,
      temperature,
      thinkingConfig: { thinkingBudget: JUDGE_THINKING_BUDGET },
    },
  };
}
