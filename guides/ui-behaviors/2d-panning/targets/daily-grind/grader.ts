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
  getCascadedStyle,
  CSSStyleRule,
  CSSGroupingRule,
  CSSSupportsRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore - import.meta.url is supported by Playwright/Node ESM runner despite missing package.json "type": "module"
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>, insideSupportsNot = false): Array<{ rule: CSSStyleRule; insideSupportsNot: boolean }> {
  const result: Array<{ rule: CSSStyleRule; insideSupportsNot: boolean }> = [];
  for (const r of rules) {
    if (r instanceof CSSStyleRule) {
      result.push({ rule: r, insideSupportsNot });
      if (r.cssRules && r.cssRules.length > 0) {
        result.push(...collectStyleRules(r.cssRules, insideSupportsNot));
      }
    } else if (r instanceof CSSSupportsRule) {
      const cond = r.conditionText.toLowerCase();
      const isNotScrollAxisLock =
        /\bnot\b/.test(cond) &&
        cond.includes('scroll-axis-lock') &&
        cond.includes('none');
      result.push(...collectStyleRules(r.cssRules, insideSupportsNot || isNotScrollAxisLock));
    } else if (r instanceof CSSGroupingRule) {
      result.push(...collectStyleRules(r.cssRules, insideSupportsNot));
    }
  }
  return result;
}

function hasOverflowScrollOrAuto(style: { getPropertyValue(prop: string): string }): boolean {
  const overflow = style.getPropertyValue('overflow').trim();
  const overflowX = style.getPropertyValue('overflow-x').trim();
  const overflowY = style.getPropertyValue('overflow-y').trim();
  const isScrollOrAuto = (val: string) => /\b(auto|scroll)\b/.test(val);
  return isScrollOrAuto(overflow) || (isScrollOrAuto(overflowX) && isScrollOrAuto(overflowY));
}

function hasOverscrollContainOrNone(style: { getPropertyValue(prop: string): string }): boolean {
  const overscroll = style.getPropertyValue('overscroll-behavior').trim();
  const overscrollX = style.getPropertyValue('overscroll-behavior-x').trim();
  const overscrollY = style.getPropertyValue('overscroll-behavior-y').trim();
  const overscrollInline = style.getPropertyValue('overscroll-behavior-inline').trim();
  const overscrollBlock = style.getPropertyValue('overscroll-behavior-block').trim();
  const isContainOrNone = (val: string) => /\b(none|contain)\b/.test(val);
  return (
    isContainOrNone(overscroll) ||
    (isContainOrNone(overscrollX) && isContainOrNone(overscrollY)) ||
    (isContainOrNone(overscrollInline) && isContainOrNone(overscrollBlock))
  );
}

