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

const FORM_EVENT_NAMES = new Set(['focus', 'blur', 'focusin', 'focusout', 'change', 'input']);
const PURE_STYLING_STATE_CLASS_REGEX =
  /^(?:is-|has-)?(?:focus|focused|active|checked|valid|invalid|empty|filled|value)$/i;
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
const JQUERY_VALIDITY_EVENT_NAMES = new Set(['blur input', 'input blur', 'input']);
const ALLOWED_HANDLER_METHODS = new Set([
  'closest',
  'checkValidity',
  'preventDefault',
  'stopPropagation',
]);

function isAllowedCallInsideNativeHandler(call: CallExpression): boolean {
  const callee = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) return false;
  const name = callee.getName();
  if (ALLOWED_HANDLER_METHODS.has(name)) return true;
  if (name === 'add' || name === 'remove' || name === 'toggle') {
    const target = unwrapExpression(callee.getExpression());
    return Node.isPropertyAccessExpression(target) && target.getName() === 'classList';
  }
  return false;
}

function hasDisallowedHandlerCalls(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      let hasDisallowed = false;
      current.forEachDescendant((desc) => {
        if (Node.isCallExpression(desc) && !isAllowedCallInsideNativeHandler(desc)) {
          hasDisallowed = true;
        }
      });
      return hasDisallowed;
    }
    current = current.getParent();
  }
  return false;
}

function refersToParentNavigation(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isPropertyAccessExpression(unwrapped)) {
    const propName = unwrapped.getName();
    return propName === 'parentElement' || propName === 'parentNode';
  }
  if (Node.isCallExpression(unwrapped)) {
    const callExpr = unwrapExpression(unwrapped.getExpression());
    return Node.isPropertyAccessExpression(callExpr) && callExpr.getName() === 'closest';
  }
  if (Node.isIdentifier(unwrapped)) {
    const resolved = resolveLocalExpression(unwrapped);
    return resolved !== unwrapped && refersToParentNavigation(resolved);
  }
  return false;
}

function isFormEventCall(call: CallExpression): boolean {
  const callExpr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(callExpr)) return false;
  const method = callExpr.getName();
  if (FORM_EVENT_NAMES.has(method)) return true;
  if (method !== 'addEventListener' && method !== 'on' && method !== 'bind') return false;
  const firstArgNode = call.getArguments()[0];
  if (!firstArgNode) return false;
  const firstArg = unwrapExpression(firstArgNode);
  return (
    Node.isStringLiteral(firstArg) &&
    FORM_EVENT_NAMES.has(firstArg.getLiteralText().toLowerCase().trim())
  );
}

function isEnclosedInFormEventHandler(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isCallExpression(current) && isFormEventCall(current)) return true;
    if (Node.isBinaryExpression(current)) {
      const left = unwrapExpression(current.getLeft());
      if (
        Node.isPropertyAccessExpression(left) &&
        /^on(?:focus|blur|change|input)$/i.test(left.getName())
      ) {
        return true;
      }
    } else if (Node.isFunctionDeclaration(current) || Node.isMethodDeclaration(current)) {
      if (/(?:focus|blur|change|input)/i.test(current.getName() ?? '')) return true;
    }
    current = current.getParent();
  }
  return false;
}

function isJQuerySelfOrInputWrapper(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.getExpression());
    if (Node.isIdentifier(callee) && (callee.getText() === '$' || callee.getText() === 'jQuery')) {
      const argText = unwrapped.getArguments()[0]?.getText().trim() ?? '';
      return /^(?:this|(?:e|event)\.(?:target|currentTarget))$/.test(argText);
    }
  }
  if (Node.isIdentifier(unwrapped)) {
    const resolved = resolveLocalExpression(unwrapped);
    return resolved !== unwrapped && isJQuerySelfOrInputWrapper(resolved);
  }
  return false;
}

function inspectToggleConditionAst(condNode: Node): { allowed: boolean; usesValidity: boolean } {
  let hasDisallowedNode = false;
  let usesValidity = false;
  let usesEventType = false;

  const checkNode = (n: Node) => {
    if (Node.isCallExpression(n)) {
      const callee = unwrapExpression(n.getExpression());
      if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'checkValidity') {
        usesValidity = true;
      } else {
        hasDisallowedNode = true;
      }
    } else if (Node.isPropertyAccessExpression(n)) {
      const prop = n.getName();
      if (prop === 'value' || prop === 'length') hasDisallowedNode = true;
      else if (prop === 'validity' || prop === 'valid') usesValidity = true;
      else if (prop === 'type') usesEventType = true;
    }
  };

  checkNode(condNode);
  condNode.forEachDescendant(checkNode);
  return { allowed: !hasDisallowedNode && (usesValidity || usesEventType), usesValidity };
}

