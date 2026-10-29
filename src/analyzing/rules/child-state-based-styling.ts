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
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

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

const JQUERY_PARENT_STATE_CLASS_REGEX =
  /^(?:(?:is|has|a|input|input-group|form|form-group|field)-){0,2}(?:focus|focused|valid|invalid)$/i;

const JQUERY_CONTAINER_SELECTOR_REGEX =
  /\b(?:form-group|input-group|form-line|field|input|label)\b/i;

const JQUERY_FOCUS_EVENT_NAMES = new Set([
  'focus',
  'blur',
  'focusin',
  'focusout',
  'focus blur',
  'blur focus',
  'focusin focusout',
  'focusout focusin',
]);

const JQUERY_VALIDITY_EVENT_NAMES = new Set([
  'blur input',
  'input blur',
  'input',
]);

function isAllowedCallInsideNativeHandler(call: CallExpression): boolean {
  const callee = unwrapExpression(call.getExpression());
  if (Node.isPropertyAccessExpression(callee)) {
    const name = callee.getName();
    if (name === 'closest' || name === 'checkValidity') {
      return true;
    }
    if (name === 'add' || name === 'remove' || name === 'toggle') {
      const target = unwrapExpression(callee.getExpression());
      return Node.isPropertyAccessExpression(target) && target.getName() === 'classList';
    }
  }
  return false;
}

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
      let hasDisallowedCall = false;
      current.forEachDescendant((desc) => {
        if (Node.isCallExpression(desc) && !isAllowedCallInsideNativeHandler(desc)) {
          hasDisallowedCall = true;
        }
      });
      if (hasDisallowedCall) {
        return true;
      }
      break;
    }
    current = current.getParent();
  }
  return false;
}

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
  const firstArgNode = args[0];
  if (!firstArgNode) {
    return false;
  }
  const firstArg = unwrapExpression(firstArgNode);
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

function isJQuerySelfOrInputWrapper(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.getExpression());
    if (Node.isIdentifier(callee)) {
      const fnName = callee.getText();
      if (fnName === '$' || fnName === 'jQuery') {
        const argText = unwrapped.getArguments()[0]?.getText().trim() ?? '';
        return (
          argText === 'this' ||
          argText === 'e.target' ||
          argText === 'e.currentTarget' ||
          argText === 'event.target' ||
          argText === 'event.currentTarget'
        );
      }
    }
  }
  if (Node.isIdentifier(unwrapped)) {
    const idText = unwrapped.getText();
    if (idText === '$this' || idText === '$input' || idText === 'input') {
      return true;
    }
    const resolved = resolveLocalExpression(unwrapped);
    if (resolved !== unwrapped) {
      return isJQuerySelfOrInputWrapper(resolved);
    }
  }
  return false;
}

