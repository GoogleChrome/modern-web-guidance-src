import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

const SIBLING_STATE_COMBINATOR_REGEX =
  /(?::(checked|focus|focus-visible|focus-within|valid|invalid)|:not\(\s*:(checked|focus|focus-visible|focus-within|valid|invalid)\s*\))\s*[+~]\s*\S+/i;

const FORM_EVENT_NAMES = new Set([
  'focus',
  'blur',
  'focusin',
  'focusout',
  'change',
  'input',
]);

const PURE_STYLING_STATE_CLASS_REGEX =
  /^(?:is-|has-)?(?:focus|focused|active|checked|valid|invalid|empty|filled|value)$/i;

function hasDelegationOrStateManagement(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      const text = current.getText();
      // Skip general event delegation or app state management
      if (
        text.includes('.matches(') ||
        text.includes('e.target.matches') ||
        text.includes('setState(') ||
        text.includes('dispatch(') ||
        text.includes('router.') ||
        text.includes('history.push')
      ) {
        return true;
      }
      break;
    }
    current = current.getParent();
  }
  return false;
}

const childStateBasedStylingCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [':checked', ':focus', ':valid', ':invalid'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already leverages modern :has(), skip
    if (ctx.stylesheetHasValue(':has(')) {
      return null;
    }

    // 2. Selector must use a sibling combinator (+ or ~) following an input state pseudo-class
    if (!SIBLING_STATE_COMBINATOR_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    return {
      message:
        'CSS rule uses sibling combinators (+ or ~) following input state pseudo-classes to style adjacent elements; modernize using container :has() selector.',
    };
  },
};

function refersToParentNavigation(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isPropertyAccessExpression(unwrapped)) {
    const propName = unwrapped.getName();
    if (propName === 'parentElement' || propName === 'parentNode') {
      return true;
    }
  }
  if (Node.isCallExpression(unwrapped)) {
    const callExpr = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(callExpr) && callExpr.getName() === 'closest') {
      return true;
    }
  }
  if (Node.isIdentifier(unwrapped)) {
    const resolved = resolveLocalExpression(unwrapped);
    if (resolved !== unwrapped) {
      return refersToParentNavigation(resolved);
    }
  }
  return false;
}

function isFormEventCall(call: CallExpression): boolean {
  const callExpr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(callExpr)) {
    return false;
  }
  const method = callExpr.getName();
  if (FORM_EVENT_NAMES.has(method)) {
    return true;
  }
  if (method !== 'addEventListener' && method !== 'on' && method !== 'bind') {
    return false;
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return false;
  }
  const firstArg = unwrapExpression(args[0] as Node);
  if (!Node.isStringLiteral(firstArg)) {
    return false;
  }
  const eventName = firstArg.getLiteralText().toLowerCase().trim();
  return FORM_EVENT_NAMES.has(eventName);
}

function isEnclosedInFormEventHandler(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isCallExpression(current) && isFormEventCall(current)) {
      return true;
    }
    if (Node.isBinaryExpression(current)) {
      const left = unwrapExpression(current.getLeft());
      if (Node.isPropertyAccessExpression(left)) {
        const prop = left.getName().toLowerCase();
        if (
          prop === 'onfocus' ||
          prop === 'onblur' ||
          prop === 'onchange' ||
          prop === 'oninput'
        ) {
          return true;
        }
      }
    } else if (
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current)
    ) {
      const fnName = (current.getName() ?? '').toLowerCase();
      if (
        fnName.includes('focus') ||
        fnName.includes('blur') ||
        fnName.includes('change') ||
        fnName.includes('input')
      ) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

const childStateBasedStylingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['classList', 'parentElement', 'parentNode', 'closest'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const callExpr = unwrapExpression(node.getExpression());
      if (!Node.isPropertyAccessExpression(callExpr)) {
        return;
      }

      const method = callExpr.getName();
      if (method !== 'add' && method !== 'remove' && method !== 'toggle') {
        return;
      }

      const classListObj = unwrapExpression(callExpr.getExpression());
      if (!Node.isPropertyAccessExpression(classListObj) || classListObj.getName() !== 'classList') {
        return;
      }

      const targetElement = classListObj.getExpression();
      if (!refersToParentNavigation(targetElement)) {
        return;
      }

      const args = node.getArguments();
      const hasStateClass = args.some((arg) => {
        const unwrappedArg = unwrapExpression(arg);
        if (Node.isStringLiteral(unwrappedArg)) {
          return PURE_STYLING_STATE_CLASS_REGEX.test(unwrappedArg.getLiteralText());
        }
        return false;
      });

      if (!hasStateClass) {
        return;
      }

      if (!isEnclosedInFormEventHandler(node)) {
        return;
      }

      if (hasDelegationOrStateManagement(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, [':has', 'has('])) {
        return;
      }

      const line = node.getStartLineNumber();
      if (!visitedLines.has(line)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'JavaScript event listener toggles state class on parent element to coordinate container styling; replace with CSS :has() selector on the container.',
        });
      }
    });

    return matches;
  },
};

export const childStateBasedStylingRule: AnalyzerRule = {
  id: 'child-state-based-styling',
  guideId: 'child-state-based-styling',
  guideHash: '70dc57b74e35',
  summary:
    'Sibling combinators (+ or ~) following form control state pseudo-classes simulate container state styling; replace with container :has() selectors.',
  matcher: childStateBasedStylingCssMatcher,
  verifierRubric: {
    keepWhen: [
      'The CSS rule uses sibling combinators (+ or ~) following input state pseudo-classes (:checked, :focus, :valid, :invalid) such as input:checked + label or :focus ~ .element to simulate parent or container state styling.',
      'The styling coordinates visual states between a form control and an adjacent element that can be refactored into a parent container styled with :has().',
    ],
    dropWhen: [
      'The stylesheet already uses the :has() selector.',
      'The rule is part of a fallback guarded by @supports not selector(:has(*)).',
      'The sibling element is an inline native replacement box where the input itself is styled independently without container implications.',
    ],
  },
};

export const childStateBasedStylingJsParentClassRule: AnalyzerRule = {
  id: 'child-state-based-styling/js-parent-class',
  guideId: 'child-state-based-styling',
  guideHash: '70dc57b74e35',
  summary:
    'JavaScript form control event listeners toggle classes on parent/closest containers to simulate container state styling; replace with CSS container :has() selectors.',
  matcher: childStateBasedStylingJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A JavaScript event listener on a form input (focus, blur, change, or input) toggles state classes (focus, active, checked, valid, invalid, empty, filled, has-value) on parentElement, parentNode, or closest(...) to visually style the parent container.',
      'The parent state synchronization can be replaced by the native CSS :has() selector on the container (e.g. .field:has(:focus) or .field:has(:checked)).',
    ],
    dropWhen: [
      'The parent class mutation triggers non-styling application state changes, form wizard navigation, or analytics.',
      'The listener manages modal dialog or dropdown overlay opening/closing rather than input state styling.',
      'The code is guarded by a feature query checking support for CSS :has().',
    ],
  },
};

export default [
  childStateBasedStylingRule,
  childStateBasedStylingJsParentClassRule,
] satisfies readonly AnalyzerRule[];
