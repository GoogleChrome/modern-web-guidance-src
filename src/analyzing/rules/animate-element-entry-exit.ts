/* oxlint-disable max-lines-per-function, max-depth */
import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const ANIMATE_ELEMENT_ENTRY_EXIT_GUIDE_HASH = '21cc4d2bf21c';

const JQUERY_ANIM_METHODS = new Set([
  'fadeIn',
  'fadeOut',
  'slideDown',
  'slideUp',
  'fadeToggle',
]);

const NON_DOM_RECEIVER_NAMES: ReadonlySet<string> = new Set([
  'audio',
  'sound',
  'gain',
  'music',
  'howler',
  'howl',
  'volume',
  'canvas',
  'camera',
  'speaker',
  'voice',
  'synth',
  'oscillator',
  'audiotrack',
  'soundeffect',
  'gainnode',
  'audioplayer',
  'soundplayer',
]);

const TRANSITION_EVENTS = new Set([
  'transitionend',
  'animationend',
  'webkittransitionend',
  'webkitanimationend',
]);

const FEATURE_GUARD_TOKENS = [
  '@starting-style',
  'starting-style',
  'allow-discrete',
  'transition-behavior',
  'canTransitionDisplay',
  'getAnimations',
] as const;

function isNonDomCaller(targetExpr: Node): boolean {
  const unwrapped = unwrapExpression(targetExpr);
  if (Node.isIdentifier(unwrapped)) {
    return NON_DOM_RECEIVER_NAMES.has(unwrapped.getText().trim().toLowerCase());
  }
  if (Node.isPropertyAccessExpression(unwrapped)) {
    return NON_DOM_RECEIVER_NAMES.has(unwrapped.getName().trim().toLowerCase());
  }
  if (Node.isThisExpression(unwrapped)) {
    const enclosingClass = unwrapped.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (enclosingClass) {
      const className = (enclosingClass.getName() ?? '').trim().toLowerCase();
      return (
        NON_DOM_RECEIVER_NAMES.has(className) ||
        /^(?:audio|sound|howl|howler|music|synth|camera)(?:player|manager|controller|engine|track|effect)?$/.test(
          className,
        )
      );
    }
  }
  return false;
}

