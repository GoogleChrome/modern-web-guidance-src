import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';
import { unwrapExpression } from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';

export const PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH = '7d10dd62dcbc';

const FULLSCREEN_ONLY_REGEX = /fullscreen/i;

const MODAL_OR_OVERLAY_WORD_REGEX =
  /\b(?:dialog|modal|drawer|lightbox|popup|overlay|showmodal)\b/i;

const MODAL_OR_OVERLAY_CAMEL_REGEX =
  /[a-z](?:Dialog|Modal|Drawer|Lightbox|Popup|Overlay|ShowModal)(?![a-z])|(?:\b|_)(?:[dD]ialog|[mM]odal|[dD]rawer|[lL]ightbox|[pP]opup|[oO]verlay|[sS]howModal)[A-Z]/;

const NON_DRAWER_MODAL_WORD_REGEX =
  /\b(?:dialog|modal|lightbox|popup|overlay|showmodal)\b/i;

const NON_DRAWER_MODAL_CAMEL_REGEX =
  /[a-z](?:Dialog|Modal|Lightbox|Popup|Overlay|ShowModal)(?![a-z])|(?:\b|_)(?:[dD]ialog|[mM]odal|[lL]ightbox|[pP]opup|[oO]verlay|[sS]howModal)[A-Z]/;

function hasNonDrawerModalName(text: string): boolean {
  return NON_DRAWER_MODAL_WORD_REGEX.test(text) || NON_DRAWER_MODAL_CAMEL_REGEX.test(text);
}

const SIDEBAR_NAVIGATION_DRAWER_REGEX = /\b(?:PerfectScrollbar|Sidebar|mobileOpen)\b/;

function hasModalOrOverlayName(text: string): boolean {
  return MODAL_OR_OVERLAY_WORD_REGEX.test(text) || MODAL_OR_OVERLAY_CAMEL_REGEX.test(text);
}

function getCallableOrClassName(node: Node): string {
  if (
    Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isClassDeclaration(node)
  ) {
    return node.getName() ?? '';
  }
  const parent = node.getParent();
  if (!parent) {
    return '';
  }
  if (Node.isVariableDeclaration(parent) || Node.isPropertyAssignment(parent)) {
    return parent.getName();
  }
  if (
    Node.isBinaryExpression(parent) &&
    parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
    parent.getRight() === node
  ) {
    return parent.getLeft().getText();
  }
  return '';
}

const FULLSCREEN_CANVAS_GAME_REGEX =
  /\b(?:fullscreen|canvas|game|slide|deck|threejs|pixi)\b/i;

const CSS_MODAL_CONTEXT_REGEX = /(?:\b(?:dialog|modal|lightbox|popup|overlay)\b|::backdrop)/i;

function isImmediatelyInvokedFunction(fnNode: Node): boolean {
  let parent: Node | undefined = fnNode.getParent();
  while (
    parent &&
    (Node.isParenthesizedExpression(parent) || Node.isPrefixUnaryExpression(parent))
  ) {
    parent = parent.getParent();
  }
  if (!parent || !Node.isCallExpression(parent)) {
    return false;
  }
  return unwrapExpression(parent.getExpression()) === fnNode;
}

const EFFECT_HOOK_NAMES = new Set([
  'useEffect',
  'useLayoutEffect',
  'watch',
  'watchEffect',
]);

function isEffectHookCallback(fnNode: Node): boolean {
  const parent = fnNode.getParent();
  if (!parent || !Node.isCallExpression(parent)) {
    return false;
  }
  const callee = unwrapExpression(parent.getExpression());
  if (Node.isIdentifier(callee)) {
    return EFFECT_HOOK_NAMES.has(callee.getText());
  }
  if (Node.isPropertyAccessExpression(callee)) {
    return EFFECT_HOOK_NAMES.has(callee.getName());
  }
  return false;
}

function hasNativeDialogContext(node: Node, ctx: JsMatcherContext): boolean {
  let current: Node | undefined = node.getParent();
  let callableDepth = 0;
  let steppedFromEffectHook = false;

  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isClassDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current)
    ) {
      if (isImmediatelyInvokedFunction(current)) {
        break;
      }
      const text = current.getText();
      if (text.length > 8_000) {
        break;
      }
      if (/\bPerfectScrollbar\b/.test(text)) {
        return false;
      }
      if (FULLSCREEN_CANVAS_GAME_REGEX.test(text) && !hasModalOrOverlayName(text)) {
        return false;
      }

      if (callableDepth === 0 || (callableDepth === 1 && steppedFromEffectHook)) {
        const hasCue =
          hasModalOrOverlayName(text) ||
          text.includes('showModal') ||
          text.includes('<dialog');
        if (hasCue) {
          if (
            !hasNonDrawerModalName(text) &&
            !text.includes('<dialog') &&
            SIDEBAR_NAVIGATION_DRAWER_REGEX.test(text)
          ) {
            return false;
          }
          return true;
        }
      } else {
        const scopeName = getCallableOrClassName(current);
        if (hasModalOrOverlayName(scopeName)) {
          if (
            !hasNonDrawerModalName(scopeName) &&
            SIDEBAR_NAVIGATION_DRAWER_REGEX.test(text)
          ) {
            return false;
          }
          return true;
        }
      }

      if (callableDepth === 0) {
        steppedFromEffectHook = isEffectHookCallback(current);
      }
      callableDepth++;
    }
    current = current.getParent();
  }

  if (
    hasModalOrOverlayName(ctx.filePath) &&
    !FULLSCREEN_CANVAS_GAME_REGEX.test(ctx.filePath)
  ) {
    return true;
  }

  return false;
}

