import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const SLIDER_GUIDE_HASH = '70aeff8bae4d';

const SLIDER_GUARD_TOKENS = [
  'accent-color',
  'accentColor',
] as const;

function isNumericValueNode(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isNumericLiteral(unwrapped)) {
    return true;
  }
  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    (unwrapped.getOperatorToken() === SyntaxKind.MinusToken ||
      unwrapped.getOperatorToken() === SyntaxKind.PlusToken)
  ) {
    return Node.isNumericLiteral(unwrapExpression(unwrapped.getOperand()));
  }
  return false;
}

function isSingleHandleStartOption(optionsObj: ObjectLiteralExpression): boolean {
  const startProp = optionsObj.getProperty('start');
  if (!startProp || !Node.isPropertyAssignment(startProp)) {
    return false;
  }
  const init = startProp.getInitializer();
  if (!init) {
    return false;
  }
  const resolved = resolveLocalExpression(init, 2);
  if (isNumericValueNode(resolved)) {
    return true;
  }
  if (Node.isArrayLiteralExpression(resolved)) {
    const elements = resolved.getElements();
    if (elements.length === 1 && elements[0]) {
      return isNumericValueNode(resolveLocalExpression(elements[0], 2));
    }
    return false;
  }
  return false;
}

function matchNoUiSliderCreate(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'create') {
    return null;
  }

  const receiver = callee.getExpression();
  if (
    !isLibraryReference(receiver, 'noUiSlider', ['nouislider']) &&
    !isLibraryReference(receiver, 'nouislider', ['nouislider'])
  ) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 2 || !args[1]) {
    return null;
  }

  const optionsNode = resolveLocalExpression(args[1], 2);
  if (!Node.isObjectLiteralExpression(optionsNode)) {
    return null;
  }

  if (!isSingleHandleStartOption(optionsNode)) {
    return null;
  }

  return 'Single-handle noUiSlider.create() instance can be modernized with a native <input type="range"> styled with CSS accent-color and slider pseudo-elements.';
}

export const sliderJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['noUiSlider', 'nouislider'],
  featureGuardTokens: SLIDER_GUARD_TOKENS,
  matchCall: matchNoUiSliderCreate,
});

export const sliderJsRule: AnalyzerRule = {
  id: 'slider/js-slider',
  guideId: 'slider',
  guideHash: SLIDER_GUIDE_HASH,
  summary:
    'Single-handle noUiSlider.create() calls should be modernized with native HTML <input type="range"> and CSS accent-color.',
  matcher: sliderJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls noUiSlider.create() with a single numeric start value (e.g., start: 50 or start: [50]) to build a basic single-thumb range slider.',
      'Custom drag handle divs calculate percentage left offsets on mousemove for a single numeric value.',
    ],
    dropWhen: [
      'The slider configures multiple handles or thumbs (e.g., start: [20, 80]) for min/max interval selection.',
      'The control is a multi-thumb timeline video scrubbing bar or already uses native <input type="range">.',
    ],
  },
};

export default [
  sliderJsRule,
] satisfies readonly AnalyzerRule[];