test.describe('2d-panning Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The two-dimensional scroll container sets overflow: auto or overflow: scroll and declares scroll-axis-lock: none directly on itself rather than on an ancestor wrapper', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const allStyleRules = collectStyleRules(rules);

    // Find rules that declare scroll-axis-lock: none
    const axisLockRules = allStyleRules.filter(
      ({ rule }) => rule.style.getPropertyValue('scroll-axis-lock').trim() === 'none'
    );
    expect(axisLockRules.length).toBeGreaterThan(0);

    // Verify that the element or rule with scroll-axis-lock: none also sets overflow: auto or scroll directly on itself, and not on an ancestor
    const docs = getHtmlDocuments(targetFiles);
    let matchedDirectContainer = false;
    let appliedToNonScrollAncestor = false;

    for (const { document } of docs) {
      const allElements: any[] = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const cascaded = getCascadedStyle(el, rules);
        if (cascaded.getPropertyValue('scroll-axis-lock').trim() === 'none') {
          if (hasOverflowScrollOrAuto(cascaded)) {
            matchedDirectContainer = true;
          } else {
            appliedToNonScrollAncestor = true;
          }
        }
      }
    }

    // Fallback check on CSSStyleRule directly if elements are dynamically created
    if (!matchedDirectContainer) {
      matchedDirectContainer = axisLockRules.some(({ rule }) => hasOverflowScrollOrAuto(rule.style));
    }

    expect(matchedDirectContainer).toBe(true);
    expect(appliedToNonScrollAncestor).toBe(false);
  });

  test('The two-dimensional scroll container sets overscroll-behavior: none or overscroll-behavior: contain', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    let hasOverscrollOnContainer = false;

    for (const { document } of docs) {
      const allElements: any[] = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const cascaded = getCascadedStyle(el, rules);
        if (
          cascaded.getPropertyValue('scroll-axis-lock').trim() === 'none' &&
          hasOverflowScrollOrAuto(cascaded) &&
          hasOverscrollContainOrNone(cascaded)
        ) {
          hasOverscrollOnContainer = true;
        }
      }
    }

    if (!hasOverscrollOnContainer) {
      const allStyleRules = collectStyleRules(rules);
      hasOverscrollOnContainer = allStyleRules.some(
        ({ rule }) =>
          rule.style.getPropertyValue('scroll-axis-lock').trim() === 'none' &&
          hasOverscrollContainOrNone(rule.style)
      );
    }

    expect(hasOverscrollOnContainer).toBe(true);
  });

  test('The scroll container is keyboard focusable with tabindex="0", has a role that supports an accessible name (such as region) and an accessible name, and shows a visible :focus-visible indicator', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const allStyleRules = collectStyleRules(rules);
    const docs = getHtmlDocuments(targetFiles);

    const namedLandmarkTags = new Set(['section', 'main', 'aside', 'nav', 'article']);
    const namedRoles = new Set(['region', 'application', 'group', 'img', 'figure', 'grid', 'graphics-document']);
    let foundFocusableNamedContainer = false;

    for (const { document } of docs) {
      const candidates: any[] = Array.from(document.querySelectorAll('[tabindex="0"]'));
      for (const el of candidates) {
        const cascaded = getCascadedStyle(el, rules);
        const isScrollContainer =
          cascaded.getPropertyValue('scroll-axis-lock').trim() === 'none' ||
          hasOverflowScrollOrAuto(cascaded);
        if (!isScrollContainer) continue;

        const explicitRole = (el.getAttribute('role') || '').trim().toLowerCase();
        const tag = (el.tagName || '').toLowerCase();
        const hasNamedRole = namedRoles.has(explicitRole) || (!explicitRole && namedLandmarkTags.has(tag));
        if (!hasNamedRole) continue;

        const ariaLabel = el.getAttribute('aria-label')?.trim();
        const ariaLabelledBy = el.getAttribute('aria-labelledby')?.trim();
        const title = el.getAttribute('title')?.trim();
        const hasAccessibleName = Boolean(
          (ariaLabel && ariaLabel.length > 0) ||
          (ariaLabelledBy && document.getElementById(ariaLabelledBy)?.textContent?.trim()) ||
          (title && title.length > 0)
        );

        if (hasAccessibleName) {
          foundFocusableNamedContainer = true;
        }
      }
    }

    expect(foundFocusableNamedContainer).toBe(true);

    // Check for a visible :focus-visible rule
    const hasFocusVisibleRule = allStyleRules.some(({ rule }) => {
      if (!rule.selectorText.includes(':focus-visible')) return false;
      const outline = rule.style.getPropertyValue('outline').trim();
      const outlineWidth = rule.style.getPropertyValue('outline-width').trim();
      const outlineColor = rule.style.getPropertyValue('outline-color').trim();
      const boxShadow = rule.style.getPropertyValue('box-shadow').trim();
      const borderColor = rule.style.getPropertyValue('border-color').trim();
      const border = rule.style.getPropertyValue('border').trim();
      return Boolean(
        (outline && outline !== 'none' && outline !== '0') ||
        (outlineWidth && outlineWidth !== '0' && outlineWidth !== '0px') ||
        outlineColor ||
        (boxShadow && boxShadow !== 'none') ||
        borderColor ||
        border
      );
    });

    expect(hasFocusVisibleRule).toBe(true);
  });

  test('touch-action is not restricted unconditionally; when present, it is scoped inside @supports not (scroll-axis-lock: none) and set to pinch-zoom rather than none', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const allStyleRules = collectStyleRules(rules);

    const restrictedTouchRules = allStyleRules.filter(({ rule }) => {
      const value = rule.style.getPropertyValue('touch-action').trim().toLowerCase();
      return value !== '' && value !== 'auto';
    });

    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    // Presence anchor: require a 2D scroll container declaring scroll-axis-lock: none
    const hasAxisLockRule = allStyleRules.some(
      ({ rule }) => rule.style.getPropertyValue('scroll-axis-lock').trim() === 'none'
    );
    expect(hasAxisLockRule).toBe(true);

    // Every non-auto touch-action rule must be scoped inside @supports not (scroll-axis-lock: none) and be pinch-zoom (never none)
    expect(
      restrictedTouchRules.every(({ rule, insideSupportsNot }) => {
        const value = rule.style.getPropertyValue('touch-action').trim().toLowerCase();
        return insideSupportsNot && value === 'pinch-zoom';
      })
    ).toBe(true);
  });

  test('The JavaScript fallback pans by updating the container scrollLeft and scrollTop rather than translating the content with CSS transform', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = collectStyleRules(Array.from(stylesheet.cssRules));
    const hasAxisLockRule = allStyleRules.some(
      ({ rule }) => rule.style.getPropertyValue('scroll-axis-lock').trim() === 'none'
    );
    expect(hasAxisLockRule).toBe(true);

    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const panListeners = callExpressions.filter((call) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      const name = expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName();
      if (name !== 'addEventListener') return false;
      const firstArg = call.getArguments()[0]?.getText() || '';
      return /['"`](wheel|pointerdown|pointermove|touchstart|touchmove|mousedown|mousemove)['"`]/i.test(firstArg);
    });

    const propertyAccesses = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    );
    const elementAccesses = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
    );
    const binaryExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );

    const assignmentOps = new Set(['=', '+=', '-=']);

    const updatesScrollLeft = binaryExpressions.some((expr) => {
      const op = expr.getOperatorToken().getText();
      if (!assignmentOps.has(op)) return false;
      const leftText = expr.getLeft().getText();
      return /\bscrollLeft\b/.test(leftText);
    }) || propertyAccesses.some((pa) => pa.getName() === 'scrollBy' || pa.getName() === 'scrollTo');

    const updatesScrollTop = binaryExpressions.some((expr) => {
      const op = expr.getOperatorToken().getText();
      if (!assignmentOps.has(op)) return false;
      const leftText = expr.getLeft().getText();
      return /\bscrollTop\b/.test(leftText);
    }) || propertyAccesses.some((pa) => pa.getName() === 'scrollBy' || pa.getName() === 'scrollTo');

    // Ensure JS does not pan by assigning style.transform or style['transform']
    const setsStyleTransform = binaryExpressions.some((expr) => {
      const op = expr.getOperatorToken().getText();
      if (!assignmentOps.has(op)) return false;
      const leftText = expr.getLeft().getText();
      return /\bstyle\s*(\.\s*transform|\[\s*['"`]transform['"`]\s*\])/.test(leftText);
    }) || elementAccesses.some((ea) => {
      const arg = ea.getArgumentExpression()?.getText() || '';
      return /['"`]transform['"`]/.test(arg) && /\bstyle\b/.test(ea.getExpression().getText());
    });

    expect(
      panListeners.length === 0 || (updatesScrollLeft && updatesScrollTop && !setsStyleTransform)
    ).toBe(true);
  });

  test('The JavaScript fallback is attached only when CSS.supports("scroll-axis-lock", "none") is false', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = collectStyleRules(Array.from(stylesheet.cssRules));
    const hasAxisLockRule = allStyleRules.some(
      ({ rule }) => rule.style.getPropertyValue('scroll-axis-lock').trim() === 'none'
    );
    expect(hasAxisLockRule).toBe(true);

    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const panListeners = callExpressions.filter((call) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      const name = expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName();
      if (name !== 'addEventListener') return false;
      const firstArg = call.getArguments()[0]?.getText() || '';
      return /['"`](wheel|pointerdown|pointermove|touchstart|touchmove|mousedown|mousemove)['"`]/i.test(firstArg);
    });

    const isCssSupportsScrollAxisLockCall = (call: CallExpression): boolean => {
      const exprText = call.getExpression().getText();
      if (!/\bCSS\.supports\b/.test(exprText)) return false;
      const argsText = call.getArguments().map((a) => a.getText()).join(' ');
      return argsText.includes('scroll-axis-lock') && argsText.includes('none');
    };

    const isGuardedByNotCssSupports = (node: Node): boolean => {
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
            const isNegated =
              condition
                .getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression)
                .some(
                  (u) =>
                    u.getOperatorToken() === SyntaxKind.ExclamationToken &&
                    (u.getOperand() === supportsCall ||
                      u.getOperand().getDescendantsOfKind(SyntaxKind.CallExpression).includes(supportsCall))
                ) ||
              (condition.getKind() === SyntaxKind.PrefixUnaryExpression &&
                condition.asKindOrThrow(SyntaxKind.PrefixUnaryExpression).getOperatorToken() ===
                  SyntaxKind.ExclamationToken) ||
              condition
                .getDescendantsOfKind(SyntaxKind.BinaryExpression)
                .some(
                  (b) =>
                    ['===', '=='].includes(b.getOperatorToken().getText()) &&
                    (b.getLeft().getText() === 'false' || b.getRight().getText() === 'false')
                );
            const thenStmt = ifStmt.getThenStatement();
            const elseStmt = ifStmt.getElseStatement();
            const inThen = node.getPos() >= thenStmt.getPos() && node.getEnd() <= thenStmt.getEnd();
            const inElse =
              elseStmt !== undefined &&
              node.getPos() >= elseStmt.getPos() &&
              node.getEnd() <= elseStmt.getEnd();
            if ((inThen && isNegated) || (inElse && !isNegated)) {
              return true;
            }
          }
        }

        if (current.getKind() === SyntaxKind.Block || current.getKind() === SyntaxKind.SourceFile) {
          const statements = (current as any).getStatements?.() || [];
          for (const stmt of statements) {
            if (stmt.getEnd() <= node.getPos()) {
              const ifStmts =
                stmt.getKind() === SyntaxKind.IfStatement
                  ? [stmt.asKindOrThrow(SyntaxKind.IfStatement)]
                  : stmt.getDescendantsOfKind(SyntaxKind.IfStatement);
              for (const ifStmt of ifStmts) {
                if (ifStmt.getEnd() > node.getPos()) continue;
                const condition = ifStmt.getExpression();
                const calls = condition.getDescendantsOfKind(SyntaxKind.CallExpression);
                const allCalls =
                  condition.getKind() === SyntaxKind.CallExpression
                    ? [condition.asKindOrThrow(SyntaxKind.CallExpression), ...calls]
                    : calls;
                const supportsCall = allCalls.find(isCssSupportsScrollAxisLockCall);
                if (!supportsCall) continue;
                const thenStmt = ifStmt.getThenStatement();
                const hasReturn =
                  thenStmt.getKind() === SyntaxKind.ReturnStatement ||
                  thenStmt.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;
                if (hasReturn) return true;
              }
            }
          }
        }

        current = current.getParent();
      }
      return false;
    };

    expect(panListeners.every((call) => isGuardedByNotCssSupports(call))).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('The two-dimensional scroll container overflows in both horizontal and vertical axes at runtime', async ({ page }) => {
      const containerInfo = await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('[tabindex="0"], [role="region"], div, section'));
        for (const el of candidates) {
          const cs = window.getComputedStyle(el);
          const isScrollableStyle =
            cs.overflowX === 'auto' || cs.overflowX === 'scroll' ||
            cs.overflowY === 'auto' || cs.overflowY === 'scroll';
          if (isScrollableStyle && el.scrollWidth > el.clientWidth && el.scrollHeight > el.clientHeight) {
            return {
              found: true,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              overscrollBehaviorX: cs.overscrollBehaviorX,
              overscrollBehaviorY: cs.overscrollBehaviorY,
            };
          }
        }
        return { found: false, scrollWidth: 0, clientWidth: 0, scrollHeight: 0, clientHeight: 0, overscrollBehaviorX: '', overscrollBehaviorY: '' };
      });

      expect(containerInfo.found).toBe(true);
      expect(containerInfo.scrollWidth).toBeGreaterThan(containerInfo.clientWidth);
      expect(containerInfo.scrollHeight).toBeGreaterThan(containerInfo.clientHeight);
      expect(['none', 'contain']).toContain(containerInfo.overscrollBehaviorX);
      expect(['none', 'contain']).toContain(containerInfo.overscrollBehaviorY);
    });

    test('The JavaScript fallback pans scrollLeft and scrollTop in both axes when CSS.supports("scroll-axis-lock", "none") is false', async ({ page, TARGET_URL }) => {
      const project: Project = getJsProject(targetFiles);
      const hasPanListener = project
        .getSourceFiles()
        .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression))
        .some((call) => {
          const expr = call.getExpression();
          if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
          const name = expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName();
          if (name !== 'addEventListener') return false;
          const firstArg = call.getArguments()[0]?.getText() || '';
          return /['"`](wheel|pointerdown|pointermove|touchstart|touchmove|mousedown|mousemove)['"`]/i.test(firstArg);
        });

      await page.addInitScript(() => {
        const origSupports = CSS.supports.bind(CSS);
        CSS.supports = ((...args: [string, string?]) => {
          const joined = args.join(' ').toLowerCase();
          if (joined.includes('scroll-axis-lock')) {
            return false;
          }
          return origSupports(...(args as [string, string]));
        }) as typeof CSS.supports;
      });

      await page.goto(TARGET_URL);

      const panResult = await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('[tabindex="0"], [role="region"], div'));
        const viewport = candidates.find((el) => {
          const cs = window.getComputedStyle(el);
          return (
            (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
            el.scrollWidth > el.clientWidth &&
            el.scrollHeight > el.clientHeight
          );
        });
        if (!viewport) return null;

        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;

        // Dispatch a diagonal wheel gesture
        const wheelEvent = new WheelEvent('wheel', {
          deltaX: 120,
          deltaY: 95,
          deltaMode: 0,
          bubbles: true,
          cancelable: true,
        });
        viewport.dispatchEvent(wheelEvent);

        const afterWheelLeft = viewport.scrollLeft;
        const afterWheelTop = viewport.scrollTop;

        // Check that children were not translated via inline transform for panning
        const firstChild = viewport.firstElementChild as HTMLElement | null;
        const childInlineTransform = firstChild?.style.transform || '';

        return {
          afterWheelLeft,
          afterWheelTop,
          wheelDefaultPrevented: wheelEvent.defaultPrevented,
          childInlineTransform,
        };
      });

      expect(panResult).not.toBeNull();
      expect(panResult!.childInlineTransform).toBe('');
      if (hasPanListener) {
        expect(panResult!.wheelDefaultPrevented).toBe(true);
        expect(panResult!.afterWheelLeft).toBeGreaterThan(0);
        expect(panResult!.afterWheelTop).toBeGreaterThan(0);
      }
    });

    test("Any JavaScript wheel fallback doesn't cancel wheel events that have ctrlKey set, so Ctrl+wheel and trackpad pinch still zoom the page", async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        const origSupports = CSS.supports.bind(CSS);
        CSS.supports = ((...args: [string, string?]) => {
          const joined = args.join(' ').toLowerCase();
          if (joined.includes('scroll-axis-lock')) {
            return false;
          }
          return origSupports(...(args as [string, string]));
        }) as typeof CSS.supports;
      });

      await page.goto(TARGET_URL);

      const ctrlResult = await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('[tabindex="0"], [role="region"], div'));
        const viewport = candidates.find((el) => {
          const cs = window.getComputedStyle(el);
          return (
            (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
            el.scrollWidth > el.clientWidth &&
            el.scrollHeight > el.clientHeight
          );
        });
        if (!viewport) return null;

        const ctrlWheelEvent = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: 120,
          deltaMode: 0,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        viewport.dispatchEvent(ctrlWheelEvent);
        return { ctrlDefaultPrevented: ctrlWheelEvent.defaultPrevented };
      });

      expect(ctrlResult).not.toBeNull();
      expect(ctrlResult!.ctrlDefaultPrevented).toBe(false);
    });
  });
});