function callbackHidesOrRemovesElement(fnNode: Node): boolean {
  let found = false;

  fnNode.forEachDescendant((node) => {
    if (found) {
      return;
    }

    // 1. Call expressions: .remove(), .removeChild(), .hide(), etc.
    if (Node.isCallExpression(node)) {
      const expr = unwrapExpression(node.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName();
        const callerExpr = unwrapExpression(expr.getExpression());
        const callerText = callerExpr.getText().toLowerCase();

        // el.remove() or $(el).remove() or this.remove()
        // Skip if caller is classList or eventListener
        if (
          methodName === 'remove' &&
          callerText !== 'classlist' &&
          !callerText.endsWith('.classlist') &&
          callerText !== 'eventlistener'
        ) {
          found = true;
          return;
        }

        // parent.removeChild(el)
        if (methodName === 'removeChild') {
          found = true;
          return;
        }

        // $(el).hide()
        if (methodName === 'hide') {
          found = true;
          return;
        }

        // el.style.setProperty('display', 'none')
        if (methodName === 'setProperty') {
          const args = node.getArguments();
          if (
            args.length >= 2 &&
            args[0]?.getText().replace(/['"]/g, '').toLowerCase() === 'display' &&
            args[1]?.getText().replace(/['"]/g, '').toLowerCase() === 'none'
          ) {
            found = true;
            return;
          }
        }

        // $(el).css('display', 'none') or $(el).css({ display: 'none' })
        if (methodName === 'css') {
          const args = node.getArguments();
          if (
            args.length >= 2 &&
            args[0]?.getText().replace(/['"]/g, '').toLowerCase() === 'display' &&
            args[1]?.getText().replace(/['"]/g, '').toLowerCase() === 'none'
          ) {
            found = true;
            return;
          }
          if (args.length >= 1 && Node.isObjectLiteralExpression(args[0])) {
            const objText = args[0].getText().toLowerCase().replace(/\s+/g, '');
            if (objText.includes("display:'none'") || objText.includes('display:"none"')) {
              found = true;
              return;
            }
          }
        }
      }
    }

    // 2. Binary expressions: el.style.display = 'none', el.hidden = true
    if (Node.isBinaryExpression(node)) {
      const op = node.getOperatorToken().getKind();
      if (op === SyntaxKind.EqualsToken) {
        const left = unwrapExpression(node.getLeft());
        const right = unwrapExpression(node.getRight());
        const rightText = right.getText().replace(/['"]/g, '').trim().toLowerCase();

        if (Node.isPropertyAccessExpression(left)) {
          const propName = left.getName();
          // el.style.display = 'none'
          if (propName === 'display') {
            const leftCaller = unwrapExpression(left.getExpression());
            if (leftCaller.getText().toLowerCase().endsWith('style') && rightText === 'none') {
              found = true;
              return;
            }
          }
          // el.hidden = true
          if (propName === 'hidden' && rightText === 'true') {
            found = true;
            return;
          }
        }
      }
    }
  });

  return found;
}

function resolveCallbackNode(node: Node, sourceFile: SourceFile): Node | null {
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return node;
  }
  if (Node.isIdentifier(node)) {
    const name = node.getText();
    // Search up through lexical ancestor scopes
    let current: Node | undefined = node.getParent();
    while (current) {
      if (
        Node.isBlock(current) ||
        Node.isSourceFile(current) ||
        Node.isFunctionDeclaration(current) ||
        Node.isFunctionExpression(current) ||
        Node.isArrowFunction(current)
      ) {
        const statements = Node.isBlock(current)
          ? current.getStatements()
          : Node.isSourceFile(current)
            ? current.getStatements()
            : [];
        for (const stmt of statements) {
          if (Node.isFunctionDeclaration(stmt) && stmt.getName() === name) {
            return stmt;
          }
          if (Node.isVariableStatement(stmt)) {
            for (const decl of stmt.getDeclarationList().getDeclarations()) {
              if (decl.getName() === name) {
                const init = decl.getInitializer();
                if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
                  return init;
                }
              }
            }
          }
        }
      }
      current = current.getParent();
    }

    // Also check top-level function declarations in source file
    const funcDecl = sourceFile.getFunction(name);
    if (funcDecl) {
      return funcDecl;
    }
  }
  return null;
}

const ENTRY_ANIM_METHODS = new Set(['fadeIn', 'slideDown']);
const EXIT_ANIM_METHODS = new Set(['fadeOut', 'slideUp']);

function getFullCallChainText(node: CallExpression): string {
  let current: Node = node;
  while (true) {
    const parent = current.getParent();
    if (parent && Node.isPropertyAccessExpression(parent)) {
      const grandparent = parent.getParent();
      if (grandparent && Node.isCallExpression(grandparent)) {
        current = grandparent;
        continue;
      }
    }
    break;
  }
  return current.getText();
}

function isChainedDelayAutoDismiss(callExpr: CallExpression): boolean {
  const chainText = getFullCallChainText(callExpr);
  if (!/\.delay\s*\(/.test(chainText)) {
    return false;
  }
  const hasEntry = /\.(?:fadeIn|slideDown)\s*\(/.test(chainText);
  const hasExit = /\.(?:fadeOut|slideUp)\s*\(/.test(chainText);
  return hasEntry && hasExit;
}

function getEnclosingScope(node: Node): Node {
  let current = node.getParent();
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isSourceFile(current)
    ) {
      return current;
    }
    current = current.getParent();
  }
  return node.getSourceFile();
}

function getEnclosingSetTimeout(node: Node): CallExpression | null {
  let current = node.getParent();
  while (current) {
    if (Node.isCallExpression(current)) {
      const expr = unwrapExpression(current.getExpression());
      const calleeText = expr.getText();
      if (calleeText === 'setTimeout' || calleeText === 'window.setTimeout') {
        return current;
      }
    }
    if (Node.isSourceFile(current)) {
      break;
    }
    current = current.getParent();
  }
  return null;
}

function normalizeReceiver(receiverNode: Node): string {
  return receiverNode.getText().trim().replace(/\s+/g, '').replace(/"/g, "'");
}

function isToastAutoDismiss(
  callExpr: CallExpression,
  methodName: string,
  callerExpr: Node,
): boolean {
  if (isChainedDelayAutoDismiss(callExpr)) {
    return true;
  }

  const normReceiver = normalizeReceiver(callerExpr);

  if (ENTRY_ANIM_METHODS.has(methodName)) {
    const scope = getEnclosingScope(callExpr);
    const timeoutCalls = scope.getDescendantsOfKind(SyntaxKind.CallExpression).filter((candidateCall) => {
      const callee = unwrapExpression(candidateCall.getExpression()).getText();
      return callee === 'setTimeout' || callee === 'window.setTimeout';
    });

    for (const timeoutCall of timeoutCalls) {
      const timeoutArgs = timeoutCall.getArguments();
      const callback = timeoutArgs[0] ? unwrapExpression(timeoutArgs[0]) : undefined;
      if (!callback) continue;

      const innerCalls = callback.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const innerCall of innerCalls) {
        const innerExpr = unwrapExpression(innerCall.getExpression());
        if (Node.isPropertyAccessExpression(innerExpr)) {
          const innerMethod = innerExpr.getName();
          if (EXIT_ANIM_METHODS.has(innerMethod)) {
            const innerReceiver = normalizeReceiver(unwrapExpression(innerExpr.getExpression()));
            if (innerReceiver === normReceiver) {
              return true;
            }
          }
        }
      }
    }
  } else if (EXIT_ANIM_METHODS.has(methodName)) {
    const enclosingTimeout = getEnclosingSetTimeout(callExpr);
    if (enclosingTimeout) {
      const outerScope = getEnclosingScope(enclosingTimeout);
      const outerCalls = outerScope.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const outerCall of outerCalls) {
        if (
          outerCall.getStart() >= enclosingTimeout.getStart() &&
          outerCall.getEnd() <= enclosingTimeout.getEnd()
        ) {
          continue;
        }
        const outerExpr = unwrapExpression(outerCall.getExpression());
        if (Node.isPropertyAccessExpression(outerExpr)) {
          const outerMethod = outerExpr.getName();
          if (ENTRY_ANIM_METHODS.has(outerMethod)) {
            const outerReceiver = normalizeReceiver(unwrapExpression(outerExpr.getExpression()));
            if (outerReceiver === normReceiver) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

function isChainedHideAndShowFlash(callExpr: CallExpression): boolean {
  let root: Node = callExpr;
  // Walk up property access / call chains
  while (true) {
    const parent = root.getParent();
    if (parent && Node.isPropertyAccessExpression(parent)) {
      const grandparent = parent.getParent();
      if (grandparent && Node.isCallExpression(grandparent)) {
        root = grandparent;
        continue;
      }
    }
    break;
  }
  const chainText = root.getText();
  // Exclude `.append(...)` or `.appendTo(...)` where a newly created element is hidden then faded in,
  // e.g. `$('<div>').appendTo('body')...show().delay(time).fadeOut()`, which is handled by isToastAutoDismiss.
  if (/\.(?:append|appendTo|prepend|prependTo)\s*\(/.test(chainText)) {
    return false;
  }
  const hasHide = /\.(?:hide|fadeOut)\s*\(/.test(chainText);
  const hasShow = /\.(?:show|fadeIn)\s*\(/.test(chainText);
  return hasHide && hasShow;
}

function isNonJQueryHelperFadeCall(callExpr: CallExpression): boolean {
  const args = callExpr.getArguments();
  if (args.length >= 2) {
    const firstArg = unwrapExpression(args[0]);
    const secondArg = unwrapExpression(args[1]);
    // Helper utility pattern `fadeOut(element, 5)` where arg0 is a DOM element/call and arg1 is a numeric duration
    if (
      !Node.isNumericLiteral(firstArg) &&
      !Node.isStringLiteral(firstArg) &&
      Node.isNumericLiteral(secondArg)
    ) {
      return true;
    }
  }
  return false;
}

function isAccordionOrSubmenuHeightSlide(
  callExpr: CallExpression,
  methodName: string,
  callerExpr: Node,
): boolean {
  if (methodName !== 'slideDown' && methodName !== 'slideUp') {
    return false;
  }
  const callerText = callerExpr.getText();
  // Skip submenu / accordion / collapsible panel height animations
  if (
    /\.(?:closest|next|prev|children|parent|parents|siblings)\s*\(/.test(callerText) ||
    /\b(?:content|collapsible|accordion|submenu|sub-menu|dropdown|faq|panel)\b/i.test(callerText)
  ) {
    return true;
  }
  // Skip slideUp/slideDown inside a nested jQuery animation callback (e.g. fadeOut -> hide -> slideUp)
  let current: Node | undefined = callExpr.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isCallExpression(current)) {
      const expr = unwrapExpression(current.getExpression());
      if (
        Node.isPropertyAccessExpression(expr) &&
        /^(?:fadeIn|fadeOut|hide|show|slideUp|slideDown|animate)$/.test(expr.getName())
      ) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchJQueryAnim(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (!JQUERY_ANIM_METHODS.has(methodName)) {
    return null;
  }

  const callerExpr = unwrapExpression(expr.getExpression());
  if (isNonDomCaller(callerExpr)) {
    return null;
  }

  if (isNonJQueryHelperFadeCall(callExpr)) {
    return null;
  }

  if (isAccordionOrSubmenuHeightSlide(callExpr, methodName, callerExpr)) {
    return null;
  }

  if (isChainedHideAndShowFlash(callExpr)) {
    return null;
  }

  if (isToastAutoDismiss(callExpr, methodName, callerExpr)) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, FEATURE_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Imperative jQuery visibility animation (.${methodName}) used instead of CSS @starting-style and transition-behavior: allow-discrete`,
  };
}

function matchTransitionEndListener(
  callExpr: CallExpression,
  sourceFile: SourceFile,
): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (!['addEventListener', 'on', 'one', 'bind'].includes(methodName)) {
    return null;
  }

  // Skip delegated listeners attached to parentNode / parentElement / document / window
  const receiverText = unwrapExpression(expr.getExpression()).getText().trim();
  if (
    /\.(?:parentNode|parentElement)$/.test(receiverText) ||
    receiverText === 'document' ||
    receiverText === 'window' ||
    receiverText === 'document.body'
  ) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 2) {
    return null;
  }

  const firstArg = unwrapExpression(args[0]);
  const eventText = firstArg.getText().replace(/['"]/g, '').toLowerCase();
  const eventTokens = eventText.split(/\s+/);
  const matchedEvent = eventTokens.find((t) => TRANSITION_EVENTS.has(t));
  if (!matchedEvent) {
    return null;
  }

  const callbackArg = unwrapExpression(args[args.length - 1]);
  const callbackNode = resolveCallbackNode(callbackArg, sourceFile);
  if (!callbackNode) {
    return null;
  }

  if (!callbackHidesOrRemovesElement(callbackNode)) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, FEATURE_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Imperative ${matchedEvent} listener used to hide or remove element instead of CSS @starting-style and transition-behavior: allow-discrete`,
  };
}

export const animateElementEntryExitMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'fadeIn',
    'fadeOut',
    'slideDown',
    'slideUp',
    'fadeToggle',
    'transitionend',
    'animationend',
    'webkittransitionend',
    'webkitanimationend',
    'ontransitionend',
    'onanimationend',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      const animMatch = matchJQueryAnim(callExpr);
      if (animMatch) {
        matches.push(animMatch);
        continue;
      }

      const listenerMatch = matchTransitionEndListener(callExpr, sourceFile);
      if (listenerMatch) {
        matches.push(listenerMatch);
      }
    }

    return matches;
  },
};

export const animateElementEntryExitRule: AnalyzerRule = {
  id: 'animate-element-entry-exit',
  guideId: 'animate-element-entry-exit',
  guideHash: ANIMATE_ELEMENT_ENTRY_EXIT_GUIDE_HASH,
  summary:
    'Flag imperative jQuery entry/exit fade animations (.fadeIn, .fadeOut, .fadeToggle) or transitionend/animationend listeners that remove or hide elements instead of CSS @starting-style and transition-behavior: allow-discrete.',
  matcher: animateElementEntryExitMatcher,
  verifierRubric: {
    keepWhen: [
      'Imperative jQuery visibility animations (.fadeIn, .fadeOut, .slideDown, .slideUp, .fadeToggle) used to show or hide DOM elements during entry or exit.',
      'Direct DOM event listeners on transitionend or animationend on the animated element that remove the element from the DOM or set display: none / hidden to simulate discrete exit transitions.',
      'Element visibility transitions coordinated through manual JS event callbacks or timeout flushes instead of CSS @starting-style and transition-behavior: allow-discrete.',
    ],
    dropWhen: [
      'Audio, sound volume, or gain node fades (e.g. audio.fadeIn, sound.fadeOut).',
      'Canvas, WebGL, 3D camera, or game engine rendering transitions (e.g. camera.fadeIn, scene.fadeOut).',
      'Accordion, collapsible panel, or dropdown submenu height toggle animations (.slideToggle, or .slideDown/.slideUp on accordion/submenu content) that interpolate height between 0 and auto.',
      'Chained flash/attention effects on an already-present element (e.g. $tag.hide().fadeIn() or $el.fadeOut().fadeIn()).',
      'Code already protected by @starting-style or allow-discrete feature guards.',
    ],
  },
};

export default [
  animateElementEntryExitRule,
] satisfies readonly AnalyzerRule[];
