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
  'slideToggle',
  'fadeToggle',
]);

const NON_DOM_TARGET_KEYWORDS = [
  'audio',
  'sound',
  'gain',
  'track',
  'music',
  'player',
  'howler',
  'howl',
  'volume',
  'canvas',
  'ctx',
  'context',
  'camera',
  'scene',
  'screen',
  'stage',
  'speaker',
  'voice',
  'synth',
  'oscillator',
];

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
  const text = targetExpr.getText().trim();
  const lower = text.toLowerCase();

  // jQuery DOM wrapper calls are definitely DOM operations
  if (
    lower.startsWith('$') ||
    lower.startsWith('jquery(') ||
    lower.startsWith('window.$') ||
    lower.startsWith('window.jquery')
  ) {
    return false;
  }

  for (const keyword of NON_DOM_TARGET_KEYWORDS) {
    if (lower === keyword || lower.includes(keyword)) {
      return true;
    }
  }

  if (lower === 'this') {
    const enclosingClass = targetExpr.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (enclosingClass) {
      const className = (enclosingClass.getName() ?? '').toLowerCase();
      for (const keyword of NON_DOM_TARGET_KEYWORDS) {
        if (className.includes(keyword)) {
          return true;
        }
      }
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
    'slideToggle',
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
    'Flag imperative jQuery entry/exit animations (.fadeIn, .fadeOut, .slideDown, .slideUp, .slideToggle, .fadeToggle) or transitionend/animationend listeners that remove or hide elements instead of CSS @starting-style and transition-behavior: allow-discrete.',
  matcher: animateElementEntryExitMatcher,
  verifierRubric: {
    keepWhen: [
      'Imperative jQuery visibility animations (.fadeIn, .fadeOut, .slideDown, .slideUp, .slideToggle, .fadeToggle) used to show, hide, expand, or collapse DOM elements.',
      'DOM event listeners on transitionend or animationend that remove an element from the DOM or set display: none / hidden to simulate discrete exit transitions.',
      'Element visibility transitions coordinated through manual JS event callbacks or timeout flushes instead of CSS @starting-style and transition-behavior: allow-discrete.',
    ],
    dropWhen: [
      'Audio, sound volume, or gain node fades (e.g. audio.fadeIn, sound.fadeOut).',
      'Canvas, WebGL, 3D camera, or game engine rendering transitions (e.g. camera.fadeIn, scene.fadeOut).',
      'Code already protected by @starting-style or allow-discrete feature guards.',
      'Generic transitionend / animationend event listeners that perform business logic or state updates without hiding or removing the DOM element.',
    ],
  },
};

export const animateElementEntryExitRules: readonly AnalyzerRule[] = [
  animateElementEntryExitRule,
];
