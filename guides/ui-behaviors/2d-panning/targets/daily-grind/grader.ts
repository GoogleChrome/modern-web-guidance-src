import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type CallExpression, type Node, type Project } from 'ts-morph';
import {
  CSSStyleRule,
  CSSSupportsRule,
  CSSGroupingRule,
  getCascadedStyle,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore - import.meta.url is supported by Playwright/Node ESM runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>, includeSupportsNot = false): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSSupportsRule) {
      const isNotAxisLock =
        /\bnot\b/i.test(rule.conditionText) && /scroll-axis-lock/i.test(rule.conditionText);
      if (isNotAxisLock && !includeSupportsNot) {
        continue;
      }
      result.push(...collectStyleRules(rule.cssRules, includeSupportsNot));
    } else if (rule instanceof CSSGroupingRule) {
      result.push(...collectStyleRules(rule.cssRules, includeSupportsNot));
    }
  }
  return result;
}

function getProp(rule: CSSStyleRule, propName: string): string {
  const val = rule.style.getPropertyValue(propName)?.trim();
  if (val) return val;
  const match = rule.cssText.match(new RegExp(`(?:^|[;{\\s])${propName}\\s*:\\s*([^;!}]+)`, 'i'));
  return match ? match[1].trim() : '';
}

function ruleHasScrollAxisLockNone(rule: CSSStyleRule): boolean {
  const val = getProp(rule, 'scroll-axis-lock');
  return /\bnone\b/i.test(val);
}

function ruleHas2DOverflow(rule: CSSStyleRule): boolean {
  const overflow = getProp(rule, 'overflow');
  const overflowX = getProp(rule, 'overflow-x') || getProp(rule, 'overflow-inline');
  const overflowY = getProp(rule, 'overflow-y') || getProp(rule, 'overflow-block');
  if (/^\s*(auto|scroll)(\s+(auto|scroll))?\s*$/i.test(overflow)) {
    return true;
  }
  return /\b(auto|scroll)\b/i.test(overflowX) && /\b(auto|scroll)\b/i.test(overflowY);
}

function ruleHasOverscrollContainment(rule: CSSStyleRule): boolean {
  const overscroll = getProp(rule, 'overscroll-behavior');
  const overscrollX =
    getProp(rule, 'overscroll-behavior-x') || getProp(rule, 'overscroll-behavior-inline');
  const overscrollY =
    getProp(rule, 'overscroll-behavior-y') || getProp(rule, 'overscroll-behavior-block');
  if (/^\s*(none|contain)(\s+(none|contain))?\s*$/i.test(overscroll)) {
    return true;
  }
  return /\b(none|contain)\b/i.test(overscrollX) && /\b(none|contain)\b/i.test(overscrollY);
}

function elementHas2DOverflow(el: any, rules: CSSStyleRule[]): boolean {
  const cascaded = getCascadedStyle(el, rules);
  const overflow = cascaded.getPropertyValue('overflow')?.trim() || '';
  const overflowX =
    cascaded.getPropertyValue('overflow-x')?.trim() ||
    cascaded.getPropertyValue('overflow-inline')?.trim() ||
    '';
  const overflowY =
    cascaded.getPropertyValue('overflow-y')?.trim() ||
    cascaded.getPropertyValue('overflow-block')?.trim() ||
    '';
  if (/^\s*(auto|scroll)(\s+(auto|scroll))?\s*$/i.test(overflow)) {
    return true;
  }
  if (/\b(auto|scroll)\b/i.test(overflowX) && /\b(auto|scroll)\b/i.test(overflowY)) {
    return true;
  }
  const className = el.getAttribute?.('class') || '';
  return (
    /\boverflow-(auto|scroll)\b/.test(className) ||
    (/\boverflow-x-(auto|scroll)\b/.test(className) &&
      /\boverflow-y-(auto|scroll)\b/.test(className))
  );
}

