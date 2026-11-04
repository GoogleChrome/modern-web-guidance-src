// Expectation 1: SKIPPED - Base application has no fixed-position elements and already satisfies this expectation.
// Expectation 2: SKIPPED - Base application has no fixed-position elements and already satisfies this expectation.
// Expectation 3: SKIPPED - Base application has no popovers or modal dialogs on page load and already satisfies this expectation.
// Expectation 4: TESTED - Base application has a sticky navigation bar that wraps on phone screens and exceeds 12% of screen height.
// Expectation 5: TESTED - Base application has a persistent sticky navigation bar that remains fully visible on scroll down.
// Expectation 6: TESTED - Base application has a persistent sticky navigation bar that should reappear after scrolling up.
// Expectation 7: TESTED - Base application has a persistent sticky navigation bar that should remain visible when it contains keyboard focus.
// Expectation 8: SKIPPED - Base application does not contain a secondary menu, overflow action, or non-modal overlay (only added in 2 of 3 solution patches).
// Expectation 9: TESTED - Base application contains supplementary card details and footer links that should be placed in closed <details> elements with <summary> labels.

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import {
  CSSStyleRule,
  CSSContainerRule,
  type CSSRule,
} from 'cssomnom';

import * as path from 'path';
import { pathToFileURL } from 'url';

const currentFileUrl =
  typeof __filename !== 'undefined'
    ? pathToFileURL(__filename).href
    : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

function collectAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectAllRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

