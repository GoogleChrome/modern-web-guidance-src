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

export type IndividualTransformSubPattern =
  | 'multi-function-chain'
  | 'paired-state-composition'
  | 'repeating-keyframe-step'
  | 'single-function-state';

export const ITP_ACTIVE_SUB_PATTERNS: readonly IndividualTransformSubPattern[] = [
  'multi-function-chain',
  'paired-state-composition',
  'repeating-keyframe-step',
];

/**
 * Deferred sub-patterns for the individual-transform-properties rule currently excluded from matcher execution.
 */
export const ITP_DEFERRED_SUB_PATTERNS: readonly IndividualTransformSubPattern[] = [
  'single-function-state',
];

const STATE_PSEUDO_TEST_RE =
  /:(?:hover|focus-visible|focus-within|focus|active|visited|checked|disabled|target|open|popover-open|modal)\b/i;

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

const COMPOUND_CLASS_MODIFIER_RE =
  /(\.[a-zA-Z_-][a-zA-Z0-9_-]*)\.[a-zA-Z_-][a-zA-Z0-9_-]+(?=(?:::?(?:before|after))?$)/i;

function isIdentityTransformCall(call: ParsedTransformCall): boolean {
  const compactArgs = call.args.replace(/\s+/g, '');
  if (call.group === 1) {
    return /^(?:0(?:px|%|em|rem|vh|vw)?(?:,0(?:px|%|em|rem|vh|vw)?)*)$/.test(compactArgs);
  }
  if (call.group === 2) {
    return /^0(?:deg|rad|grad|turn)?$/.test(compactArgs);
  }
  if (call.group === 3) {
    return /^1(?:,1)*$/.test(compactArgs);
  }
  return false;
}

function isZeroHardwareAccelerationTransform(calls: readonly ParsedTransformCall[]): boolean {
  return (
    calls.length === 1 &&
    (calls[0]?.name === 'translatez' || calls[0]?.name === 'translate3d') &&
    isIdentityTransformCall(calls[0])
  );
}

interface SelectorAnalysis {
  readonly baseSelectors: string[];
  readonly exactBaseSelectors: Set<string>;
  readonly pseudoStatefulSelectors: Set<string>;
  readonly compoundPrefixSelectors: Set<string>;
}