function elementHasScrollAxisLockNone(el: any, rules: CSSStyleRule[]): boolean {
  for (const rule of rules) {
    if (ruleHasScrollAxisLockNone(rule)) {
      try {
        if (el.matches(rule.selectorText)) {
          return true;
        }
      } catch {
        // Ignore selector matching errors on complex pseudo-selectors
      }
    }
  }
  const inlineStyle = el.getAttribute?.('style') || '';
  return /scroll-axis-lock\s*:\s*none\b/i.test(inlineStyle);
}

function elementHasOverscrollContainment(el: any, rules: CSSStyleRule[]): boolean {
  const cascaded = getCascadedStyle(el, rules);
  const overscroll = cascaded.getPropertyValue('overscroll-behavior')?.trim() || '';
  const overscrollX =
    cascaded.getPropertyValue('overscroll-behavior-x')?.trim() ||
    cascaded.getPropertyValue('overscroll-behavior-inline')?.trim() ||
    '';
  const overscrollY =
    cascaded.getPropertyValue('overscroll-behavior-y')?.trim() ||
    cascaded.getPropertyValue('overscroll-behavior-block')?.trim() ||
    '';
  if (/^\s*(none|contain)(\s+(none|contain))?\s*$/i.test(overscroll)) {
    return true;
  }
  if (/\b(none|contain)\b/i.test(overscrollX) && /\b(none|contain)\b/i.test(overscrollY)) {
    return true;
  }
  for (const rule of rules) {
    if (ruleHasOverscrollContainment(rule)) {
      try {
        if (el.matches(rule.selectorText)) {
          return true;
        }
      } catch {
        // Ignore selector errors
      }
    }
  }
  const className = el.getAttribute?.('class') || '';
  return (
    /\boverscroll-(none|contain)\b/.test(className) ||
    (/\boverscroll-x-(none|contain)\b/.test(className) &&
      /\boverscroll-y-(none|contain)\b/.test(className))
  );
}

function findScrollContainerElements(
  docs: Array<{ file: string; document: any }>,
  rules: CSSStyleRule[],
): Array<{ el: any; doc: any }> {
  const matches: Array<{ el: any; doc: any }> = [];
  for (const { document } of docs) {
    const allElements = Array.from(document.querySelectorAll('*')) as any[];
    for (const el of allElements) {
      if (elementHasScrollAxisLockNone(el, rules) || (el.getAttribute('tabindex') === '0' && elementHas2DOverflow(el, rules))) {
        matches.push({ el, doc: document });
      }
    }
  }
  return matches;
}

function parseLengthPx(val: string): number {
  const match = val.match(/^(\d+(?:\.\d+)?)\s*(px|rem|em|vw|vh)?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] || 'px').toLowerCase();
  if (unit === 'rem' || unit === 'em') return num * 16;
  return num;
}

function getElement2DDimensions(el: any, rules: CSSStyleRule[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const rule of rules) {
    try {
      if (el.matches(rule.selectorText)) {
        const w = getProp(rule, 'inline-size') || getProp(rule, 'width') || getProp(rule, 'min-inline-size') || getProp(rule, 'min-width');
        const h = getProp(rule, 'block-size') || getProp(rule, 'height') || getProp(rule, 'min-block-size') || getProp(rule, 'min-height');
        if (w) width = Math.max(width, parseLengthPx(w));
        if (h) height = Math.max(height, parseLengthPx(h));
      }
    } catch {
      // ignore
    }
  }
  const attrWidth = el.getAttribute?.('width');
  const attrHeight = el.getAttribute?.('height');
  if (attrWidth) width = Math.max(width, parseLengthPx(attrWidth));
  if (attrHeight) height = Math.max(height, parseLengthPx(attrHeight));
  return { width, height };
}

