import { parse as parseCss, walkStyleRules } from 'cssomnom';
import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

/**
 * Unsupported transform functions that do not map to individual
 * `translate` / `rotate` / `scale` CSS properties, or `var()` which may
 * hide arbitrary transform lists.
 */
const UNSUPPORTED_TRANSFORM_RE = /\b(?:skew|skewX|skewY|matrix|matrix3d|perspective|var)\s*\(/i;

const GLOBAL_VALUES = new Set([
  'none',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

type TransformGroup = 1 | 2 | 3;

interface ParsedTransformCall {
  readonly name: string;
  readonly rawCall: string;
  readonly args: string;
  readonly group: TransformGroup;
}

const FUNCTION_GROUPS: Readonly<Record<string, TransformGroup>> = {
  translate: 1,
  translatex: 1,
  translatey: 1,
  translatez: 1,
  translate3d: 1,
  rotate: 2,
  rotatex: 2,
  rotatey: 2,
  rotatez: 2,
  rotate3d: 2,
  scale: 3,
  scalex: 3,
  scaley: 3,
  scalez: 3,
  scale3d: 3,
};

const SINGLE_AXIS_TRANSLATE = new Set(['translatex', 'translatey', 'translatez']);
const SINGLE_AXIS_SCALE = new Set(['scalex', 'scaley', 'scalez']);

/**
 * Parse a `transform` property value into an ordered list of function calls.
 * Returns `null` if the value is a global keyword, contains unsupported
 * functions, has stray tokens outside function calls, violates the canonical
 * `translate -> rotate -> scale` application order, or repeats the same
 * transform group with incompatible axes.
 */
function parseValidTransformSequence(rawValue: string): ParsedTransformCall[] | null {
  const cleaned = rawValue.replace(/!important\s*$/i, '').trim();
  if (!cleaned || GLOBAL_VALUES.has(cleaned.toLowerCase())) {
    return null;
  }
  if (UNSUPPORTED_TRANSFORM_RE.test(cleaned)) {
    return null;
  }

  const calls: ParsedTransformCall[] = [];
  let idx = 0;
  const len = cleaned.length;

  while (idx < len) {
    while (idx < len && /\s/.test(cleaned[idx] ?? '')) {
      idx++;
    }
    if (idx >= len) break;

    const nameStart = idx;
    while (idx < len && /[a-zA-Z0-9_-]/.test(cleaned[idx] ?? '')) {
      idx++;
    }
    const rawName = cleaned.slice(nameStart, idx);
    const lowerName = rawName.toLowerCase();
    if (!lowerName || cleaned[idx] !== '(') {
      return null;
    }

    const group = FUNCTION_GROUPS[lowerName];
    if (group === undefined) {
      return null;
    }

    let depth = 0;
    const argsStart = idx + 1;
    while (idx < len) {
      const ch = cleaned[idx];
      if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
        if (depth === 0) {
          idx++;
          break;
        }
      }
      idx++;
    }

    if (depth !== 0) {
      return null;
    }

    const args = cleaned.slice(argsStart, idx - 1).trim();
    const rawCall = `${lowerName}(${args.replace(/\s+/g, ' ')})`;
    calls.push({
      name: lowerName,
      rawCall,
      args,
      group,
    });
  }

  if (calls.length === 0) {
    return null;
  }

  // Enforce canonical application order: translate (1) -> rotate (2) -> scale (3).
  let maxGroupSeen: TransformGroup = 1;
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    if (!call) continue;
    if (i === 0) {
      maxGroupSeen = call.group;
    } else if (call.group < maxGroupSeen) {
      return null;
    } else {
      maxGroupSeen = call.group;
    }
  }

  // Validate same-group compatibility:
  const translateCalls = calls.filter((c) => c.group === 1);
  if (translateCalls.length > 1) {
    const seenAxes = new Set<string>();
    for (const tc of translateCalls) {
      if (!SINGLE_AXIS_TRANSLATE.has(tc.name) || seenAxes.has(tc.name)) {
        return null;
      }
      seenAxes.add(tc.name);
    }
  }

  const rotateCalls = calls.filter((c) => c.group === 2);
  if (rotateCalls.length > 1) {
    return null;
  }

  const scaleCalls = calls.filter((c) => c.group === 3);
  if (scaleCalls.length > 1) {
    const seenAxes = new Set<string>();
    for (const sc of scaleCalls) {
      if (!SINGLE_AXIS_SCALE.has(sc.name) || seenAxes.has(sc.name)) {
        return null;
      }
      seenAxes.add(sc.name);
    }
  }

  return calls;
}

const STATE_PSEUDO_RE =
  /:(?:hover|focus-visible|focus-within|focus|active|visited|checked|disabled|target|open|popover-open|modal)\b/gi;

const STATE_MODIFIER_CLASS_RE =
  /\.(?:is-active|active|is-open|open|is-shown|show|is-visible|visible|is-selected|selected|is-expanded|expanded|is-collapsed|collapsed|is-disabled|disabled|hover|focus|focused)\b/gi;

function extractBaseSelectors(selectorText: string): string[] {
  const parts = selectorText.split(',');
  const results: string[] = [];

  for (const rawPart of parts) {
    const trimmed = rawPart.trim();
    if (!trimmed) continue;

    let withoutPseudo = trimmed.replace(STATE_PSEUDO_RE, '').trim();
    const withoutModifier = withoutPseudo.replace(STATE_MODIFIER_CLASS_RE, '').trim();
    if (withoutModifier.length > 0 && !/^[>+~]$/.test(withoutModifier)) {
      withoutPseudo = withoutModifier;
    }

    const normalized = withoutPseudo.replace(/\s+/g, ' ').trim();
    if (normalized.length > 0) {
      results.push(normalized);
    }
  }

  return results;
}

function isKeyframeAtRule(parentAtRule: string | null | undefined): boolean {
  if (!parentAtRule) return false;
  return /^@(?:-webkit-|-moz-|-o-)?keyframes\b/i.test(parentAtRule.trim());
}

function isKeyframeStepSelector(selectorText: string): boolean {
  const trimmed = selectorText.trim().toLowerCase();
  return /^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/.test(trimmed);
}

interface AnalyzedStyleRule {
  readonly selectorText: string;
  readonly baseSelectors: readonly string[];
  readonly line: number;
  readonly parentAtRule: string | null;
  readonly transformValue: string | null;
  readonly parsedTransform: readonly ParsedTransformCall[] | null;
  readonly hasIndividualTransformProp: boolean;
  readonly transitionsTransform: boolean;
  readonly animationValue: string | null;
}

interface AnalyzedStylesheet {
  readonly normalRules: readonly AnalyzedStyleRule[];
  readonly keyframeGroups: ReadonlyMap<string, readonly AnalyzedStyleRule[]>;
  readonly keyframeNamesWithTransform: ReadonlySet<string>;
}

const stylesheetCache = new WeakMap<CssMatcherContext, AnalyzedStylesheet>();
let lastRawStylesheetText: string | null = null;
let lastRawStylesheetAnalysis: AnalyzedStylesheet | null = null;

function analyzeStylesheet(ctx: CssMatcherContext): AnalyzedStylesheet {
  const cached = stylesheetCache.get(ctx);
  if (cached) return cached;

  if (lastRawStylesheetText === ctx.stylesheetText && lastRawStylesheetAnalysis !== null) {
    stylesheetCache.set(ctx, lastRawStylesheetAnalysis);
    return lastRawStylesheetAnalysis;
  }

  const normalRules: AnalyzedStyleRule[] = [];
  const keyframeMap = new Map<string, AnalyzedStyleRule[]>();
  const keyframeNamesWithTransform = new Set<string>();

  try {
    const sheet = parseCss(ctx.stylesheetText);
    for (const view of walkStyleRules(sheet)) {
      const parentAtRule = view.parentAtRule ?? null;
      const transformValue = view.getPropertyValue('transform');
      const hasIndividualTransformProp =
        view.hasProperty('translate') || view.hasProperty('rotate') || view.hasProperty('scale');
      const transVal =
        view.getPropertyValue('transition') ?? view.getPropertyValue('transition-property');
      const transitionsTransform = transVal !== null && /\btransform\b/i.test(transVal);
      const animationValue =
        view.getPropertyValue('animation') ?? view.getPropertyValue('animation-name');

      const analyzed: AnalyzedStyleRule = {
        selectorText: view.selectorText,
        baseSelectors: extractBaseSelectors(view.selectorText),
        line: view.line,
        parentAtRule,
        transformValue,
        parsedTransform: transformValue !== null ? parseValidTransformSequence(transformValue) : null,
        hasIndividualTransformProp,
        transitionsTransform,
        animationValue,
      };

      if (isKeyframeAtRule(parentAtRule) || isKeyframeStepSelector(view.selectorText)) {
        const key = (parentAtRule ?? '@keyframes').toLowerCase().replace(/\s+/g, ' ');
        const existing = keyframeMap.get(key) ?? [];
        existing.push(analyzed);
        keyframeMap.set(key, existing);

        if (transformValue !== null && parentAtRule) {
          const kfNameMatch = parentAtRule.match(/^@(?:-webkit-|-moz-|-o-)?keyframes\s+([^\s{]+)/i);
          if (kfNameMatch?.[1]) {
            keyframeNamesWithTransform.add(kfNameMatch[1].toLowerCase());
          }
        }
      } else {
        normalRules.push(analyzed);
      }
    }
  } catch {
    // Fallback to empty analysis if CSS is malformed.
  }

  const result: AnalyzedStylesheet = {
    normalRules,
    keyframeGroups: keyframeMap,
    keyframeNamesWithTransform,
  };
  stylesheetCache.set(ctx, result);
  lastRawStylesheetText = ctx.stylesheetText;
  lastRawStylesheetAnalysis = result;
  return result;
}

function getRepeatingKeyframeFirstLine(steps: readonly AnalyzedStyleRule[]): number | null {
  const validSteps = steps.filter(
    (step): step is AnalyzedStyleRule & { readonly parsedTransform: readonly ParsedTransformCall[] } =>
      step.parsedTransform !== null && step.parsedTransform.length > 0,
  );
  if (validSteps.length < 2) {
    return null;
  }

  const distinctStepTransforms = new Set(
    validSteps.map((s) => s.parsedTransform.map((c) => c.rawCall).join(' ')),
  );
  if (distinctStepTransforms.size < 2) {
    return null;
  }

  const callCounts = new Map<string, number>();
  const allGroupsSeen = new Set<TransformGroup>();

  for (const step of validSteps) {
    const uniqueCallsInStep = new Set<string>();
    for (const call of step.parsedTransform) {
      uniqueCallsInStep.add(call.rawCall);
      allGroupsSeen.add(call.group);
    }
    for (const rawCall of uniqueCallsInStep) {
      callCounts.set(rawCall, (callCounts.get(rawCall) ?? 0) + 1);
    }
  }

  if (allGroupsSeen.size < 2) {
    return null;
  }

  let hasRepeatedCall = false;
  for (const count of callCounts.values()) {
    if (count >= 2) {
      hasRepeatedCall = true;
      break;
    }
  }

  if (!hasRepeatedCall) {
    return null;
  }

  return validSteps[0]?.line ?? null;
}

function sharesBaseSelector(a: readonly string[], b: readonly string[]): boolean {
  for (const selA of a) {
    for (const selB of b) {
      if (selA === selB) {
        return true;
      }
    }
  }
  return false;
}

function referencesTransformKeyframes(
  animationValue: string | null,
  keyframeNames: ReadonlySet<string>,
): boolean {
  if (!animationValue || keyframeNames.size === 0) return false;
  const tokens = animationValue
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const token of tokens) {
    if (keyframeNames.has(token)) {
      return true;
    }
  }
  return false;
}

export const individualTransformPropertiesMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['transform'],
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    // a) Keep skipping if stylesheet already declares `scale`, `rotate`, or `translate` properties.
    if (
      ctx.stylesheetHasProperty('scale') ||
      ctx.stylesheetHasProperty('rotate') ||
      ctx.stylesheetHasProperty('translate')
    ) {
      return null;
    }

    const transformVal = styleRule.getPropertyValue('transform');
    if (!transformVal) return null;

    // b) Validate function sequence and canonical translate -> rotate -> scale order.
    const parsedCalls = parseValidTransformSequence(transformVal);
    if (!parsedCalls) return null;

    const analysis = analyzeStylesheet(ctx);

    // d) @keyframes static-step repetition check.
    if (isKeyframeAtRule(styleRule.parentAtRule) || isKeyframeStepSelector(styleRule.selectorText)) {
      const key = (styleRule.parentAtRule ?? '@keyframes').toLowerCase().replace(/\s+/g, ' ');
      const steps = analysis.keyframeGroups.get(key);
      if (!steps) return null;
      const firstLine = getRepeatingKeyframeFirstLine(steps);
      if (firstLine !== null && styleRule.line === firstLine) {
        return {
          message: `CSS \`${styleRule.parentAtRule ?? '@keyframes'}\` repeats static transform functions across keyframe steps (\`transform: ${transformVal}\`); extract static \`translate\`/\`rotate\`/\`scale\` properties to the element rule.`,
        };
      }
      return null;
    }

    // c) Skip when paired with `transition: transform` on the same rule or a shared base selector.
    const transVal =
      styleRule.getPropertyValue('transition') ?? styleRule.getPropertyValue('transition-property');
    if (transVal && /\btransform\b/i.test(transVal)) {
      return null;
    }

    const currentBaseSelectors = extractBaseSelectors(styleRule.selectorText);
    for (const other of analysis.normalRules) {
      if (
        other.transitionsTransform &&
        sharesBaseSelector(currentBaseSelectors, other.baseSelectors)
      ) {
        return null;
      }
    }

    // e) Independent composition check on normal style rules:
    // 1. Combines >= 2 distinct transform groups in valid translate -> rotate -> scale order.
    const distinctGroups = new Set(parsedCalls.map((c) => c.group));
    if (distinctGroups.size >= 2) {
      return {
        message: `CSS rule \`${styleRule.selectorText}\` combines multiple transform functions (\`transform: ${transformVal}\`) in canonical order; consider using individual \`translate\`, \`rotate\`, and \`scale\` properties.`,
      };
    }

    // 2. Single-group transform paired with another rule sharing the same base selector
    // that also sets transform, translate, rotate, scale, or animates a transform @keyframes.
    for (const other of analysis.normalRules) {
      if (other.line === styleRule.line && other.selectorText === styleRule.selectorText) {
        continue;
      }
      if (!sharesBaseSelector(currentBaseSelectors, other.baseSelectors)) {
        continue;
      }
      if (
        other.parsedTransform !== null ||
        other.hasIndividualTransformProp ||
        referencesTransformKeyframes(other.animationValue, analysis.keyframeNamesWithTransform)
      ) {
        return {
          message: `CSS rule \`${styleRule.selectorText}\` composes \`transform: ${transformVal}\` across paired state selectors; consider using individual \`translate\`, \`rotate\`, and \`scale\` properties.`,
        };
      }
    }

    const ownAnimation =
      styleRule.getPropertyValue('animation') ?? styleRule.getPropertyValue('animation-name');
    if (referencesTransformKeyframes(ownAnimation, analysis.keyframeNamesWithTransform)) {
      return {
        message: `CSS rule \`${styleRule.selectorText}\` pairs \`transform: ${transformVal}\` with a transform keyframe animation; consider using individual \`translate\`, \`rotate\`, and \`scale\` properties.`,
      };
    }

    return null;
  },
};