const MODAL_SCROLL_LOCK_CLASSES = new Set([
  'modal-open',
  'dialog-open',
  'no-scroll',
  'scroll-lock',
  'overflow-hidden',
]);

const SAME_ELEMENT_SELECTOR_TAIL = '(?:\\.[a-z0-9_-]+|:(?!:)[a-z-]+(?:\\([^)]*\\))?)*$';
const ROOT_MODAL_OPEN_SELECTOR_REGEX = new RegExp(
  `^(?:body|html)?\\.(?:modal-open|dialog-open)${SAME_ELEMENT_SELECTOR_TAIL}`,
  'i',
);
const EXPLICIT_ROOT_LOCK_SELECTOR_REGEX = new RegExp(
  `^(?:body|html)\\.(?:no-scroll|scroll-lock|overflow-hidden)${SAME_ELEMENT_SELECTOR_TAIL}`,
  'i',
);
const BARE_SCROLL_LOCK_CLASS_REGEX = new RegExp(
  `^\\.(?:no-scroll|scroll-lock)${SAME_ELEMENT_SELECTOR_TAIL}`,
  'i',
);

function isScrollLockSelector(
  selectorText: string,
  styleRule: CssRuleView,
  ctx: CssMatcherContext,
): boolean {
  const parts = selectorText.split(',');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (ROOT_MODAL_OPEN_SELECTOR_REGEX.test(part)) {
      return true;
    }
    if (EXPLICIT_ROOT_LOCK_SELECTOR_REGEX.test(part)) {
      return true;
    }
    if (BARE_SCROLL_LOCK_CLASS_REGEX.test(part)) {
      if (
        styleRule.getPropertyValue('-ms-overflow-style') ||
        styleRule.getPropertyValue('scrollbar-width') ||
        /\.no-scroll-[xy]\b/i.test(ctx.stylesheetText)
      ) {
        return false;
      }
      if (
        hasModalOrOverlayName(ctx.filePath) ||
        CSS_MODAL_CONTEXT_REGEX.test(ctx.stylesheetText)
      ) {
        return true;
      }
    }
  }
  return false;
}

function isDocumentRootElement(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();

  if (
    text === 'document.body' ||
    text === 'window.document.body' ||
    text === 'document.documentElement' ||
    text === 'window.document.documentElement' ||
    text === 'body' ||
    text === 'doc.body' ||
    text === 'd.body'
  ) {
    return true;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    const name = unwrapped.getName();
    if (name === 'body' || name === 'documentElement') {
      const callerText = unwrapExpression(unwrapped.getExpression()).getText();
      return (
        callerText === 'document' ||
        callerText === 'window.document' ||
        callerText === 'globalThis.document'
      );
    }
  }

  return false;
}

function isInsideFullscreenToggle(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isClassDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current)
    ) {
      let name = '';
      if ('getName' in current && typeof current.getName === 'function') {
        name = current.getName() ?? '';
      }
      if (FULLSCREEN_ONLY_REGEX.test(name)) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchOverflowAssignment(
  binaryExpr: BinaryExpression,
  ctx: JsMatcherContext,
): AnalyzerMatch | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }

  const left = unwrapExpression(binaryExpr.getLeft());
  if (!Node.isPropertyAccessExpression(left)) {
    return null;
  }

  const propName = left.getName();
  if (propName !== 'overflow' && propName !== 'overflowY') {
    return null;
  }

  const styleAccess = unwrapExpression(left.getExpression());
  if (!Node.isPropertyAccessExpression(styleAccess) || styleAccess.getName() !== 'style') {
    return null;
  }

  const targetElement = unwrapExpression(styleAccess.getExpression());
  if (!isDocumentRootElement(targetElement)) {
    return null;
  }

  const right = unwrapExpression(binaryExpr.getRight());
  if (!Node.isStringLiteral(right) && !Node.isNoSubstitutionTemplateLiteral(right)) {
    return null;
  }

  const val = right.getLiteralText().trim().toLowerCase();
  if (val !== 'hidden') {
    return null;
  }

  if (isInsideFullscreenToggle(binaryExpr)) {
    return null;
  }

  if (!hasNativeDialogContext(binaryExpr, ctx)) {
    return null;
  }

  return {
    line: binaryExpr.getStartLineNumber(),
    message:
      `Imperative body scroll lock (${targetElement.getText()}.style.${propName} = 'hidden') used for modal/overlay instead of native <dialog> (showModal()) and CSS overscroll-behavior: contain.`,
  };
}

