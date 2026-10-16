/**
 * Centralized LLM prompts and prompt version constants across the analyzing pipeline.
 *
 * Provides a single place to inspect, audit, and evolve prompts for:
 * - Gate 0 catalog triage (gate0.ts)
 * - Phase 2 candidate verification (phase2.ts)
 * - Evaluation judge fact-checking (judge.ts)
 * - Synthetic single-shot fix generation simulation (fix-harness.ts)
 */

export const GATE0_PROMPT_VERSION = 'gate0-v1-full-guide';

export const GATE0_SYSTEM_PROMPT = `You are an expert static analysis triage classifier for the Modern Web Guidance catalog.
Your task is to classify whether a published feature guide has a statically detectable brownfield target (Decision D-005).

You must classify the guide into exactly one of three Gate 0 buckets:
1. 'detectable':
   The guide replaces a concrete, statically identifiable legacy browser API, CSS property/selector workaround, DOM markup pattern, or third-party package in brownfield code.
   Examples: replacing moment-timezone with Temporal, replacing manual event listening for scroll-end with scrollend event, replacing float/table clearing or max-height accordion hacks with modern CSS, replacing custom modal overlay div with <dialog>, replacing input missing autocomplete with autocomplete="...".
2. 'ui-recipe-multi-part':
   The guide teaches a multi-element UI component or architectural recipe (e.g. carousel, tabs, navigation drawer) where legacy implementations vary wildly and lack a single high-precision static code hook.
   Finding these statically without massive false positives is unviable for a single static rule.
3. 'skip-no-old-way':
   The guide introduces a net-new web platform capability (e.g. WebGPU, WebNN, Passkeys, Prompt API, View Transitions between pages) with no direct legacy browser workaround to migrate from.
   The capability simply could not be implemented previously with a legacy browser API, standard polyfill, or direct CSS workaround.

Guidelines for classification:
- Read the entire guide markdown carefully, paying special attention to the problem statement, "Before" / legacy code examples, and the underlying modern API.
- If the guide explicitly shows a "Before" code pattern or mentions legacy libraries/workarounds (e.g., polyfills, microtask hacks, custom implementations) that are distinct and statically flaggable, classify as 'detectable'.
- If the guide describes a complex multi-element UI design pattern or component without a unified legacy API or CSS property to target, classify as 'ui-recipe-multi-part'.
- If the guide describes a new capability that has no direct legacy counterpart, classify as 'skip-no-old-way'.
- Set 'brownfieldTarget' to:
  * For 'detectable': The specific legacy API/CSS/DOM/package pattern being replaced (e.g. "moment / date-fns timezone conversions", "manual scroll event debounce for scroll-end", "<div role='dialog'> with custom backdrop").
  * For 'ui-recipe-multi-part': "none (multi-part UI recipe)"
  * For 'skip-no-old-way': "none (greenfield capability)"
- Set 'evidenceFromGuide' to:
  * A direct quote or concise specific summary of the "Before" / legacy workaround section from the guide text, or confirmation that the guide contains no legacy code replacement.
- Set 'reason' to a single crisp sentence explaining the classification decision.`;

export const PHASE2_PROMPT_VERSION = 'phase2-v1-rubric-verifier';

export const PHASE2_SYSTEM_PROMPT = `You are an expert static analysis Phase 2 verifier for Modern Web Guidance.
Your task is to verify whether candidate static analysis matches from Phase 1 represent genuine targets for web platform modernization according to the rule's summary and Phase 2 rubric, or whether they should be dropped as false positives.

Follow these verification principles:
1. Examine the AST slice and surrounding context carefully.
2. Check against the rule's keepWhen criteria: if the code implements an old workaround or library pattern that should be modernized with standard web platform features, mark keep = true.
3. Check against the rule's dropWhen criteria: if the match is a false positive (e.g. non-DOM domain such as audio/canvas/gaming when checking DOM, unrelated business logic, or code already protected by modern feature detection guards), mark keep = false.
4. Output concise, objective reasoning explaining why this finding should be kept or dropped.
5. Provide your confidence level ('high', 'medium', or 'low').`;

export const JUDGE_VERSION = 'gemini-3.8-flash:detective-v5-pure-guide';

export const JUDGE_SYSTEM_PROMPT = `You are an expert web platform modernization judge evaluating whether a static code finding is a legitimate instance of legacy web platform code that should be modernized according to a Modern Web Guidance guide.

The Modern Web Guidance mission is to identify old web patterns and brownfield library workarounds (e.g. jQuery animations, vendor-prefixed properties like ::-webkit-scrollbar, <script type="text/template">, CSS sibling combinator hacks like ~/+ simulating :has(), manual Date timestamp math), and modernize them with standard web platform features to reduce dependencies and improve browser behavior.

You must follow the Detective-then-Judge methodology:
First extract structured facts:
1. \`matches_before_syntax\`: Does the highlighted code match an old workaround, pre-standard API, vendor-prefixed syntax, or library helper targeted by the guide's brownfield rubric?
2. \`has_fallback_or_feature_guard\`: Is this code protected by a feature guard (e.g. checking for modern API support, fallback branch, ponyfill, or polyfill)?
3. \`modern_feature_applies_here\`: Does the modern web platform replacement apply here to modernize this code or eliminate the legacy workaround?
4. \`reasoning\`: Concise, objective reasoning explaining your factual analysis.
5. \`verdict\`: One of the following 5 values:
   - 'right': Legitimate finding. The code matches the legacy workaround/pattern, is not an intentional fallback, and the modern feature applies.
   - 'not-old-pattern': False positive. The code does NOT match the old workaround (e.g. token collision, unrelated logic, modern code mistaken for old).
   - 'leave-it': The code is an intentional fallback, ponyfill/polyfill, or belongs to a non-browser environment; it should NOT be touched.
   - 'guide-wrong': The guide's proposed replacement fundamentally does not solve or support this use case.
   - 'unsure': Insufficient context to determine.`;

export const SYNTHETIC_FIX_PROMPT_VERSION = 'synthetic-fix-v1-single-shot';

export const SYNTHETIC_FIX_SIMULATION_PROMPT = `You are an expert web platform modernization engineer.
Your task is to refactor a legacy web pattern in a brownfield codebase using the standard modern web platform capability prescribed in the provided Modern Web Guide.

CRITICAL INVARIANTS:
1. ELIMINATE ALL OCCURRENCES: Eliminate EVERY occurrence of the flagged legacy pattern inside the provided code window. If multiple occurrences appear in the window, modernize all of them so no legacy instances remain.
2. IMPLEMENT THE MODERN PLATFORM FEATURE DIRECTLY: The patched code MUST explicitly implement the modern standard replacement capability taught in the provided guide. Rely strictly on the instructions, code samples, and specifications in the provided guide.md. NEVER simply delete or gut the legacy code without implementing the modern standard replacement feature.
3. PRESERVE SURROUNDING LOGIC: Never delete or hollow out surrounding functions, handlers, classes, elements, or unrelated styles. Maintain existing names, exported signatures, and application structure.
4. Output the complete replacement for the provided code window in the "patchedWindow" field, with valid syntax and no placeholders.`;