function extractSelectorInfo(selectorText: string): SelectorAnalysis {
  const parts = selectorText.split(',');
  const baseSelectors: string[] = [];
  const exactBaseSelectors = new Set<string>();
  const pseudoStatefulSelectors = new Set<string>();
  const compoundPrefixSelectors = new Set<string>();

  const addBase = (sel: string): void => {
    if (!baseSelectors.includes(sel)) {
      baseSelectors.push(sel);
    }
  };

  for (const rawPart of parts) {
    const trimmed = rawPart.trim();
    if (!trimmed) continue;

    const withoutPseudo = trimmed.replace(STATE_PSEUDO_RE, '').replace(/\s+/g, ' ').trim();
    if (!withoutPseudo) continue;

    const hadPseudo = withoutPseudo !== trimmed.replace(/\s+/g, ' ').trim();
    addBase(withoutPseudo);
    if (hadPseudo) {
      pseudoStatefulSelectors.add(withoutPseudo);
    } else {
      exactBaseSelectors.add(withoutPseudo);
    }

    if (COMPOUND_CLASS_MODIFIER_RE.test(withoutPseudo)) {
      const prefix = withoutPseudo
        .replace(COMPOUND_CLASS_MODIFIER_RE, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      if (prefix.length > 0 && prefix !== withoutPseudo && !/^[>+~]$/.test(prefix)) {
        addBase(prefix);
        compoundPrefixSelectors.add(prefix);
      }
    }
  }

  return {
    baseSelectors,
    exactBaseSelectors,
    pseudoStatefulSelectors,
    compoundPrefixSelectors,
  };
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
  readonly selectorInfo: SelectorAnalysis;
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
  readonly rulesByBaseSelector: ReadonlyMap<string, readonly AnalyzedStyleRule[]>;
  readonly keyframeGroups: ReadonlyMap<string, readonly AnalyzedStyleRule[]>;
  readonly keyframeGroupsByName: ReadonlyMap<string, readonly AnalyzedStyleRule[]>;
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
  const keyframeGroupsByName = new Map<string, AnalyzedStyleRule[]>();
  const keyframeNamesWithTransform = new Set<string>();

  try {
    const styleRuleViews: Iterable<CssRuleView> =
      ctx.styleRules ?? walkStyleRules(parseCss(ctx.stylesheetText));
    let anonymousKeyframeIndex = 0;
    for (const view of styleRuleViews) {
      const parentAtRule = view.parentAtRule ?? null;
      const transformValue = view.getPropertyValue('transform');
      const hasIndividualTransformProp =
        view.hasProperty('translate') || view.hasProperty('rotate') || view.hasProperty('scale');
      const transVal =
        view.getPropertyValue('transition') ??
        view.getPropertyValue('transition-property') ??
        view.getPropertyValue('-webkit-transition');
      const transitionsTransform = transVal !== null && /\btransform\b/i.test(transVal);
      const animationValue =
        view.getPropertyValue('animation') ?? view.getPropertyValue('animation-name');

      const analyzed: AnalyzedStyleRule = {
        selectorText: view.selectorText,
        selectorInfo: extractSelectorInfo(view.selectorText),
        line: view.line,
        parentAtRule,
        transformValue,
        parsedTransform: transformValue !== null ? parseValidTransformSequence(transformValue) : null,
        hasIndividualTransformProp,
        transitionsTransform,
        animationValue,
      };

      if (isKeyframeAtRule(parentAtRule) || isKeyframeStepSelector(view.selectorText)) {
        const stepLower = view.selectorText.trim().toLowerCase();
        if (!parentAtRule && (stepLower === '0%' || stepLower === 'from')) {
          anonymousKeyframeIndex++;
        }
        const baseKey = parentAtRule
          ? parentAtRule.toLowerCase().replace(/\s+/g, ' ')
          : `@keyframes`;
        let key = `${baseKey}#${anonymousKeyframeIndex}`;
        const currentGroup = keyframeMap.get(key);
        if (
          parentAtRule &&
          currentGroup &&
          currentGroup.some((s) => s.selectorText.trim().toLowerCase() === stepLower)
        ) {
          anonymousKeyframeIndex++;
          key = `${baseKey}#${anonymousKeyframeIndex}`;
        }
        const existing = keyframeMap.get(key) ?? [];
        existing.push(analyzed);
        keyframeMap.set(key, existing);

        if (parentAtRule) {
          const kfNameMatch = parentAtRule.match(/^@(?:-webkit-|-moz-|-o-)?keyframes\s+([^\s{]+)/i);
          if (kfNameMatch?.[1]) {
            const kfName = kfNameMatch[1].toLowerCase();
            const byName = keyframeGroupsByName.get(kfName) ?? [];
            byName.push(analyzed);
            keyframeGroupsByName.set(kfName, byName);
            if (transformValue !== null) {
              keyframeNamesWithTransform.add(kfName);
            }
          }
        }
      } else {
        normalRules.push(analyzed);
      }
    }
  } catch {
    // Fallback to empty analysis if CSS is malformed.
  }

  const rulesByBaseSelector = new Map<string, AnalyzedStyleRule[]>();
  for (const rule of normalRules) {
    for (const baseSel of rule.selectorInfo.baseSelectors) {
      let list = rulesByBaseSelector.get(baseSel);
      if (!list) {
        list = [];
        rulesByBaseSelector.set(baseSel, list);
      }
      list.push(rule);
    }
  }

  const result: AnalyzedStylesheet = {
    normalRules,
    rulesByBaseSelector,
    keyframeGroups: keyframeMap,
    keyframeGroupsByName,
    keyframeNamesWithTransform,
  };
  stylesheetCache.set(ctx, result);
  lastRawStylesheetText = ctx.stylesheetText;
  lastRawStylesheetAnalysis = result;
  return result;
}

function getRepeatingKeyframeFirstLine(steps: readonly AnalyzedStyleRule[]): number | null {
  // Reject if any step in the keyframe block has an unparseable or out-of-order transform.
  for (const step of steps) {
    if (step.transformValue !== null && step.parsedTransform === null) {
      return null;
    }
  }

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
  let anyStepHasMultiGroup = false;
  const seenStepTransforms = new Set<string>();

  for (const step of validSteps) {
    const stepKey = step.parsedTransform.map((c) => c.rawCall).join(' ');
    const isDuplicateStepTransform = seenStepTransforms.has(stepKey);
    seenStepTransforms.add(stepKey);
    const groupsInStep = new Set<TransformGroup>();
    const uniqueCallsInStep = new Set<string>();
    for (const call of step.parsedTransform) {
      uniqueCallsInStep.add(call.rawCall);
      groupsInStep.add(call.group);
      allGroupsSeen.add(call.group);
    }
    if (groupsInStep.size >= 2) {
      anyStepHasMultiGroup = true;
    }
    if (!isDuplicateStepTransform) {
      for (const rawCall of uniqueCallsInStep) {
        callCounts.set(rawCall, (callCounts.get(rawCall) ?? 0) + 1);
      }
    }
  }

  if (allGroupsSeen.size < 2 || !anyStepHasMultiGroup) {
    return null;
  }

  let hasRepeatedCallAcrossSteps = false;
  for (const count of callCounts.values()) {
    if (count >= 2) {
      hasRepeatedCallAcrossSteps = true;
      break;
    }
  }

  if (!hasRepeatedCallAcrossSteps) {
    return null;
  }

  return validSteps[0]?.line ?? null;
}

function extractReferencedKeyframeNames(
  animationValue: string | null,
  keyframeNames: ReadonlySet<string>,
): string[] {
  if (!animationValue || keyframeNames.size === 0) return [];
  const tokens = animationValue
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.filter((token) => keyframeNames.has(token));
}

function referencesTransformKeyframes(
  animationValue: string | null,
  keyframeNames: ReadonlySet<string>,
): boolean {
  return extractReferencedKeyframeNames(animationValue, keyframeNames).length > 0;
}

function referencesDisjointTransformKeyframes(
  animationValue: string | null,
  ruleCalls: readonly ParsedTransformCall[],
  analysis: AnalyzedStylesheet,
): boolean {
  if (isZeroHardwareAccelerationTransform(ruleCalls)) {
    return false;
  }
  const kfNames = extractReferencedKeyframeNames(
    animationValue,
    analysis.keyframeNamesWithTransform,
  );
  if (kfNames.length === 0) return false;
  const ruleGroups = new Set(ruleCalls.map((c) => c.group));
  for (const kfName of kfNames) {
    const steps = analysis.keyframeGroupsByName.get(kfName);
    if (!steps || steps.length === 0) continue;
    const kfGroups = new Set<TransformGroup>();
    let hasInvalidStep = false;
    for (const step of steps) {
      if (step.transformValue !== null && step.parsedTransform === null) {
        hasInvalidStep = true;
        break;
      }
      if (step.parsedTransform) {
        for (const call of step.parsedTransform) {
          kfGroups.add(call.group);
        }
      }
    }
    if (hasInvalidStep || kfGroups.size === 0) continue;
    let overlaps = false;
    for (const g of kfGroups) {
      if (ruleGroups.has(g)) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      return true;
    }
  }
  return false;
}

function areRulesPairedOnBaseSelector(
  selfInfo: SelectorAnalysis,
  otherInfo: SelectorAnalysis,
  baseSel: string,
): boolean {
  const selfExact = selfInfo.exactBaseSelectors.has(baseSel);
  const otherExact = otherInfo.exactBaseSelectors.has(baseSel);
  const selfPseudo = selfInfo.pseudoStatefulSelectors.has(baseSel);
  const otherPseudo = otherInfo.pseudoStatefulSelectors.has(baseSel);
  const selfCompound = selfInfo.compoundPrefixSelectors.has(baseSel);
  const otherCompound = otherInfo.compoundPrefixSelectors.has(baseSel);

  if ((selfExact || selfPseudo) && (otherExact || otherPseudo) && (selfPseudo || otherPseudo)) {
    return true;
  }
  if ((selfExact && otherCompound) || (selfCompound && otherExact)) {
    return true;
  }
  return false;
}

function getPairedRules(
  analysis: AnalyzedStylesheet,
  styleRule: CssRuleView,
  selfInfo: SelectorAnalysis,
): readonly AnalyzedStyleRule[] {
  const result: AnalyzedStyleRule[] = [];
  const seen = new Set<AnalyzedStyleRule>();
  for (const baseSel of selfInfo.baseSelectors) {
    const list = analysis.rulesByBaseSelector.get(baseSel);
    if (!list) continue;
    for (const other of list) {
      if (other.line === styleRule.line && other.selectorText === styleRule.selectorText) {
        continue;
      }
      if (
        other.selectorText.replace(/\s+/g, ' ').trim() ===
          styleRule.selectorText.replace(/\s+/g, ' ').trim() &&
        other.parentAtRule !== styleRule.parentAtRule
      ) {
        continue;
      }
      if (!areRulesPairedOnBaseSelector(selfInfo, other.selectorInfo, baseSel)) {
        continue;
      }
      if (!seen.has(other)) {
        seen.add(other);
        result.push(other);
      }
    }
  }
  return result;
}

function matchSingleFunctionStateRule(
  styleRule: CssRuleView,
  ctx: CssMatcherContext,
): { message: string; subPattern?: string } | null {
  if (
    ctx.stylesheetHasProperty('scale') ||
    ctx.stylesheetHasProperty('rotate') ||
    ctx.stylesheetHasProperty('translate')
  ) {
    return null;
  }

  const transformVal = styleRule.getPropertyValue('transform');
  if (!transformVal) return null;

  const parsedCalls = parseValidTransformSequence(transformVal);
  if (!parsedCalls) return null;

  if (isKeyframeAtRule(styleRule.parentAtRule) || isKeyframeStepSelector(styleRule.selectorText)) {
    return null;
  }

  const transVal =
    styleRule.getPropertyValue('transition') ??
    styleRule.getPropertyValue('transition-property') ??
    styleRule.getPropertyValue('-webkit-transition');
  if (transVal && /\btransform\b/i.test(transVal)) {
    return null;
  }

  if (!/:(?:hover|focus(?:-visible|-within)?|active|checked)\b/i.test(styleRule.selectorText)) {
    return null;
  }

  const distinctGroups = new Set(parsedCalls.map((c) => c.group));
  if (distinctGroups.size !== 1) {
    return null;
  }

  if (isZeroHardwareAccelerationTransform(parsedCalls)) {
    return null;
  }

  const hasVendorPrefix =
    styleRule.hasProperty('-webkit-transform') ||
    styleRule.hasProperty('-moz-transform') ||
    styleRule.hasProperty('-ms-transform');
  if (/:checked\b/i.test(styleRule.selectorText) && !hasVendorPrefix) {
    return null;
  }
  if (/::?(?:before|after)\b/i.test(styleRule.selectorText)) {
    return null;
  }
  if (
    !hasVendorPrefix &&
    /:(?:nth-child|first-child|last-child|nth-of-type|first-of-type|last-of-type)\b/i.test(
      styleRule.selectorText,
    )
  ) {
    return null;
  }

  const analysis = analyzeStylesheet(ctx);
  const selectorInfo = extractSelectorInfo(styleRule.selectorText);
  const pairedRules = getPairedRules(analysis, styleRule, selectorInfo);

  for (const other of pairedRules) {
    if (other.transitionsTransform) {
      return null;
    }
    return null;
  }

  if (
    !hasVendorPrefix &&
    (parsedCalls[0]?.name === 'rotatex' || parsedCalls[0]?.name === 'rotatey')
  ) {
    return null;
  }

  const ownAnimation =
    styleRule.getPropertyValue('animation') ?? styleRule.getPropertyValue('animation-name');
  if (referencesTransformKeyframes(ownAnimation, analysis.keyframeNamesWithTransform)) {
    return null;
  }

  return {
    message: `CSS rule \`${styleRule.selectorText}\` sets an isolated single-function \`transform: ${transformVal}\` on a state selector; consider using the individual property directly.`,
    subPattern: 'single-function-state',
  };
}

export const individualTransformPropertiesMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['transform'],
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string; subPattern?: string } | null {
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
      let steps: readonly AnalyzedStyleRule[] | undefined;
      for (const groupSteps of analysis.keyframeGroups.values()) {
        if (groupSteps.some((s) => s.line === styleRule.line)) {
          steps = groupSteps;
          break;
        }
      }
      if (!steps) return null;
      const firstLine = getRepeatingKeyframeFirstLine(steps);
      if (firstLine !== null && styleRule.line === firstLine) {
        return {
          message: `CSS \`${styleRule.parentAtRule ?? '@keyframes'}\` repeats static transform functions across keyframe steps (\`transform: ${transformVal}\`); extract static \`translate\`/\`rotate\`/\`scale\` properties to the element rule.`,
          subPattern: 'repeating-keyframe-step',
        };
      }
      return null;
    }

    // c) Skip when paired with `transition: transform` on the same rule or a paired base selector.
    const transVal =
      styleRule.getPropertyValue('transition') ??
      styleRule.getPropertyValue('transition-property') ??
      styleRule.getPropertyValue('-webkit-transition');
    if (transVal && /\btransform\b/i.test(transVal)) {
      return null;
    }

    const selectorInfo = extractSelectorInfo(styleRule.selectorText);
    const pairedRules = getPairedRules(analysis, styleRule, selectorInfo);

    for (const other of pairedRules) {
      if (other.transitionsTransform) {
        return null;
      }
      if (other.transformValue !== null && other.parsedTransform === null) {
        return null;
      }
    }

    // e) State and keyframe composition check on normal style rules:
    for (const other of pairedRules) {
      if (
        isZeroHardwareAccelerationTransform(parsedCalls) &&
        other.parsedTransform !== null &&
        isZeroHardwareAccelerationTransform(other.parsedTransform)
      ) {
        continue;
      }
      if (
        other.parsedTransform !== null ||
        other.hasIndividualTransformProp ||
        referencesDisjointTransformKeyframes(other.animationValue, parsedCalls, analysis)
      ) {
        return {
          message: `CSS rule \`${styleRule.selectorText}\` composes \`transform: ${transformVal}\` across paired state selectors; consider using individual \`translate\`, \`rotate\`, and \`scale\` properties.`,
          subPattern: 'paired-state-composition',
        };
      }
    }

    const ownAnimation = styleRule.getPropertyValue('animation');
    if (referencesDisjointTransformKeyframes(ownAnimation, parsedCalls, analysis)) {
      return {
        message: `CSS rule \`${styleRule.selectorText}\` pairs \`transform: ${transformVal}\` with a transform keyframe animation; consider using individual \`translate\`, \`rotate\`, and \`scale\` properties.`,
        subPattern: 'paired-state-composition',
      };
    }

    if (ITP_ACTIVE_SUB_PATTERNS.includes('single-function-state')) {
      const stateMatch = matchSingleFunctionStateRule(styleRule, ctx);
      if (stateMatch) {
        return stateMatch;
      }
    }

    return null;
  },
};

export const individualTransformPropertiesStandaloneChainMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['transform'],
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string; subPattern?: string } | null {
    if (
      ctx.stylesheetHasProperty('scale') ||
      ctx.stylesheetHasProperty('rotate') ||
      ctx.stylesheetHasProperty('translate')
    ) {
      return null;
    }

    const transformVal = styleRule.getPropertyValue('transform');
    if (!transformVal) return null;

    const parsedCalls = parseValidTransformSequence(transformVal);
    if (!parsedCalls) return null;

    if (isKeyframeAtRule(styleRule.parentAtRule) || isKeyframeStepSelector(styleRule.selectorText)) {
      return null;
    }

    const transVal =
      styleRule.getPropertyValue('transition') ??
      styleRule.getPropertyValue('transition-property') ??
      styleRule.getPropertyValue('-webkit-transition');
    if (transVal && /\btransform\b/i.test(transVal)) {
      return null;
    }

    const nonIdentityGroups = new Set(
      parsedCalls.filter((c) => !isIdentityTransformCall(c)).map((c) => c.group),
    );
    if (nonIdentityGroups.size < 2) {
      return null;
    }

    const analysis = analyzeStylesheet(ctx);
    const selectorInfo = extractSelectorInfo(styleRule.selectorText);
    const pairedRules = getPairedRules(analysis, styleRule, selectorInfo);

    for (const other of pairedRules) {
      if (other.transitionsTransform) {
        return null;
      }
      return null;
    }

    const ownAnimation =
      styleRule.getPropertyValue('animation') ?? styleRule.getPropertyValue('animation-name');
    if (referencesTransformKeyframes(ownAnimation, analysis.keyframeNamesWithTransform)) {
      return null;
    }

    // Require interactive state pseudo-class, compound modifier class, or transition declaration
    const hasPseudoElement = /::?(?:before|after)\b/i.test(styleRule.selectorText);
    const hasOwnTransition =
      (transVal !== null && !/^\s*opacity\b/i.test(transVal)) ||
      styleRule.hasProperty('transition-property');
    const hasStatePseudo = STATE_PSEUDO_TEST_RE.test(styleRule.selectorText);
    const hasCompoundModifier = selectorInfo.compoundPrefixSelectors.size > 0;
    if (!hasStatePseudo && !hasCompoundModifier && !hasOwnTransition) {
      return null;
    }
    if (
      /:(?:nth-child|nth-last-child|first-child|last-child|nth-of-type|first-of-type|last-of-type)\b/i.test(
        styleRule.selectorText,
      ) &&
      !hasOwnTransition
    ) {
      return null;
    }
    if (hasPseudoElement) {
      if (!hasStatePseudo && !hasOwnTransition) {
        return null;
      }
      if (/:checked\b/i.test(styleRule.selectorText) && !hasOwnTransition) {
        return null;
      }
    }

    return {
      message: `CSS rule \`${styleRule.selectorText}\` combines multiple transform functions (\`transform: ${transformVal}\`) in canonical order without paired state selectors; consider using individual \`translate\`, \`rotate\`, and \`scale\` properties.`,
      subPattern: 'multi-function-chain',
    };
  },
};