test.describe('content-first-noise-reduction Target Grader', () => {
  test('Expectation 5 & 6: CSS defines a scroll-state container or JS fallback to hide the top bar on scroll down', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const containerRules = allRules.filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );

    const hasScrollStateContainerType = styleRules.some((r) =>
      /\bscroll-state\b/i.test(r.style.getPropertyValue('container-type'))
    );

    const hasScrollStateContainerRule = containerRules.some((r) => {
      const cond = r.conditionText || r.containerQuery || r.cssText || '';
      const nestedRules = collectAllRules(r.cssRules).filter(
        (nr): nr is CSSStyleRule => nr instanceof CSSStyleRule
      );
      const hidesOrShrinks = nestedRules.some((nr) => {
        const transform = nr.style.getPropertyValue('transform');
        const translate = nr.style.getPropertyValue('translate');
        const top = nr.style.getPropertyValue('top');
        const height = nr.style.getPropertyValue('height');
        const maxHeight = nr.style.getPropertyValue('max-height');
        return (
          /translateY\s*\(\s*-\d+/i.test(transform) ||
          /-\d+/.test(translate) ||
          /^-\d+/.test(top) ||
          Boolean(height) ||
          Boolean(maxHeight)
        );
      });
      return /\bscroll-state\b/i.test(cond) && /\bscrolled\s*:\s*bottom\b/i.test(cond) && hidesOrShrinks;
    });

    const project = getJsProject(targetFiles);
    const callExprs = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasJsScrollListener = callExprs.some((call) => {
      const exprText = call.getExpression().getText();
      const firstArg = call.getArguments()[0]?.getText() || '';
      return (
        /\baddEventListener\b/.test(exprText) && /^['"`]scroll['"`]$/.test(firstArg)
      );
    });

    expect(
      (hasScrollStateContainerType && hasScrollStateContainerRule) || hasJsScrollListener
    ).toBe(true);
  });

  test('Expectation 7: CSS keeps the persistent top bar visible when it contains keyboard focus (:focus-within)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hasFocusWithinVisibility = styleRules.some((r) => {
      const sel = r.selectorText || '';
      if (!/:focus-within\b/.test(sel)) return false;
      const transform = r.style.getPropertyValue('transform').trim();
      const translate = r.style.getPropertyValue('translate').trim();
      if (/:not\(\s*:focus-within\s*\)/.test(sel)) {
        return /translateY\s*\(\s*-\d+/i.test(transform) || /-\d+/.test(translate);
      }
      return (
        transform === 'none' ||
        /translateY\s*\(\s*0/i.test(transform) ||
        translate === 'none' ||
        /^0\b/.test(translate)
      );
    });

    expect(hasFocusWithinVisibility).toBe(true);
  });

  test('Expectation 9: Supplementary sections in cards and footer are placed inside <details> elements with <summary> labels', () => {
    const docs = getHtmlDocuments(targetFiles);
    const allDetails = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('details')) as Array<any>
    );

    const hasCardDetails = docs.some((d) =>
      Boolean(d.document.querySelector('.card details > summary, main details > summary'))
    );
    const hasFooterDetails = docs.some((d) =>
      Boolean(d.document.querySelector('footer details > summary'))
    );

    expect(allDetails.length >= 2 && hasCardDetails && hasFooterDetails).toBe(true);
  });

  test('Expectation 9: All <details> elements start closed on page load and have non-empty <summary> labels', () => {
    const docs = getHtmlDocuments(targetFiles);
    const allDetails = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('details')) as Array<any>
    );

    const validClosedDetails =
      allDetails.length > 0 &&
      allDetails.every((detailsEl) => {
        const isClosed = !detailsEl.hasAttribute('open');
        const summary = detailsEl.querySelector('summary');
        const hasLabel = Boolean(summary && (summary.textContent || '').trim().length > 0);
        return isClosed && hasLabel;
      });

    expect(validClosedDetails).toBe(true);
  });

  test('Expectation 4: Persistent navigation bar has compact styling or responsive rules to stay under 12% viewport height', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const navRules = styleRules.filter((r) =>
      /\b(nav|top-bar|header)\b/i.test(r.selectorText || '')
    );

    const hasCompactPaddingOrHeight = navRules.some((r) => {
      const padding = r.style.getPropertyValue('padding').trim();
      const paddingBlock = r.style.getPropertyValue('padding-block').trim();
      const height = r.style.getPropertyValue('height').trim();
      const maxHeight = r.style.getPropertyValue('max-height').trim();
      const hasReducedPadding =
        (Boolean(padding) && !/^1rem\b/.test(padding)) || Boolean(paddingBlock);
      const hasExplicitCompactHeight =
        /\b(1[0-2]|[1-9])(\.\d+)?(s?vh|%)\b/i.test(height) ||
        /\b(1[0-2]|[1-9])(\.\d+)?(s?vh|%)\b/i.test(maxHeight) ||
        /\bmin\s*\(/i.test(height);
      return hasReducedPadding || hasExplicitCompactHeight;
    });

    expect(hasCompactPaddingOrHeight).toBe(true);
  });

  test.describe('Browser tests', () => {
    test('Expectation 4: Every visible fixed or sticky element wider than half the screen is shorter than 12% of the screen height', async ({
      page,
      TARGET_URL,
    }) => {
      await page.setViewportSize({ width: 800, height: 800 });
      await page.goto(TARGET_URL);

      const violation = await page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const elements = Array.from(document.querySelectorAll('*'));
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.position !== 'fixed' && style.position !== 'sticky') continue;
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            continue;
          }
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          const paddingTop = parseFloat(style.paddingTop) || 0;
          const paddingBottom = parseFloat(style.paddingBottom) || 0;
          const effectiveHeight = Math.max(rect.height, (paddingTop + paddingBottom) * 3.5);
          if (rect.width > vw * 0.5 && effectiveHeight >= vh * 0.12) {
            return { tag: el.tagName, height: effectiveHeight, maxAllowed: vh * 0.12 };
          }
        }
        return null;
      });

      expect(violation).toBeNull();
    });

    test('Expectation 5, 6, 7: Persistent top bar hides on wheel scroll down, reappears on scroll up, and stays visible when focused while scrolled down', async ({
      page,
      TARGET_URL,
    }) => {
      await page.setViewportSize({ width: 375, height: 500 });
      await page.goto(TARGET_URL);

      // Ensure page has sufficient scrollable height for a 1-viewport wheel scroll
      await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.height = '1500px';
        spacer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(spacer);
      });

      const initialRect = await page.evaluate(() => {
        const nav = document.querySelector('nav, [role="navigation"]')!;
        const r = nav.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      });

      // Scroll down by ~1 screen height using mouse wheel
      await page.mouse.move(180, 250);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(350);

      const afterScrollDown = await page.evaluate(() => {
        const nav = document.querySelector('nav, [role="navigation"]')!;
        const r = nav.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      });

      // Scroll up using mouse wheel
      await page.mouse.wheel(0, -150);
      await page.waitForTimeout(350);

      const afterScrollUp = await page.evaluate(() => {
        const nav = document.querySelector('nav, [role="navigation"]')!;
        const r = nav.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      });

      // Scroll down again and focus an element inside the top bar
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(350);
      await page.evaluate(() => {
        const focusable = document.querySelector<HTMLElement>(
          'nav a, nav button, [role="navigation"] a, [role="navigation"] button'
        );
        focusable?.focus();
      });
      await page.waitForTimeout(350);

      const whileFocused = await page.evaluate(() => {
        const nav = document.querySelector('nav, [role="navigation"]')!;
        const r = nav.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      });

      const hiddenOrShrunkOnScrollDown =
        afterScrollDown.bottom <= 1 || afterScrollDown.height < initialRect.height * 0.8;
      const visibleOnScrollUp =
        afterScrollUp.top >= -1 && afterScrollUp.bottom >= initialRect.height * 0.9;
      const visibleWhileFocused =
        whileFocused.top >= -1 && whileFocused.bottom >= initialRect.height * 0.9;

      expect(
        hiddenOrShrunkOnScrollDown && visibleOnScrollUp && visibleWhileFocused
      ).toBe(true);
    });
  });
});
