import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import {
  matchEventListenerCall,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const MENU_GUIDE_HASH = '6f89d9fbe024';

/**
 * Checks whether an expression checks for ArrowDown, ArrowUp, Home, or End.
 */
function isArrowOrMenuNavKey(expr: Node): boolean {
  let isNav = false;

  expr.forEachDescendant((child) => {
    if (isNav) return;

    if (Node.isBinaryExpression(child)) {
      const left = unwrapExpression(child.getLeft()).getText();
      const right = unwrapExpression(child.getRight()).getText();

      if (
        (left.endsWith('.key') && (right === "'ArrowDown'" || right === '"ArrowDown"' || right === "'ArrowUp'" || right === '"ArrowUp"')) ||
        (right.endsWith('.key') && (left === "'ArrowDown'" || left === '"ArrowDown"' || left === "'ArrowUp'" || left === '"ArrowUp"')) ||
        ((left.endsWith('.keyCode') || left.endsWith('.which')) && (right === '38' || right === '40')) ||
        ((right.endsWith('.keyCode') || right.endsWith('.which')) && (left === '38' || left === '40'))
      ) {
        isNav = true;
        return;
      }
    }
  });

  return isNav;
}

/**
 * Checks whether a handler focuses a menu item or updates tabindex for roving tabindex.
 */
function isMenuFocusOrTabindexCycle(handler: Node): boolean {
  let cyclesFocus = false;

  handler.forEachDescendant((child) => {
    if (cyclesFocus) return;

    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        if (expr.getName() === 'focus') {
          cyclesFocus = true;
          return;
        }
      }
    }

    if (Node.isBinaryExpression(child)) {
      const left = unwrapExpression(child.getLeft()).getText();
      if (left.endsWith('.tabIndex') || left.endsWith('.tabindex')) {
        cyclesFocus = true;
        return;
      }
    }
  });

  return cyclesFocus;
}

export const menuJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'role="menu"',
    'menuitem',
    'ArrowDown',
    'ArrowUp',
    'focusgroup',
  ] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    // Skip test files
    if (
      ctx.filePath.includes('.test.') ||
      ctx.filePath.includes('.spec.') ||
      ctx.filePath.includes('/test/') ||
      ctx.filePath.includes('/tests/')
    ) {
      return matches;
    }

    // If file already uses focusgroup, skip
    if (ctx.fileContent.includes('focusgroup') || ctx.fileContent.includes('focusGroup')) {
      return matches;
    }

    // Check if file has menu role context
    const hasMenuContext =
      ctx.fileContent.includes('menuitem') ||
      ctx.fileContent.includes('role="menu"') ||
      ctx.fileContent.includes("role='menu'") ||
      ctx.fileContent.includes('menu');

    if (!hasMenuContext) {
      return matches;
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const matchedListener = matchEventListenerCall(call, ['keydown', 'keyup']);
      if (!matchedListener) {
        continue;
      }

      const { handlerNode } = matchedListener;

      if (isArrowOrMenuNavKey(handlerNode) && isMenuFocusOrTabindexCycle(handlerNode)) {
        matches.push({
          line: call.getStartLineNumber(),
          column: call.getStartLinePos(),
          message:
            'Custom menu roving-tabindex and keyboard navigation; native focusgroup="menu nomemory" with popover="auto" and commandfor eliminates manual keyboard focus loops and outside-click handling.',
        });
      }
    }

    return matches;
  },
};

export const menuDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'div, ul, ol',
  fastTokens: ['role="menu"'] as const,
  skipIfHasSpread: true,
  matchElement(element: DomElementView, ctx: DomMatcherContext): { message: string } | null {
    const tag = element.tagName.toLowerCase();
    if (tag !== 'div' && tag !== 'ul' && tag !== 'ol') {
      return null;
    }

    if ((element.getAttribute('role') ?? '').trim().toLowerCase() !== 'menu') {
      return null;
    }

    const lowerPath = ctx.filePath.toLowerCase();
    if (
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/') ||
      lowerPath.includes('/test/data/') ||
      lowerPath.includes('/fixtures/') ||
      lowerPath.includes('/fixture/') ||
      lowerPath.includes('__tests__')
    ) {
      return null;
    }

    // If element already declares focusgroup, exempt
    if (element.hasAttribute('focusgroup')) {
      return null;
    }

    const classAttr =
      element.getAttribute('class') ?? element.getAttribute('className') ?? '';
    if (
      element.getAttribute('data-widget') === 'treeview' ||
      /\b(?:nav-sidebar|nav-treeview|list-unstyled|dropdown-form)\b/i.test(classAttr)
    ) {
      return null;
    }

    return {
      message:
        'Custom menu container with role="menu"; native <div focusgroup="menu nomemory"> inside a popover automatically manages menu semantics and keyboard navigation.',
    };
  },
};

export const menuJsRule: AnalyzerRule = {
  id: 'menu/js',
  guideId: 'menu',
  guideHash: MENU_GUIDE_HASH,
  summary:
    'Use native focusgroup="menu nomemory" with popover and commandfor instead of manual roving-tabindex arrow navigation.',
  matcher: menuJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Manual keydown roving-tabindex cycling focus across menu items using ArrowDown/ArrowUp or Home/End',
    ],
    dropWhen: [
      'Code already using focusgroup attribute',
      'Native select elements or non-menu roving tabindex widgets (tabs, grid)',
    ],
  },
};

export const menuDomRule: AnalyzerRule = {
  id: 'menu/dom',
  guideId: 'menu',
  guideHash: MENU_GUIDE_HASH,
  summary:
    'Use native <div focusgroup="menu nomemory"> inside a popover instead of custom role="menu" containers.',
  matcher: menuDomMatcher,
  verifierRubric: {
    keepWhen: [
      'Custom <div>, <ul>, or <ol> popup/dropdown menu container with role="menu" lacking focusgroup that holds action buttons or menu links.',
    ],
    dropWhen: [
      'Container already declaring focusgroup attribute.',
      'Standard native <select> elements, search inputs, or form/picker popovers (<form>, <input>, <select>, datepicker) inside a dropdown.',
      'Persistent sidebar navigation treeviews (e.g., AdminLTE nav-sidebar / data-widget="treeview"), static footer link lists (list-unstyled), or trigger <button> elements.',
      'Low-level positioning primitive wrappers (e.g., Radix PopperContent) or documentation code snippets.',
    ],
  },
};

export const menuRule: AnalyzerRule = menuJsRule;

export default [menuJsRule, menuDomRule] satisfies readonly AnalyzerRule[];