function isJQueryParentClassToggle(node: CallExpression): boolean {
  const callExpr = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(callExpr)) return false;

  const method = callExpr.getName();
  if (method !== 'addClass' && method !== 'removeClass' && method !== 'toggleClass') return false;

  const args = node.getArguments();
  const firstArgNode = args[0];
  if (!firstArgNode || args.length > 2) return false;

  const firstArg = unwrapExpression(firstArgNode);
  if (
    !Node.isStringLiteral(firstArg) ||
    !/(?:focus|valid|invalid|checked)/i.test(firstArg.getLiteralText())
  ) {
    return false;
  }

  let usesValidityCheck = false;
  const secondArgNode = args[1];
  if (secondArgNode) {
    if (method !== 'toggleClass') return false;
    const condInfo = inspectToggleConditionAst(secondArgNode);
    if (!condInfo.allowed) return false;
    usesValidityCheck = condInfo.usesValidity;
  }

  const parentCall = unwrapExpression(callExpr.getExpression());
  if (!Node.isCallExpression(parentCall)) return false;
  const parentCallExpr = unwrapExpression(parentCall.getExpression());
  if (!Node.isPropertyAccessExpression(parentCallExpr)) return false;

  const parentMethod = parentCallExpr.getName();
  if (parentMethod !== 'parent' && parentMethod !== 'parents' && parentMethod !== 'closest') {
    return false;
  }

  const parentArgs = parentCall.getArguments();
  const firstParentArg = parentArgs[0];
  if (parentArgs.length > 1) return false;
  if (parentMethod === 'parents' || parentMethod === 'closest' || firstParentArg) {
    if (!firstParentArg) return false;
    const selArg = unwrapExpression(firstParentArg);
    if (!Node.isStringLiteral(selArg) || selArg.getLiteralText().trim().length === 0) return false;
  }

  if (!isJQuerySelfOrInputWrapper(parentCallExpr.getExpression())) return false;

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
  if (Node.isBlock(body) && body.getStatements().length !== 1) return false;

  const bindCall = enclosingFn.getParent();
  if (!bindCall || !Node.isCallExpression(bindCall)) return false;
  const bindCallee = unwrapExpression(bindCall.getExpression());
  if (!Node.isPropertyAccessExpression(bindCallee)) return false;

  const bindMethod = bindCallee.getName();
  if (/^(?:focus|blur|focusin|focusout)$/.test(bindMethod)) {
    return bindCall.getArguments().length === 1 && !usesValidityCheck;
  }

  if (bindMethod === 'on' || bindMethod === 'bind') {
    const bindArgs = bindCall.getArguments();
    const firstBindArg = bindArgs[0];
    if (!firstBindArg || (bindArgs.length !== 2 && bindArgs.length !== 3)) return false;
    const evArg = unwrapExpression(firstBindArg);
    if (!Node.isStringLiteral(evArg)) return false;
    if (bindArgs.length === 3 && bindArgs[1]) {
      const delArg = unwrapExpression(bindArgs[1]);
      if (
        !Node.isStringLiteral(delArg) ||
        !/\b(?:input|select|textarea)\b/i.test(delArg.getLiteralText())
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
  fastTokens: [
    ['.classList.', '.addClass(', '.removeClass(', '.toggleClass('],
    ['.parentElement', '.parentNode', '.closest(', '.parent(', '.parents('],
    [
      'focus',
      'Focus',
      'blur',
      'Blur',
      'focusin',
      'focusout',
      "'change'",
      '"change"',
      '`change`',
      '.change(',
      'onchange',
      'onChange',
      "'input'",
      '"input"',
      '`input`',
      "'blur input'",
      '"blur input"',
      "'input blur'",
      '"input blur"',
      '.input(',
      'oninput',
      'onInput',
    ],
    [
      'focus',
      'Focus',
      'active',
      'Active',
      'checked',
      'Checked',
      'valid',
      'Valid',
      'empty',
      'Empty',
      'filled',
      'Filled',
      'value',
      'Value',
    ],
  ],
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

      if (hasDisallowedHandlerCalls(node)) {
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
      'A JavaScript or jQuery event listener on a form control (focus, blur, focusin, focusout, change, or input) toggles state classes (focus, focused, active, checked, valid, invalid, empty, filled, has-value) on parentElement, parentNode, closest(...), $(this).parent(...), or $(this).parents(...) to visually style the parent container.',
      'The parent state synchronization can be replaced by the native CSS :has() selector on the container (e.g. .field:has(:focus) or .field:has(:invalid)).',
    ],
    dropWhen: [
      'The listener also triggers imperative JavaScript animations, non-styling application state changes, form wizard navigation, or analytics.',
      'The listener manages modal dialog or dropdown overlay opening/closing rather than form input container state styling.',
      'The code is guarded by a feature query checking support for CSS :has().',
    ],
  },
};

export default [
  childStateBasedStylingJsParentClassRule,
] satisfies readonly AnalyzerRule[];