function matchSetPropertyCall(
  callExpr: CallExpression,
  ctx: JsMatcherContext,
): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== 'setProperty') {
    return null;
  }

  const styleAccess = unwrapExpression(expr.getExpression());
  if (!Node.isPropertyAccessExpression(styleAccess) || styleAccess.getName() !== 'style') {
    return null;
  }

  const targetElement = unwrapExpression(styleAccess.getExpression());
  if (!isDocumentRootElement(targetElement)) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 2) {
    return null;
  }

  const propArg = unwrapExpression(args[0]);
  const valArg = unwrapExpression(args[1]);

  if (!Node.isStringLiteral(propArg) && !Node.isNoSubstitutionTemplateLiteral(propArg)) {
    return null;
  }
  if (!Node.isStringLiteral(valArg) && !Node.isNoSubstitutionTemplateLiteral(valArg)) {
    return null;
  }

  const propName = propArg.getLiteralText().toLowerCase();
  if (propName !== 'overflow' && propName !== 'overflow-y') {
    return null;
  }

  if (valArg.getLiteralText().trim().toLowerCase() !== 'hidden') {
    return null;
  }

  if (isInsideFullscreenToggle(callExpr)) {
    return null;
  }

  if (!hasNativeDialogContext(callExpr, ctx)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      `Imperative body scroll lock (${targetElement.getText()}.style.setProperty('${propName}', 'hidden')) used for modal/overlay instead of native <dialog> (showModal()) and CSS overscroll-behavior: contain.`,
  };
}

function matchClassListAdd(callExpr: CallExpression, ctx: JsMatcherContext): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== 'add') {
    return null;
  }

  const classListAccess = unwrapExpression(expr.getExpression());
  if (!Node.isPropertyAccessExpression(classListAccess) || classListAccess.getName() !== 'classList') {
    return null;
  }

  const targetElement = unwrapExpression(classListAccess.getExpression());
  if (!isDocumentRootElement(targetElement)) {
    return null;
  }

  const args = callExpr.getArguments();
  let matchedClassName = '';
  for (const arg of args) {
    const unwrappedArg = unwrapExpression(arg);
    if (Node.isStringLiteral(unwrappedArg) || Node.isNoSubstitutionTemplateLiteral(unwrappedArg)) {
      const cls = unwrappedArg.getLiteralText().trim();
      if (MODAL_SCROLL_LOCK_CLASSES.has(cls)) {
        matchedClassName = cls;
        break;
      }
    }
  }

  if (!matchedClassName) {
    return null;
  }

  if (isInsideFullscreenToggle(callExpr)) {
    return null;
  }

  if (!hasNativeDialogContext(callExpr, ctx)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      `Imperative body scroll-lock class added (${targetElement.getText()}.classList.add('${matchedClassName}')) instead of native <dialog> (showModal()) and CSS overscroll-behavior: contain.`,
  };
}

function matchScrollLockCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  let fnName = '';
  if (Node.isIdentifier(expr)) {
    fnName = expr.getText();
  } else if (Node.isPropertyAccessExpression(expr)) {
    fnName = expr.getName();
  }

  if (fnName === 'disableBodyScroll' || fnName === 'enableBodyScroll') {
    if (isInsideFullscreenToggle(callExpr)) {
      return null;
    }
    return {
      line: callExpr.getStartLineNumber(),
      message:
        `Imperative body scroll lock call (${fnName}(...)) used for modal/overlay instead of native <dialog> (showModal()) and CSS overscroll-behavior: contain.`,
    };
  }

  return null;
}

export const preventPageScrollUnderModalDialogMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'overflow',
    'modal-open',
    'no-scroll',
    'scroll-lock',
    'overflow-hidden',
    'disableBodyScroll',
    'enableBodyScroll',
  ],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binExpr of binaryExpressions) {
      const match = matchOverflowAssignment(binExpr, ctx);
      if (match) {
        matches.push(match);
      }
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const scrollLockMatch = matchScrollLockCall(callExpr);
      if (scrollLockMatch) {
        matches.push(scrollLockMatch);
        continue;
      }

      const setPropMatch = matchSetPropertyCall(callExpr, ctx);
      if (setPropMatch) {
        matches.push(setPropMatch);
        continue;
      }

      const classListMatch = matchClassListAdd(callExpr, ctx);
      if (classListMatch) {
        matches.push(classListMatch);
      }
    }

    return matches;
  },
};

export const preventPageScrollUnderModalDialogCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['overflow', 'modal-open', 'dialog-open', 'no-scroll', 'scroll-lock', 'overflow-hidden'],
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    if (ctx.stylesheetHasProperty('overscroll-behavior')) {
      return null;
    }

    if (!isScrollLockSelector(styleRule.selectorText, styleRule, ctx)) {
      return null;
    }

    const overflowVal = styleRule.getPropertyValue('overflow')?.toLowerCase() ?? '';
    const overflowYVal = styleRule.getPropertyValue('overflow-y')?.toLowerCase() ?? '';

    if (overflowVal === 'hidden' || overflowYVal === 'hidden') {
      return {
        message:
          `CSS scroll-lock rule '${styleRule.selectorText}' sets overflow: hidden without overscroll-behavior; use native <dialog> (showModal()) and overscroll-behavior: contain instead.`,
      };
    }

    return null;
  },
};

export const preventPageScrollUnderModalDialogRule: AnalyzerRule = {
  id: 'prevent-page-scroll-under-modal-dialog',
  guideId: 'prevent-page-scroll-under-modal-dialog',
  guideHash: PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
  summary:
    'Flag imperative body scroll locks (document.body.style.overflow = "hidden", document.body.classList.add("modal-open")) inside modal or overlay handlers instead of using native <dialog> with CSS overscroll-behavior: contain.',
  matcher: preventPageScrollUnderModalDialogMatcher,
  verifierRubric: {
    keepWhen: [
      'Imperatively locking background page scroll via document.body.style.overflow = "hidden" or document.documentElement.style.overflow = "hidden" when presenting modal dialogs or overlays.',
      'Adding body scroll-lock classes (such as document.body.classList.add("modal-open") or "no-scroll") to freeze underlying page scroll.',
    ],
    dropWhen: [
      'Full-screen editor or canvas views (e.g. fullscreen toggle modes for code editors or games) that do not present a modal dialog or overlay layer.',
      'Native <dialog> elements utilizing CSS overscroll-behavior: contain or body:has(dialog[open]) to contain scroll without imperative JS.',
      'CSS stylesheet declarations or internal container style assignments setting overflow: hidden on sub-elements rather than the root body or documentElement.',
    ],
  },
};

export const preventPageScrollUnderModalDialogCssRule: AnalyzerRule = {
  id: 'prevent-page-scroll-under-modal-dialog/css',
  guideId: 'prevent-page-scroll-under-modal-dialog',
  guideHash: PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
  summary:
    'Flag CSS modal scroll-lock rules (such as body.modal-open { overflow: hidden }) that disable page scroll without overscroll-behavior.',
  matcher: preventPageScrollUnderModalDialogCssMatcher,
  verifierRubric: {
    keepWhen: [
      'CSS rules applying overflow: hidden or overflow-y: hidden to body or html via modal/dialog classes (such as .modal-open, .dialog-open, .no-scroll) to prevent background page scroll.',
    ],
    dropWhen: [
      'Stylesheets already declaring overscroll-behavior on dialog or backdrop containers.',
      'Selectors setting overflow: hidden on sub-components or card containers rather than the root body or html.',
    ],
  },
};

export const preventPageScrollUnderModalDialogDependencyMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    ['body-scroll-lock', 'scroll-lock', 'no-scroll'],
    (pkgName, versionRange) =>
      `Legacy body scroll lock library "${pkgName}" (${versionRange}) can be replaced with native <dialog> (showModal()) and CSS overscroll-behavior: contain.`,
  );

export const preventPageScrollUnderModalDialogDependencyRule: AnalyzerRule = {
  id: 'prevent-page-scroll-under-modal-dialog/package-scroll-lock',
  guideId: 'prevent-page-scroll-under-modal-dialog',
  guideHash: PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
  summary:
    'Flag dependencies on legacy body scroll lock packages (body-scroll-lock, scroll-lock, no-scroll) that freeze viewport scroll during modal dialogs.',
  matcher: preventPageScrollUnderModalDialogDependencyMatcher,
  verifierRubric: {
    keepWhen: [
      'Projects depending on legacy body scroll lock packages (body-scroll-lock, scroll-lock, no-scroll) to prevent background page scrolling during modal dialogs or overlays.',
    ],
    dropWhen: [
      'Native <dialog> elements utilizing CSS overscroll-behavior: contain to isolate scroll without third-party libraries.',
      'Full-page canvas or game views requiring total viewport scroll management rather than modal overlays.',
    ],
  },
};

export default [
  preventPageScrollUnderModalDialogDependencyRule,
  preventPageScrollUnderModalDialogRule,
  preventPageScrollUnderModalDialogCssRule,
] satisfies readonly AnalyzerRule[];