function isJQueryParentClassToggle(node: CallExpression): boolean {
  const callExpr = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(callExpr)) {
    return false;
  }

  const method = callExpr.getName();
  if (method !== 'addClass' && method !== 'removeClass' && method !== 'toggleClass') {
    return false;
  }

  const args = node.getArguments();
  const firstArgNode = args[0];
  if (!firstArgNode || args.length > 2) {
    return false;
  }

  const firstArg = unwrapExpression(firstArgNode);
  if (
    !Node.isStringLiteral(firstArg) ||
    !JQUERY_PARENT_STATE_CLASS_REGEX.test(firstArg.getLiteralText().trim())
  ) {
    return false;
  }

  let usesValidityCheck = false;
  const secondArgNode = args[1];
  if (secondArgNode) {
    if (method !== 'toggleClass') {
      return false;
    }
    const condText = secondArgNode.getText();
    if (condText.includes('value') || condText.includes('.val(')) {
      return false;
    }
    usesValidityCheck = /\b(?:validity|checkValidity)\b/.test(condText);
    const usesEventTypeCheck = /\b(?:e|event|evt)\.type\b/.test(condText);
    if (!usesValidityCheck && !usesEventTypeCheck) {
      return false;
    }
  }

  const parentCall = unwrapExpression(callExpr.getExpression());
  if (!Node.isCallExpression(parentCall)) {
    return false;
  }
  const parentCallExpr = unwrapExpression(parentCall.getExpression());
  if (!Node.isPropertyAccessExpression(parentCallExpr)) {
    return false;
  }
  const parentMethod = parentCallExpr.getName();
  if (
    parentMethod !== 'parent' &&
    parentMethod !== 'parents' &&
    parentMethod !== 'closest'
  ) {
    return false;
  }

  const parentArgs = parentCall.getArguments();
  const firstParentArg = parentArgs[0];
  if (parentMethod === 'parents' || parentMethod === 'closest') {
    if (!firstParentArg || parentArgs.length !== 1) {
      return false;
    }
    const selArg = unwrapExpression(firstParentArg);
    if (
      !Node.isStringLiteral(selArg) ||
      !JQUERY_CONTAINER_SELECTOR_REGEX.test(selArg.getLiteralText())
    ) {
      return false;
    }
  } else if (parentArgs.length > 1) {
    return false;
  } else if (firstParentArg) {
    const selArg = unwrapExpression(firstParentArg);
    if (
      !Node.isStringLiteral(selArg) ||
      !JQUERY_CONTAINER_SELECTOR_REGEX.test(selArg.getLiteralText())
    ) {
      return false;
    }
  }

  if (!isJQuerySelfOrInputWrapper(parentCallExpr.getExpression())) {
    return false;
  }

  let enclosingFn: Node | undefined = node.getParent();
  while (
    enclosingFn &&
    !Node.isSourceFile(enclosingFn) &&
    !Node.isFunctionExpression(enclosingFn) &&
    !Node.isArrowFunction(enclosingFn) &&
    !Node.isFunctionDeclaration(enclosingFn)
  ) {
    enclosingFn = enclosingFn.getParent();
  }
  if (
    !enclosingFn ||
    (!Node.isFunctionExpression(enclosingFn) && !Node.isArrowFunction(enclosingFn))
  ) {
    return false;
  }

  const body = enclosingFn.getBody();
  if (Node.isBlock(body) && body.getStatements().length !== 1) {
    return false;
  }

  const bindCall = enclosingFn.getParent();
  if (!bindCall || !Node.isCallExpression(bindCall)) {
    return false;
  }
  const bindCallee = unwrapExpression(bindCall.getExpression());
  if (!Node.isPropertyAccessExpression(bindCallee)) {
    return false;
  }

  const bindMethod = bindCallee.getName();
  if (
    bindMethod === 'focus' ||
    bindMethod === 'blur' ||
    bindMethod === 'focusin' ||
    bindMethod === 'focusout'
  ) {
    return bindCall.getArguments().length === 1 && !usesValidityCheck;
  }

  if (bindMethod === 'on' || bindMethod === 'bind') {
    const bindArgs = bindCall.getArguments();
    const firstBindArg = bindArgs[0];
    if (!firstBindArg || (bindArgs.length !== 2 && bindArgs.length !== 3)) {
      return false;
    }
    const evArg = unwrapExpression(firstBindArg);
    if (!Node.isStringLiteral(evArg)) {
      return false;
    }
    const secondBindArg = bindArgs[1];
    if (bindArgs.length === 3 && secondBindArg) {
      const delArg = unwrapExpression(secondBindArg);
      if (
        !Node.isStringLiteral(delArg) ||
        !/\b(?:input|select|textarea|form-control|field)\b/i.test(delArg.getLiteralText())
      ) {
        return false;
      }
    }
    const evName = evArg.getLiteralText().toLowerCase().trim().replace(/\s+/g, ' ');
    return (
      JQUERY_FOCUS_EVENT_NAMES.has(evName) ||
      (usesValidityCheck && JQUERY_VALIDITY_EVENT_NAMES.has(evName))
    );
  }

  return false;
}

export const childStateBasedStylingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['classList', 'addClass', 'removeClass', 'toggleClass'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, [':has', 'has('])) {
        return;
      }

      if (isJQueryParentClassToggle(node)) {
        const line = node.getStartLineNumber();
        if (!visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'JavaScript event listener toggles state class on parent element to coordinate container styling; replace with CSS :has() selector on the container.',
          });
        }
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

export const childStateBasedStylingJsParentClassRule: AnalyzerRule = {
  id: 'child-state-based-styling/js-parent-class',
  guideId: 'child-state-based-styling',
  guideHash: '70dc57b74e35',
  summary:
    'JavaScript form control event listeners toggle classes on parent/closest containers to simulate container state styling; replace with CSS container :has() selectors.',
  matcher: childStateBasedStylingJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A JavaScript or jQuery event listener on a form control (focus, blur, focusin, focusout, change, or input) toggles state classes (e.g. focus, focused, input-group-focus, a-input-focus, is-focused, valid, invalid, is-valid, is-invalid, has-value) on parentElement, parentNode, closest(...), $(this).parent(...), or $(this).parents(...) to visually style the parent container.',
      'The parent state synchronization can be replaced by the native CSS :has() selector on the container (e.g. .input-group:has(:focus) or .field:has(:invalid)).',
    ],
    dropWhen: [
      'The listener also triggers imperative JavaScript animations (e.g. setTimeout letter animations), non-styling application state changes, form wizard navigation, or analytics.',
      'The listener manages modal dialog or dropdown overlay opening/closing rather than form input container state styling.',
      'The code is guarded by a feature query checking support for CSS :has().',
    ],
  },
};

export default [
  childStateBasedStylingJsParentClassRule,
] satisfies readonly AnalyzerRule[];