export const individualTransformPropertiesStandaloneChainRule: AnalyzerRule = {
  id: 'individual-transform-properties/standalone-chain',
  guideId: 'individual-transform-properties',
  guideHash: '42af807594e8',
  summary:
    'Detect CSS rules combining >= 2 transform functions in canonical translate -> rotate -> scale order across interactive states or transitions.',
  matcher: individualTransformPropertiesStandaloneChainMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule combines multiple `translate*()`, `rotate*()`, and/or `scale*()` functions in canonical `translate -> rotate -> scale` order (including on `:hover`, `:checked`, `:target`, `.active`, `.open`, `.toggled`, or transition state selectors) without `transition: transform` on the rule itself.',
    ],
    dropWhen: [
      'The `transform` list applies `rotate` or `scale` before `translate` (violating canonical `translate -> rotate -> scale` order).',
      'The rule is a purely static layout or positioning declaration (such as a static tooltip arrow or axis label) with no interactive state selector, transition, or state override.',
    ],
  },
};

export const individualTransformPropertiesSingleFunctionStateMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['transform'],
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    return matchSingleFunctionStateRule(styleRule, ctx);
  },
};

export const individualTransformPropertiesSingleFunctionStateRule: AnalyzerRule = {
  id: 'individual-transform-properties/single-function-state',
  guideId: 'individual-transform-properties',
  guideHash: '42af807594e8',
  summary:
    'Detect single-function :hover/:focus/:active/:checked transform state rules that modernize vendor-prefixed or descendant-hover transforms to individual translate/rotate/scale properties.',
  matcher: individualTransformPropertiesSingleFunctionStateMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS state rule (`:hover`, `:focus`, `:active`, or vendor-prefixed `:checked`) sets a single-function `translate*()`, `rotate*()`, or `scale*()` transform (either standalone with vendor prefixes or overriding a descendant element transform on parent `:hover`) without `transition: transform`.',
    ],
    dropWhen: [
      'The rule or its target element explicitly declares `transition: transform` or `transition-property: transform` (note: `transition: all` or `transition: 0.2s` is valid to keep).',
      'The rule only applies `translate3d(0, 0, 0)` or `translateZ(0)` as a hardware-acceleration hack.',
    ],
  },
};