export const individualTransformPropertiesRule: AnalyzerRule = {
  id: 'individual-transform-properties',
  guideId: 'individual-transform-properties',
  guideHash: '42af807594e8',
  summary:
    'Detect CSS `transform` declarations that compose independent translate/rotate/scale operations across multi-function rules, paired state selectors, or @keyframes steps.',
  matcher: individualTransformPropertiesMatcher,
  phase2Rubric: {
    keepWhen: [
      'A CSS rule combines multiple `translate*()`, `rotate*()`, and/or `scale*()` functions in canonical `translate -> rotate -> scale` order without `transition: transform`.',
      'A CSS rule pairs a base transform with a `:hover`/`:focus`/state rule or `@keyframes` animation where individual `translate`, `rotate`, and `scale` properties avoid repeating static transform components.',
      'An `@keyframes` block repeats a static `translate*()`, `rotate*()`, or `scale*()` function across multiple keyframe steps while animating another transform property.',
    ],
    dropWhen: [
      'The `transform` list applies `rotate` or `scale` before `translate` (e.g. `rotate(45deg) translateX(20px)` where rewriting changes geometry).',
      'The `transform` value uses `skew*()`, `matrix*()`, `perspective()`, or `var()`.',
      'The rule or a paired base selector declares `transition: transform` or `transition-property: transform` (where changing properties breaks the transition).',
      'The rule is an isolated single-function transform (e.g. `.btn:hover { transform: scale(1.05) }`) with no independent composition across states or keyframes.',
    ],
  },
};

export const individualTransformPropertiesCssRule: AnalyzerRule =
  individualTransformPropertiesRule;

export const individualTransformPropertiesRules: readonly AnalyzerRule[] = [
  individualTransformPropertiesRule,
];
