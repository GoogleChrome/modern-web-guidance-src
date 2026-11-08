import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSGroupingRule,
  getCascadedStyle,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore - package.json lacks "type": "module" in daily-grind, causing tsc module nodenext to flag import.meta
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule) {
      result.push(...collectStyleRules(rule.cssRules));
    }
  }
  return result;
}

function collectMediaRules(rules: Iterable<CSSRule>): CSSMediaRule[] {
  const result: CSSMediaRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule) {
      result.push(...collectMediaRules(rule.cssRules));
    }
  }
  return result;
}

test.describe('scoped-component-transitions Target Grader', () => {
  test('Component state updates are wrapped in an element-scoped view transition by calling startViewTransition() on a specific element rather than document.startViewTransition()', () => {
    const project: Project = getJsProject(targetFiles);
    const callExprs = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const startVtCalls = callExprs.filter((call) => {
      const expr = call.getExpression();
      if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
        return expr.getName() === 'startViewTransition';
      }
      if (expr.isKind(SyntaxKind.ElementAccessExpression)) {
        const arg = expr.getArgumentExpression();
        return arg?.getText().replace(/['"`]/g, '') === 'startViewTransition';
      }
      return false;
    });

    expect(startVtCalls.length).toBeGreaterThan(0);

    const hasElementScopedCall = startVtCalls.some((call) => {
      const expr = call.getExpression();
      if (
        expr.isKind(SyntaxKind.PropertyAccessExpression) ||
        expr.isKind(SyntaxKind.ElementAccessExpression)
      ) {
        const receiver = expr.getExpression().getText().trim();
        return !/^(window\.)?document$/.test(receiver) && call.getArguments().length >= 1;
      }
      return false;
    });

    const hasDocumentScopedCall = startVtCalls.some((call) => {
      const expr = call.getExpression();
      if (
        expr.isKind(SyntaxKind.PropertyAccessExpression) ||
        expr.isKind(SyntaxKind.ElementAccessExpression)
      ) {
        const receiver = expr.getExpression().getText().trim();
        return /^(window\.)?document$/.test(receiver);
      }
      return false;
    });

    expect(hasElementScopedCall).toBe(true);
    expect(hasDocumentScopedCall).toBe(false);
  });

  test('Feature detection checks for startViewTransition support on Element.prototype or the target Element instance rather than only checking document.startViewTransition', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const binaryExprs = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression),
    );
    const propAccesses = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression),
    );
    const callExprs = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression),
    );

    const hasInCheck = binaryExprs.some((expr) => {
      if (expr.getOperatorToken().getText() !== 'in') return false;
      const left = expr.getLeft().getText().replace(/['"`]/g, '');
      const right = expr.getRight().getText().trim();
      return (
        left === 'startViewTransition' &&
        !/^(window\.)?document$/.test(right)
      );
    });

    const hasTypeofOrTruthinessCheck = propAccesses.some((prop) => {
      if (prop.getName() !== 'startViewTransition') return false;
      const receiver = prop.getExpression().getText().trim();
      if (/^(window\.)?document$/.test(receiver)) return false;

      const parent = prop.getParent();
      if (!parent) return false;
      // Exclude direct invocation `scopeEl.startViewTransition(...)` unless optional chaining `scopeEl.startViewTransition?.(...)`
      if (
        parent.isKind(SyntaxKind.CallExpression) &&
        parent.getExpression() === prop &&
        !prop.hasQuestionDotToken()
      ) {
        return false;
      }
      return true;
    });

    const hasReflectOrHasOwnCheck = callExprs.some((call) => {
      const callee = call.getExpression().getText();
      if (
        callee === 'Object.hasOwn' ||
        callee === 'Reflect.has' ||
        callee.endsWith('.hasOwnProperty')
      ) {
        return call
          .getArguments()
          .some((arg) => arg.getText().replace(/['"`]/g, '') === 'startViewTransition');
      }
      return false;
    });

    expect(hasInCheck || hasTypeofOrTruthinessCheck || hasReflectOrHasOwnCheck).toBe(true);
  });

  test('Child elements that animate within the scoped container are assigned a view-transition-name (such as match-element or a scope-unique identifier)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const vtNameRules = styleRules.filter((rule) => {
      const val = rule.style.getPropertyValue('view-transition-name').trim();
      return val !== '' && val !== 'none';
    });

    const docs = getHtmlDocuments(targetFiles);
    const hasInlineVtName = docs.some(({ document }) =>
      Array.from(document.querySelectorAll('[style]')).some((el: any) => {
        const styleAttr = el.getAttribute('style') || '';
        return /view-transition-name\s*:\s*(?!none\b)[a-zA-Z0-9_-]+/.test(styleAttr);
      }),
    );

    const project: Project = getJsProject(targetFiles);
    const hasJsVtName = project.getSourceFiles().some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((p) => p.getName() === 'viewTransitionName') ||
      sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some(
          (c) =>
            c.getExpression().getText().endsWith('.setProperty') &&
            c.getArguments()[0]?.getText().replace(/['"`]/g, '') === 'view-transition-name',
        ),
    );

    expect(vtNameRules.length > 0 || hasInlineVtName || hasJsVtName).toBe(true);
  });

  test('When the scoped container element clips its overflow (overflow: clip, hidden, or scroll) or changes geometry during a transition, it does not set view-transition-name: none so that it remains self-participating and clips its transitioning children', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    // Precondition: at least one rule, inline style, or JS statement configures view transitions for scoped transitions
    const hasViewTransitionCss = styleRules.some(
      (r) =>
        Boolean(r.style.getPropertyValue('view-transition-name').trim()) ||
        Boolean(r.style.getPropertyValue('view-transition-scope').trim()) ||
        Boolean(r.style.getPropertyValue('view-transition-group').trim()),
    );
    const hasInlineVtName = docs.some(({ document }) =>
      Array.from(document.querySelectorAll('[style]')).some((el: any) => {
        const styleAttr = el.getAttribute('style') || '';
        return /view-transition-name\s*:\s*(?!none\b)[a-zA-Z0-9_-]+/.test(styleAttr);
      }),
    );
    const project: Project = getJsProject(targetFiles);
    const hasJsVtName = project.getSourceFiles().some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((p) => p.getName() === 'viewTransitionName') ||
      sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some(
          (c) =>
            c.getExpression().getText().endsWith('.setProperty') &&
            c.getArguments()[0]?.getText().replace(/['"`]/g, '') === 'view-transition-name',
        ),
    );
    expect(hasViewTransitionCss || hasInlineVtName || hasJsVtName).toBe(true);

    // Check CSS rules that clip overflow
    const clippingRules = styleRules.filter((rule) => {
      const overflow = rule.style.getPropertyValue('overflow').trim();
      const overflowX = rule.style.getPropertyValue('overflow-x').trim();
      const overflowY = rule.style.getPropertyValue('overflow-y').trim();
      return [overflow, overflowX, overflowY].some((val) =>
        /\b(clip|hidden|scroll|auto)\b/.test(val),
      );
    });

    for (const rule of clippingRules) {
      const vtName = rule.style
        .getPropertyValue('view-transition-name')
        .replace(/!important/g, '')
        .trim();
      expect(vtName).not.toBe('none');
    }

    // Also check cascaded styles on DOM elements in the Seasonal Favorites section
    const topRules = Array.from(stylesheet.cssRules);
    for (const { document } of docs) {
      const mainElements = Array.from(document.querySelectorAll('main *')) as any[];
      for (const el of mainElements) {
        const cascaded = getCascadedStyle(el, topRules);
        const vtName = cascaded
          .getPropertyValue('view-transition-name')
          .replace(/!important/g, '')
          .trim();
        expect(vtName).not.toBe('none');
      }
    }
  });

  test('A @media (prefers-reduced-motion: reduce) rule disables view transition animations (setting animation: none) on ::view-transition-group(*), ::view-transition-old(*), and ::view-transition-new(*)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const mediaRules = collectMediaRules(stylesheet.cssRules);

    const reducedMotionRules = mediaRules.filter(
      (rule) =>
        rule.conditionText.includes('prefers-reduced-motion') &&
        rule.conditionText.includes('reduce'),
    );
    expect(reducedMotionRules.length).toBeGreaterThan(0);

    const nestedStyleRules = reducedMotionRules.flatMap((mr) =>
      collectStyleRules(mr.cssRules),
    );

    const disablesAnimation = (rule: CSSStyleRule): boolean => {
      const anim = rule.style.getPropertyValue('animation').trim();
      const animName = rule.style.getPropertyValue('animation-name').trim();
      const animDuration = rule.style.getPropertyValue('animation-duration').trim();
      return (
        /\bnone\b/.test(anim) ||
        /\bnone\b/.test(animName) ||
        /^0(s|ms)$/.test(animDuration)
      );
    };

    const hasGroupRule = nestedStyleRules.some(
      (r) =>
        r.selectorText.includes('::view-transition-group(*)') &&
        disablesAnimation(r),
    );
    const hasOldRule = nestedStyleRules.some(
      (r) =>
        r.selectorText.includes('::view-transition-old(*)') &&
        disablesAnimation(r),
    );
    const hasNewRule = nestedStyleRules.some(
      (r) =>
        r.selectorText.includes('::view-transition-new(*)') &&
        disablesAnimation(r),
    );

    expect(hasGroupRule).toBe(true);
    expect(hasOldRule).toBe(true);
    expect(hasNewRule).toBe(true);
  });

  test.describe('Browser tests', () => {
    test('When reordering or updating existing child elements inside the scoped container, the DOM update preserves and moves existing element nodes rather than recreating them from scratch', async ({
      page,
      TARGET_URL,
    }) => {
      await page.goto(TARGET_URL);

      const result = await page.evaluate(async () => {
        const heading = Array.from(document.querySelectorAll('h2')).find((h) =>
          /Seasonal Favorites/i.test(h.textContent || ''),
        );
        const section =
          heading?.closest('section') ||
          document.querySelector('main section') ||
          document.body;

        const grid =
          section.querySelector('.grid') || section.querySelector('ul, ol') || section;
        const initialCards = Array.from(grid.children) as HTMLElement[];
        if (initialCards.length < 2) {
          return { hasControls: false, nodePreserved: false, stateChanged: false };
        }

        const initialDescendants = Array.from(
          section.querySelectorAll('*'),
        ) as HTMLElement[];
        const nodeSet = new Set<Element>(initialDescendants);

        // Find an enabled button inside the section that triggers a reorder or item move
        const buttons = Array.from(
          section.querySelectorAll('button:not(:disabled)'),
        ) as HTMLButtonElement[];
        if (buttons.length === 0) {
          return { hasControls: false, nodePreserved: false, stateChanged: false };
        }

        // Prefer a reorder / move button over a remove button so all nodes remain in the DOM
        const moveBtn =
          buttons.find((b) => {
            const label = (
              (b.textContent || '') +
              ' ' +
              (b.getAttribute('aria-label') || '') +
              ' ' +
              (b.dataset.action || '') +
              ' ' +
              b.className +
              ' ' +
              b.id
            ).toLowerCase();
            return (
              /move|sort|reverse|up|down|left|right|earlier|later|prev|next/.test(
                label,
              ) && !/remove|delete/.test(label)
            );
          }) || buttons[0];

        const beforeOrder = Array.from(grid.children).map((el) =>
          (el.textContent || '').trim(),
        );
        const beforeItemOrder = Array.from(section.querySelectorAll('li')).map(
          (el) => (el.textContent || '').trim(),
        );

        let lastTransitionFinished: Promise<unknown> | null = null;
        const origStartVT = (Element.prototype as any).startViewTransition;
        if (typeof origStartVT === 'function') {
          (Element.prototype as any).startViewTransition = function (...args: any[]) {
            const vt = origStartVT.apply(this, args);
            if (vt && vt.updateCallbackDone) {
              lastTransitionFinished = vt.updateCallbackDone;
            }
            return vt;
          };
        }

        try {
          moveBtn.click();
          if (lastTransitionFinished) {
            await (lastTransitionFinished as Promise<unknown>).catch(() => {});
          }
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        } finally {
          if (typeof origStartVT === 'function') {
            (Element.prototype as any).startViewTransition = origStartVT;
          }
        }

        const afterOrder = Array.from(grid.children).map((el) =>
          (el.textContent || '').trim(),
        );
        const afterItemOrder = Array.from(section.querySelectorAll('li')).map(
          (el) => (el.textContent || '').trim(),
        );

        const stateChanged =
          JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder) ||
          JSON.stringify(beforeItemOrder) !== JSON.stringify(afterItemOrder);

        // Verify that the cards and list items currently in the DOM are the exact same object references
        const currentCards = Array.from(grid.children);
        const cardsPreserved =
          currentCards.length > 0 &&
          currentCards.every((card) => nodeSet.has(card));

        const currentItems = Array.from(section.querySelectorAll('li'));
        const itemsPreserved = currentItems.every((item) => nodeSet.has(item));

        return {
          hasControls: true,
          stateChanged,
          nodePreserved: cardsPreserved && itemsPreserved,
        };
      });

      expect(result.hasControls).toBe(true);
      expect(result.stateChanged).toBe(true);
      expect(result.nodePreserved).toBe(true);
    });

    test('When element-scoped view transitions are not supported, the DOM update callback executes immediately as a fallback without throwing an error', async ({
      page,
      TARGET_URL,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      await page.addInitScript(() => {
        delete (Element.prototype as any).startViewTransition;
        delete (HTMLElement.prototype as any).startViewTransition;
      });

      await page.goto(TARGET_URL);

      const result = await page.evaluate(() => {
        const supportsOnElement = 'startViewTransition' in Element.prototype;
        const heading = Array.from(document.querySelectorAll('h2')).find((h) =>
          /Seasonal Favorites/i.test(h.textContent || ''),
        );
        const section =
          heading?.closest('section') ||
          document.querySelector('main section') ||
          document.body;

        const buttons = Array.from(
          section.querySelectorAll('button:not(:disabled)'),
        ) as HTMLButtonElement[];
        if (buttons.length === 0) {
          return {
            supportsOnElement,
            hasControls: false,
            updatedImmediately: false,
          };
        }

        // Pick an enabled action button
        const actionBtn =
          buttons.find((b) => {
            const label = (
              (b.textContent || '') +
              ' ' +
              (b.getAttribute('aria-label') || '') +
              ' ' +
              (b.dataset.action || '') +
              ' ' +
              b.className +
              ' ' +
              b.id
            ).toLowerCase();
            return /move|sort|reverse|up|down|left|right|earlier|later|prev|next|remove|temperature|serve/.test(
              label,
            );
          }) || buttons[0];

        const snapshotBefore = section.innerHTML;
        actionBtn.click();
        const snapshotAfter = section.innerHTML;

        return {
          supportsOnElement,
          hasControls: true,
          updatedImmediately: snapshotBefore !== snapshotAfter,
        };
      });

      expect(result.supportsOnElement).toBe(false);
      expect(result.hasControls).toBe(true);
      expect(result.updatedImmediately).toBe(true);
      expect(pageErrors).toEqual([]);
    });
  });
});