export const individualTransformPropertiesRule: AnalyzerRule = {
  id: 'individual-transform-properties',
  guideId: 'individual-transform-properties',
  guideHash: '42af807594e8',
  summary:
    'Detect CSS `transform` declarations that compose translate/rotate/scale operations across paired state selectors or @keyframes steps.',
  matcher: individualTransformPropertiesMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule pairs a base transform with a `:hover`, `:focus`, or state modifier rule (`.active`, `.open`, `.is-open`, `.fixed`, etc.) where individual `translate`, `rotate`, and `scale` properties simplify state overrides or remove vendor-prefixed `transform` declarations.',
      'An `@keyframes` block repeats a static `translate*()`, `rotate*()`, or `scale*()` function across every keyframe step while animating another transform property.',
    ],
    dropWhen: [
      'The `transform` list in the rule, a paired state rule, or a keyframe step applies `rotate` or `scale` before `translate` (e.g. `scale(.75) translateY(-21px)` where rewriting changes geometry).',
      'The `transform` value uses `skew*()`, `matrix*()`, `perspective()`, or `var()`.',
      'The rule or a paired base selector explicitly declares `transition: transform` or `transition-property: transform` (note: `transition: all` is valid to keep).',
    ],
  },
};

export const individualTransformPropertiesCssRule: AnalyzerRule =
  individualTransformPropertiesRule;

export default [
  individualTransformPropertiesRule,
  individualTransformPropertiesStandaloneChainRule,
  individualTransformPropertiesSingleFunctionStateRule,
] satisfies readonly AnalyzerRule[];
