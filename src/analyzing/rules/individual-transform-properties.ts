import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const STATE_SELECTOR_REGEX =
  /(?::(hover|focus|focus-visible|focus-within|active)|\.(active|open|is-active|is-open))\b/i;

const INTERACTIVE_STATE_REGEX =
  /:(hover|focus|focus-visible|focus-within|active)\b/i;

const KEYFRAME_SELECTOR_REGEX = /^(from|to|\d+%)$/i;

const TRANSFORM_FUNCTION_REGEX =
  /\b(translate[XYZ3d]*|rotate[XYZ]*|scale[XYZ3d]*)\s*\(/gi;

const SINGLE_SCALE_OR_ROTATE_REGEX = /\b(scale[XYZ3d]*|rotate[XYZ]*)\s*\(/i;

const TRANSITION_TRANSFORM_REGEX =
  /transition(?:-property)?:\s*[^;]*\b(transform|all)\b/i;

const individualTransformPropertiesCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['transform'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines individual transform properties, skip
    if (
      ctx.stylesheetHasProperty('scale') ||
      ctx.stylesheetHasProperty('rotate') ||
      ctx.stylesheetHasProperty('translate')
    ) {
      return null;
    }

    const transformVal = styleRule.getPropertyValue('transform');
    if (!transformVal || transformVal === 'none') {
      return null;
    }

    // 2. Skip 3D perspective transforms, matrix calculations, and skew functions
    if (
      transformVal.includes('matrix') ||
      transformVal.includes('perspective(') ||
      transformVal.includes('skew')
    ) {
      return null;
    }

    const transformFuncs =
      transformVal.match(TRANSFORM_FUNCTION_REGEX) ?? [];
    if (transformFuncs.length === 0) {
      return null;
    }

    const isKeyframeRule =
      KEYFRAME_SELECTOR_REGEX.test(styleRule.selectorText.trim()) ||
      styleRule.selectorText.includes('%') ||
      (styleRule.parentAtRule?.toLowerCase().startsWith('@keyframes') ?? false);

    const isStateRule = STATE_SELECTOR_REGEX.test(styleRule.selectorText);

    // Branch a: Combined transform functions in a state or keyframe rule
    if ((isStateRule || isKeyframeRule) && transformFuncs.length >= 2) {
      return {
        message:
          'CSS rule combines multiple transform functions in a state or keyframe rule; modernize with individual translate, rotate, or scale properties to avoid repeating compound chains.',
      };
    }

    // Branch b: Transition transform alongside a single scale(...) or rotate(...) on :hover/:focus/:active
    const isInteractiveState = INTERACTIVE_STATE_REGEX.test(
      styleRule.selectorText,
    );
    if (
      isInteractiveState &&
      transformFuncs.length === 1 &&
      SINGLE_SCALE_OR_ROTATE_REGEX.test(transformVal)
    ) {
      const localTransition =
        styleRule.getPropertyValue('transition') ??
        styleRule.getPropertyValue('transition-property') ??
        '';

      const transitionsTransformLocally =
        localTransition.includes('transform') || localTransition.includes('all');

      const transitionsTransformInSheet =
        TRANSITION_TRANSFORM_REGEX.test(ctx.stylesheetText);

      if (transitionsTransformLocally || transitionsTransformInSheet) {
        return {
          message:
            'CSS rule transitions transform with a single scale or rotate function on an interactive state; modernize with individual scale or rotate property.',
        };
      }
    }

    return null;
  },
};

export const individualTransformPropertiesRule: AnalyzerRule = {
  id: 'individual-transform-properties',
  guideId: 'individual-transform-properties',
  guideHash: '42af807594e8',
  summary:
    'Compound transform chains and hover/transition transforms can be replaced with independent translate, rotate, and scale CSS properties.',
  matcher: individualTransformPropertiesCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule combines multiple transform functions (e.g. translate() and rotate(), or translateX() and translateY()) in a state selector (:hover, :focus, :active, .active, .open) or keyframe step.',
      'The CSS rule transitions or animates transform with a single scale() or rotate() function on an interactive pseudo-class (:hover, :focus, :active) where individual scale or rotate properties eliminate full transform restatement.',
    ],
    dropWhen: [
      'The transform is static layout centering (e.g. transform: translate(-50%, -50%)) on a non-interactive base selector.',
      'The stylesheet already declares individual translate, rotate, or scale properties.',
      'The transform includes 3D perspective or matrix calculations (matrix(), matrix3d(), perspective()) that cannot be represented with individual transform properties.',
      'The transform uses non-decomposable skew() functions.',
    ],
  },
};

export const individualTransformPropertiesRules: readonly AnalyzerRule[] = [
  individualTransformPropertiesRule,
];
