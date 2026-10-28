import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import { CSSStyleRule, CSSGroupingRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(sheet: CSSStyleSheet): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  function visit(rules: Iterable<CSSRule>) {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        result.push(rule);
      }
      if (rule instanceof CSSGroupingRule && rule.cssRules) {
        visit(rule.cssRules);
      }
    }
  }
  visit(sheet.cssRules);
  return result;
}

test.describe('swipe-to-reveal Target Grader', () => {
  test('Horizontal swipe-to-reveal container is a horizontal scroll container configured with mandatory CSS Scroll Snap and no manual JS gesture listeners', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);
    const docs = getHtmlDocuments(targetFiles);

    const hasOverflowX =
      styleRules.some((r) => {
        const ox = r.style.getPropertyValue('overflow-x').trim();
        const oInline = r.style.getPropertyValue('overflow-inline').trim();
        const o = r.style.getPropertyValue('overflow').trim();
        return (
          /\b(auto|scroll)\b/.test(ox) ||
          /\b(auto|scroll)\b/.test(oInline) ||
          /\b(auto|scroll)\b/.test(o)
        );
      }) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="overflow-x-auto"], [class*="overflow-x-scroll"]')),
      );

    const hasMandatorySnap =
      styleRules.some((r) => {
        const snapType = r.style.getPropertyValue('scroll-snap-type').trim();
        return /\b(x|inline|both)\s+mandatory\b/.test(snapType);
      }) ||
      docs.some((d) =>
        Boolean(
          d.document.querySelector(
            '[class*="snap-x"][class*="snap-mandatory"], [class*="snap-inline"][class*="snap-mandatory"]',
          ),
        ),
      );

    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasManualGestureListener = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'addEventListener'
      ) {
        const firstArg = call.getArguments()[0];
        if (firstArg) {
          const text = firstArg.getText().replace(/^['"`]|['"`]$/g, '');
          return /^(wheel|touchmove|pointermove)$/.test(text);
        }
      }
      return false;
    });

    expect(hasOverflowX && hasMandatorySnap && !hasManualGestureListener).toBe(true);
  });

  test('Foreground content element sets scroll-snap-align: start, scroll-initial-target: nearest, and an opaque background, while trailing panels snap to end', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);
    const docs = getHtmlDocuments(targetFiles);

    const hasContentSnapAndInitialTarget = styleRules.some((r) => {
      const snapAlign = r.style.getPropertyValue('scroll-snap-align').trim();
      const initialTarget = r.style.getPropertyValue('scroll-initial-target').trim();
      const bg =
        r.style.getPropertyValue('background').trim() ||
        r.style.getPropertyValue('background-color').trim();
      const hasOpaqueBg = Boolean(bg) && bg !== 'transparent' && bg !== 'none';
      return /\bstart\b/.test(snapAlign) && /\bnearest\b/.test(initialTarget) && hasOpaqueBg;
    });

    const hasPanelSnapEnd =
      styleRules.some((r) => {
        const snapAlign = r.style.getPropertyValue('scroll-snap-align').trim();
        return /\bend\b/.test(snapAlign);
      }) || docs.some((d) => Boolean(d.document.querySelector('[class*="snap-end"]')));

    expect(hasContentSnapAndInitialTarget && hasPanelSnapEnd).toBe(true);
  });

  test('Outer horizontal swipe-to-reveal container sets overscroll-behavior: chain in CSS without contain or none', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);

    const hasChainOverscroll = styleRules.some((r) => {
      const ob = r.style.getPropertyValue('overscroll-behavior').trim();
      const obX = r.style.getPropertyValue('overscroll-behavior-x').trim();
      const obInline = r.style.getPropertyValue('overscroll-behavior-inline').trim();
      const usesChain = /\bchain\b/.test(ob) || /\bchain\b/.test(obX) || /\bchain\b/.test(obInline);
      const usesContainOrNone =
        /\b(contain|none)\b/.test(ob) ||
        /\b(contain|none)\b/.test(obX) ||
        /\b(contain|none)\b/.test(obInline);
      return usesChain && !usesContainOrNone;
    });

    expect(hasChainOverscroll).toBe(true);
  });

  test('Revealed action controls or side-menu items are focusable DOM elements inside the swipe-to-reveal container', () => {
    const docs = getHtmlDocuments(targetFiles);

    const hasSwipeStructureWithFocusableActions = docs.some(({ document }) => {
      const candidates = Array.from(document.querySelectorAll('div, li, article, section')) as any[];
      return candidates.some((container) => {
        const children = Array.from(container.children || []) as any[];
        if (children.length < 2) return false;
        const contentEl = children[0];
        const panelEl = children[children.length - 1];
        const hasCardHeading = Boolean(contentEl.querySelector('h2, h3, h4, strong'));
        const panelControls = Array.from(
          panelEl.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'),
        );
        return hasCardHeading && panelControls.length >= 2;
      });
    });

    expect(hasSwipeStructureWithFocusableActions).toBe(true);
  });

  test('Keyboard focus (focusin paired with :focus-visible) scrolls the foreground content element back to inline start', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasFocusinListener = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'addEventListener'
      ) {
        const firstArg = call.getArguments()[0];
        return Boolean(firstArg && /^['"`]focusin['"`]$/.test(firstArg.getText()));
      }
      return false;
    });

    const hasFocusVisibleMatch = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'matches'
      ) {
        const firstArg = call.getArguments()[0];
        return Boolean(firstArg && firstArg.getText().includes(':focus-visible'));
      }
      return false;
    });

    const hasScrollIntoViewInlineStart = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'scrollIntoView'
      ) {
        const firstArg = call.getArguments()[0];
        if (firstArg && firstArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const obj = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
          const blockProp = obj.getProperty('block');
          const inlineProp = obj.getProperty('inline');
          const hasNearest = Boolean(blockProp && blockProp.getText().includes('nearest'));
          const hasStart = Boolean(inlineProp && inlineProp.getText().includes('start'));
          return hasNearest && hasStart;
        }
      }
      return false;
    });

    expect(hasFocusinListener && hasFocusVisibleMatch && hasScrollIntoViewInlineStart).toBe(true);
  });
});