function isCssSupportsScrollAxisLockCall(call: CallExpression): boolean {
  const expr = call.getExpression();
  if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
  const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
  if (propAccess.getName() !== 'supports') return false;
  const targetText = propAccess.getExpression().getText();
  if (!/\bCSS$/.test(targetText)) return false;

  const args = call.getArguments();
  if (args.length === 1) {
    const arg0 = args[0].getText();
    return /scroll-axis-lock\s*:\s*none/i.test(arg0);
  }
  if (args.length >= 2) {
    const arg0 = args[0].getText().replace(/^['"`]|['"`]$/g, '').trim();
    const arg1 = args[1].getText().replace(/^['"`]|['"`]$/g, '').trim();
    return /^scroll-axis-lock$/i.test(arg0) && /^none$/i.test(arg1);
  }
  return false;
}

function isGuardedByNotCssSupportsScrollAxisLock(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (current.getKind() === SyntaxKind.IfStatement) {
      const ifStmt = current.asKindOrThrow(SyntaxKind.IfStatement);
      const condition = ifStmt.getExpression();
      const calls = condition.getDescendantsOfKind(SyntaxKind.CallExpression);
      const allCalls =
        condition.getKind() === SyntaxKind.CallExpression
          ? [condition.asKindOrThrow(SyntaxKind.CallExpression), ...calls]
          : calls;

      const supportsCall = allCalls.find(isCssSupportsScrollAxisLockCall);
      if (supportsCall) {
        // Check if negated in the `then` branch or non-negated in the `else` branch or early return
        const isNegatedInCondition =
          condition
            .getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression)
            .some(
              (u) =>
                u.getOperatorToken() === SyntaxKind.ExclamationToken &&
                (u.getOperand() === supportsCall ||
                  u.getOperand().getDescendantsOfKind(SyntaxKind.CallExpression).includes(supportsCall)),
            ) ||
          (condition.getKind() === SyntaxKind.PrefixUnaryExpression &&
            condition.asKindOrThrow(SyntaxKind.PrefixUnaryExpression).getOperatorToken() ===
              SyntaxKind.ExclamationToken) ||
          condition
            .getDescendantsOfKind(SyntaxKind.BinaryExpression)
            .some(
              (b) =>
                ['===', '=='].includes(b.getOperatorToken().getText()) &&
                (b.getLeft().getText() === 'false' || b.getRight().getText() === 'false'),
            );

        const thenStmt = ifStmt.getThenStatement();
        const elseStmt = ifStmt.getElseStatement();
        const inThen =
          node.getPos() >= thenStmt.getPos() && node.getEnd() <= thenStmt.getEnd();
        const inElse =
          elseStmt !== undefined &&
          node.getPos() >= elseStmt.getPos() &&
          node.getEnd() <= elseStmt.getEnd();

        if ((inThen && isNegatedInCondition) || (inElse && !isNegatedInCondition)) {
          return true;
        }
      }
    }
    current = current.getParent();
  }

  // Also check preceding early-return `if (CSS.supports('scroll-axis-lock', 'none')) return;` in the same block/file
  const blockOrFile =
    node.getFirstAncestorByKind(SyntaxKind.Block) || node.getSourceFile();
  const precedingIfs = blockOrFile
    .getDescendantsOfKind(SyntaxKind.IfStatement)
    .filter((ifStmt) => ifStmt.getEnd() <= node.getPos());

  for (const ifStmt of precedingIfs) {
    const condition = ifStmt.getExpression();
    const calls =
      condition.getKind() === SyntaxKind.CallExpression
        ? [condition.asKindOrThrow(SyntaxKind.CallExpression)]
        : condition.getDescendantsOfKind(SyntaxKind.CallExpression);
    if (calls.some(isCssSupportsScrollAxisLockCall)) {
      const thenStmt = ifStmt.getThenStatement();
      const hasReturn =
        thenStmt.getKind() === SyntaxKind.ReturnStatement ||
        thenStmt.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;
      if (hasReturn) {
        return true;
      }
    }
  }

  return false;
}

function getPanningEventHandlerCalls(project: Project): CallExpression[] {
  const calls = project
    .getSourceFiles()
    .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
  return calls.filter((call) => {
    const expr = call.getExpression();
    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
    const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    if (propAccess.getName() !== 'addEventListener') return false;
    const args = call.getArguments();
    if (args.length === 0) return false;
    const eventName = args[0].getText().replace(/^['"`]|['"`]$/g, '').trim();
    return /^(wheel|pointerdown|pointermove|touchstart|touchmove|mousedown|mousemove)$/i.test(
      eventName,
    );
  });
}

test.describe('2d-panning Target Grader', () => {
  test('The two-dimensional scroll container sets overflow: auto or overflow: scroll (with content overflowing in both axes) and declares scroll-axis-lock: none directly on itself rather than on an ancestor wrapper', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = collectStyleRules(stylesheet.cssRules, false);

    const candidates = findScrollContainerElements(docs, rules);
    const hasValidScrollContainer = candidates.some(({ el }) => {
      const hasDirectAxisLock = elementHasScrollAxisLockNone(el, rules);
      const hasDirect2DOverflow = elementHas2DOverflow(el, rules);

      // Ensure no ancestor wrapper declares scroll-axis-lock: none without being the 2D scroll container itself
      let parent = el.parentElement;
      let ancestorHasAxisLock = false;
      while (parent) {
        if (elementHasScrollAxisLockNone(parent, rules) && !elementHas2DOverflow(parent, rules)) {
          ancestorHasAxisLock = true;
        }
        parent = parent.parentElement;
      }

      // Check that descendant surface/content overflows in both axes (e.g. > 800px width & height)
      const descendants = Array.from(el.querySelectorAll('*')) as any[];
      const has2DOverflowingChild = descendants.some((child) => {
        const dims = getElement2DDimensions(child, rules);
        return dims.width >= 800 && dims.height >= 600;
      });

      return (
        hasDirectAxisLock &&
        hasDirect2DOverflow &&
        !ancestorHasAxisLock &&
        has2DOverflowingChild
      );
    });

    expect(hasValidScrollContainer).toBe(true);
  });

  test('The two-dimensional scroll container sets overscroll-behavior: none or overscroll-behavior: contain', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = collectStyleRules(stylesheet.cssRules, false);

    const candidates = findScrollContainerElements(docs, rules);
    const hasOverscrollContainment = candidates.some(
      ({ el }) =>
        elementHasScrollAxisLockNone(el, rules) &&
        elementHas2DOverflow(el, rules) &&
        elementHasOverscrollContainment(el, rules),
    );

    expect(hasOverscrollContainment).toBe(true);
  });

  test('The scroll container is keyboard focusable with tabindex="0", has an accessible name, and shows a visible :focus-visible indicator', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectStyleRules(stylesheet.cssRules, true);

    const candidates = findScrollContainerElements(docs, allRules);

    const focusVisibleRules = allRules.filter(
      (r) =>
        /:focus-visible\b|:focus\b/i.test(r.selectorText) &&
        ((Boolean(getProp(r, 'outline')) && !/^\s*(none|0)\s*$/i.test(getProp(r, 'outline'))) ||
          (Boolean(getProp(r, 'outline-width')) &&
            !/^\s*0(px)?\s*$/i.test(getProp(r, 'outline-width'))) ||
          Boolean(getProp(r, 'box-shadow')) ||
          Boolean(getProp(r, 'border-color'))),
    );

    const hasKeyboardAccessibleContainer = candidates.some(({ el, doc }) => {
      const hasTabindexZero = el.getAttribute('tabindex')?.trim() === '0';
      const ariaLabel = el.getAttribute('aria-label')?.trim() || '';
      const ariaLabelledBy = el.getAttribute('aria-labelledby')?.trim() || '';
      const title = el.getAttribute('title')?.trim() || '';
      const hasAccessibleName =
        ariaLabel.length > 0 ||
        title.length > 0 ||
        (ariaLabelledBy.length > 0 &&
          ariaLabelledBy
            .split(/\s+/)
            .some((id: string) => Boolean(doc.getElementById(id)?.textContent?.trim())));

      const matchesFocusIndicator = focusVisibleRules.some((rule) => {
        const baseSelector = rule.selectorText
          .replace(/:focus-visible\b/gi, '')
          .replace(/:focus\b/gi, '')
          .trim();
        if (!baseSelector) return true;
        try {
          return el.matches(baseSelector);
        } catch {
          return false;
        }
      });

      return hasTabindexZero && hasAccessibleName && matchesFocusIndicator;
    });

    expect(hasKeyboardAccessibleContainer).toBe(true);
  });

  test('touch-action: none is not applied to the scroll container unconditionally; when present, it is scoped inside @supports not (scroll-axis-lock: none)', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const unconditionalRules = collectStyleRules(stylesheet.cssRules, false);

    const candidates = findScrollContainerElements(docs, unconditionalRules);

    const hasUnconditionalTouchActionNone = unconditionalRules.some((rule) => {
      const touchAction = getProp(rule, 'touch-action');
      if (!/\bnone\b/i.test(touchAction)) return false;
      // Check if this rule targets a scroll container or if any rule sets touch-action: none unconditionally on the container
      return (
        candidates.some(({ el }) => {
          try {
            return el.matches(rule.selectorText);
          } catch {
            return false;
          }
        }) || ruleHasScrollAxisLockNone(rule) || ruleHas2DOverflow(rule)
      );
    });

    const hasInlineTouchActionNone = candidates.some(({ el }) => {
      const inlineStyle = el.getAttribute?.('style') || '';
      const className = el.getAttribute?.('class') || '';
      return /touch-action\s*:\s*none\b/i.test(inlineStyle) || /\btouch-none\b/.test(className);
    });

    expect(
      candidates.length > 0 && !hasUnconditionalTouchActionNone && !hasInlineTouchActionNone,
    ).toBe(true);
  });

  test('Any JavaScript fallback pans by updating the container scrollLeft and scrollTop rather than translating the content with CSS transform', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = collectStyleRules(stylesheet.cssRules, false);
    const candidates = findScrollContainerElements(docs, rules);

    const project: Project = getJsProject(targetFiles);
    const panListeners = getPanningEventHandlerCalls(project);

    const propAccesses = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression));

    const updatesScrollLeft = propAccesses.some((pa) => pa.getName() === 'scrollLeft');
    const updatesScrollTop = propAccesses.some((pa) => pa.getName() === 'scrollTop');
    const usesScrollByOrTo = propAccesses.some((pa) =>
      /^(scrollBy|scrollTo|scroll)$/.test(pa.getName()),
    );

    const usesTransformInListeners = panListeners.some((call) => {
      const listenerProps = call.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const setsStyleTransform = listenerProps.some((pa) => pa.getName() === 'transform');
      const stringLiterals = call.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const templateSpans = call.getDescendantsOfKind(SyntaxKind.TemplateExpression);
      const hasTranslateString =
        stringLiterals.some((s) => /\btranslate(3d|X|Y)?\s*\(/i.test(s.getLiteralValue())) ||
        templateSpans.some((t) => /\btranslate(3d|X|Y)?\s*\(/i.test(t.getText()));
      return setsStyleTransform || hasTranslateString;
    });

    const validFallbackOrProgressive =
      candidates.length > 0 &&
      (panListeners.length === 0 ||
        (((updatesScrollLeft && updatesScrollTop) || usesScrollByOrTo) &&
          !usesTransformInListeners));

    expect(validFallbackOrProgressive).toBe(true);
  });

  test('Any JavaScript fallback is attached only when CSS.supports("scroll-axis-lock", "none") is false', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = collectStyleRules(stylesheet.cssRules, false);
    const candidates = findScrollContainerElements(docs, rules);

    const project: Project = getJsProject(targetFiles);
    const panListeners = getPanningEventHandlerCalls(project);

    const allGuarded =
      candidates.length > 0 &&
      panListeners.every((call) => isGuardedByNotCssSupportsScrollAxisLock(call));

    expect(allGuarded).toBe(true);
  });
});
