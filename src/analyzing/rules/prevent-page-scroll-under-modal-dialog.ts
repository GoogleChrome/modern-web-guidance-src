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
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';
import { unwrapExpression } from '../scanners/ast-helpers.ts';

export const PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH = '7d10dd62dcbc';

const FULLSCREEN_ONLY_REGEX = /fullscreen/i;

const MODAL_OR_OVERLAY_REGEX =
  /\b(?:dialog|modal|drawer|lightbox|popup|overlay|showmodal|lockscroll|scrolllock)\b/i;

const FULLSCREEN_CANVAS_GAME_REGEX =
  /\b(?:fullscreen|canvas|game|slide|deck|threejs|pixi)\b/i;

function hasNativeDialogContext(node: Node, ctx: JsMatcherContext): boolean {
  let enclosingFn: Node | undefined;
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isClassDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current)
    ) {
      enclosingFn = current;
      break;
    }
    current = current.getParent();
  }

  const fnText = enclosingFn ? enclosingFn.getText() : '';
  if (FULLSCREEN_CANVAS_GAME_REGEX.test(fnText) && !MODAL_OR_OVERLAY_REGEX.test(fnText)) {
    return false;
  }

  // Must have modal/dialog context and native dialog evidence
  return (
    MODAL_OR_OVERLAY_REGEX.test(fnText) ||
    MODAL_OR_OVERLAY_REGEX.test(ctx.filePath) ||
    ctx.fileContent.includes('showModal') ||
    ctx.fileContent.includes('<dialog')
  );
}

const MODAL_SCROLL_LOCK_CLASSES = new Set([
  'modal-open',
  'dialog-open',
  'no-scroll',
  'scroll-lock',
  'overflow-hidden',
]);

const CSS_SCROLL_LOCK_SELECTOR_REGEX =
  /(?:body|html)?\.(?:modal-open|dialog-open|no-scroll|scroll-lock|overflow-hidden)\b/i;

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
  if (propName !== 'overflow' && propName !== 'overflowY' && propName !== 'overflowX') {
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
  if (propName !== 'overflow' && propName !== 'overflow-y' && propName !== 'overflow-x') {
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

    if (!CSS_SCROLL_LOCK_SELECTOR_REGEX.test(styleRule.selectorText)) {
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
  phase2Rubric: {
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
  phase2Rubric: {
    keepWhen: [
      'CSS rules applying overflow: hidden or overflow-y: hidden to body or html via modal/dialog classes (such as .modal-open, .dialog-open, .no-scroll) to prevent background page scroll.',
    ],
    dropWhen: [
      'Stylesheets already declaring overscroll-behavior on dialog or backdrop containers.',
      'Selectors setting overflow: hidden on sub-components or card containers rather than the root body or html.',
    ],
  },
};

export const preventPageScrollUnderModalDialogDependencyMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: ['body-scroll-lock', 'scroll-lock', 'no-scroll'],
  matchPackage(
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ): { message: string } | null {
    return {
      message:
        `Legacy body scroll lock library "${pkgName}" (${versionRange}) can be replaced with native <dialog> (showModal()) and CSS overscroll-behavior: contain.`,
    };
  },
};

export const preventPageScrollUnderModalDialogDependencyRule: AnalyzerRule = {
  id: 'prevent-page-scroll-under-modal-dialog/package-scroll-lock',
  guideId: 'prevent-page-scroll-under-modal-dialog',
  guideHash: PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
  summary:
    'Flag dependencies on legacy body scroll lock packages (body-scroll-lock, scroll-lock, no-scroll) that freeze viewport scroll during modal dialogs.',
  matcher: preventPageScrollUnderModalDialogDependencyMatcher,
  phase2Rubric: {
    keepWhen: [
      'Projects depending on legacy body scroll lock packages (body-scroll-lock, scroll-lock, no-scroll) to prevent background page scrolling during modal dialogs or overlays.',
    ],
    dropWhen: [
      'Native <dialog> elements utilizing CSS overscroll-behavior: contain to isolate scroll without third-party libraries.',
      'Full-page canvas or game views requiring total viewport scroll management rather than modal overlays.',
    ],
  },
};

export const preventPageScrollUnderModalDialogRules: readonly AnalyzerRule[] = [
  preventPageScrollUnderModalDialogDependencyRule,
  preventPageScrollUnderModalDialogRule,
];
