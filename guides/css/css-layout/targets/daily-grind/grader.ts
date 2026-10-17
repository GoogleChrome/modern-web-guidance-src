/**
 * Daily Grind Application - Layout Grader
 *
 * Expectations Evaluation Summary:
 * Expectation 1: SKIPPED - The base application already uses display: flex for one-dimensional navigation and hero layouts.
 * Expectation 2: TESTED - The implementation must use gap instead of child margins for flex children.
 * Expectation 3: SKIPPED - The base application does not declare separate flex-grow, flex-shrink, and flex-basis properties.
 * Expectation 4: TESTED - The implementation must apply flex-wrap: wrap on flex containers whose items can overflow.
 * Expectation 5: TESTED - The implementation must use auto margin to push a flex item to the end of the main axis rather than justify-self.
 * Expectation 6: TESTED - The implementation must use safe alignment on flex containers whose content can exceed container size.
 * Expectation 7: SKIPPED - The base application contains no flex items with long unbreakable content.
 * Expectation 8: SKIPPED - The base application does not declare conflicting flex-basis and inline-size/width.
 * Expectation 9: SKIPPED - The base application already satisfies this by preserving DOM order.
 * Expectation 10: SKIPPED - The base application already uses display: grid for two-dimensional layouts.
 * Expectation 11: SKIPPED - The base application uses normal document flow rather than a page-level grid shell layout.
 * Expectation 12: SKIPPED - The base application already satisfies this with repeat(auto-fit, minmax(250px, 1fr)).
 * Expectation 13: SKIPPED - The base application already satisfies this by using auto-fit for card tracks.
 * Expectation 14: SKIPPED - The base application already satisfies this by using minmax() and fr units.
 * Expectation 15: TESTED - The implementation must use subgrid on card grid items so that internal card elements align.
 * Expectation 16: TESTED - The implementation must declare an explicit grid-template-rows fallback before subgrid.
 * Expectation 17: SKIPPED - The base application cards have a fixed, uniform child count per cell.
 * Expectation 18: SKIPPED - The base application already satisfies this by not using grid-auto-flow: dense.
 * Expectation 19: SKIPPED - The base application does not use container queries.
 * Expectation 20: SKIPPED - The base application does not declare container-type: size.
 * Expectation 21: SKIPPED - The base application does not implement component-level responsive behavior via queries.
 * Expectation 22: SKIPPED - The base application does not scale typography or spacing with container query units.
 * Expectation 23: SKIPPED - The base application does not contain component-level media queries.
 * Expectation 24: SKIPPED - The base application does not use container-type.
 * Expectation 25: SKIPPED - The base application contains no dialog, popover, or overlay elements.
 * Expectation 26: SKIPPED - The base application contains no popover or dialog elements.
 * Expectation 27: SKIPPED - The base application contains no tethered overlays.
 * Expectation 28: SKIPPED - The base application does not use anchor positioning.
 * Expectation 29: SKIPPED - The base application does not use position-area.
 * Expectation 30: SKIPPED - The base application does not use anchor positioning.
 * Expectation 31: SKIPPED - The base application contains no scrollable regions styled with overflow: scroll.
 * Expectation 32: SKIPPED - The base application does not use overflow: hidden for clipping.
 * Expectation 33: SKIPPED - The base application does not contain custom scrollable containers that specify scrollbar-gutter.
 * Expectation 34: SKIPPED - The base application does not contain nested scroll regions.
 * Expectation 35: SKIPPED - The base application does not implement multi-line truncation.
 * Expectation 36: SKIPPED - The base application does not use overflow: hidden to mask replaced element gaps.
 * Expectation 37: SKIPPED - The base application hero image is a CSS background rather than an img element.
 * Expectation 38: TESTED - The implementation should prefer CSS logical properties for layout dimensions and spacing.
 * Expectation 39: TESTED - The implementation must use dynamic viewport units (dvh, dvw, dvb, dvi) for viewport-sized layout containers.
 * Expectation 40: SKIPPED - The base application already satisfies this by not using 100vw.
 * Expectation 41: SKIPPED - The base application does not contain a masonry-style gallery.
 */

import * as fs from 'node:fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  tokenize,
  parseDeclarationListSync,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Daily Grind CSS Layout Grader', () => {

  test('Expectation 2: Uses gap for spacing between flex children instead of margins on the children', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const navUlHasGap = rules.some(
      r =>
        r instanceof CSSStyleRule &&
        r.selectorText.includes('nav ul') &&
        !r.selectorText.includes('li') &&
        Boolean(r.style.getPropertyValue('gap') || r.style.getPropertyValue('column-gap'))
    );
    const childMarginAvoided = !rules.some(
      r =>
        r instanceof CSSStyleRule &&
        r.selectorText.includes('nav ul li') &&
        Boolean(r.style.getPropertyValue('margin-left') || r.style.getPropertyValue('margin-inline-start'))
    );
    expect(navUlHasGap && childMarginAvoided).toBe(true);
  });

  test('Expectation 4: Applies flex-wrap wrap on flex containers whose items can overflow', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const navRule = rules.find(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        r.selectorText.split(',').map(s => s.trim()).includes('nav')
    );
    const hasWrap = Boolean(
      navRule &&
        (navRule.style.getPropertyValue('flex-wrap') === 'wrap' ||
          navRule.style.getPropertyValue('flex-flow').includes('wrap'))
    );
    expect(hasWrap).toBe(true);
  });

  test('Expectation 5: Uses an auto margin to push a flex item to the end of the main axis rather than justify-self', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const pushesNavUlWithAutoMargin = rules.some(
      r =>
        r instanceof CSSStyleRule &&
        r.selectorText.includes('nav ul') &&
        (r.style.getPropertyValue('margin-inline-start') === 'auto' ||
          r.style.getPropertyValue('margin-left') === 'auto')
    );
    expect(pushesNavUlWithAutoMargin).toBe(true);
  });

  test('Expectation 6: Uses safe alignment on flex containers whose content can exceed container size', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasSafeAlignment = rules.some(
      r =>
        r instanceof CSSStyleRule &&
        (r.style.getPropertyValue('align-items').includes('safe') ||
          r.style.getPropertyValue('justify-content').includes('safe') ||
          r.style.getPropertyValue('place-items').includes('safe'))
    );
    expect(hasSafeAlignment).toBe(true);
  });

  test('Expectation 15: Uses subgrid on card grid items so internal card elements align across siblings', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const cardRule = rules.find(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        r.selectorText.split(',').map(s => s.trim()).includes('.card')
    );
    expect(cardRule?.style.getPropertyValue('grid-template-rows')).toBe('subgrid');
  });

  test('Expectation 16: Declares an explicit grid-template-rows fallback before subgrid declaration', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cssBlocks: string[] = [];
    for (const { document } of docs) {
      document.querySelectorAll('style').forEach((styleEl: any) => {
        if (styleEl.textContent) cssBlocks.push(styleEl.textContent);
      });
    }
    for (const file of targetFiles) {
      if (file.endsWith('.css') && fs.existsSync(file)) {
        cssBlocks.push(fs.readFileSync(file, 'utf8'));
      }
    }
    const fullCss = cssBlocks.join('\n');
    const tokens = tokenize(fullCss);
    let inCard = false;
    const blockTokens: any[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'ident' && tokens[i].value === 'card') inCard = true;
      if (inCard && tokens[i].type === '{') {
        let depth = 1;
        i++;
        while (i < tokens.length && depth > 0) {
          if (tokens[i].type === '{') depth++;
          else if (tokens[i].type === '}') depth--;
          if (depth > 0) blockTokens.push(tokens[i]);
          i++;
        }
        break;
      }
    }
    const blockText = blockTokens.map((t: any) => t.raw || t.value).join('');
    const decls = parseDeclarationListSync(blockText) as any[];
    const rowsDecls = decls.filter(
      (d: any) => d.name === 'grid-template-rows' || d.name === 'grid-template-columns'
    );
    const hasFallbackBeforeSubgrid =
      rowsDecls.length >= 2 &&
      rowsDecls.some((d: any, idx: number) => {
        const val = d.body.map((t: any) => t.value).join(' ').trim();
        if (val === 'subgrid' && idx > 0) {
          const prevVal = rowsDecls[idx - 1].body.map((t: any) => t.value).join(' ').trim();
          return prevVal !== 'subgrid';
        }
        return false;
      });
    expect(hasFallbackBeforeSubgrid).toBe(true);
  });

  test('Expectation 38: Prefers CSS logical properties for layout dimensions and spacing', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const LOGICAL_PROPS = new Set([
      'inline-size', 'min-inline-size', 'max-inline-size',
      'block-size', 'min-block-size', 'max-block-size',
      'margin-inline', 'margin-inline-start', 'margin-inline-end',
      'margin-block', 'margin-block-start', 'margin-block-end',
      'padding-inline', 'padding-inline-start', 'padding-inline-end',
      'padding-block', 'padding-block-start', 'padding-block-end',
      'inset-inline', 'inset-inline-start', 'inset-inline-end',
      'inset-block', 'inset-block-start', 'inset-block-end',
    ]);
    let logicalPropertyCount = 0;
    for (const r of rules) {
      if (r instanceof CSSStyleRule) {
        for (let i = 0; i < r.style.length; i++) {
          if (LOGICAL_PROPS.has(r.style.item(i))) {
            logicalPropertyCount++;
          }
        }
      }
    }
    expect(logicalPropertyCount).toBeGreaterThanOrEqual(3);
  });

  test('Expectation 39: Uses dynamic viewport units (dvh, dvw, dvb, dvi) for viewport-sized layout containers', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const dynamicUnits = ['dvh', 'dvw', 'dvb', 'dvi'];
    const hasDynamicViewportUnits = rules.some(r => {
      if (!(r instanceof CSSStyleRule)) return false;
      for (let i = 0; i < r.style.length; i++) {
        const prop = r.style.item(i);
        const val = r.style.getPropertyValue(prop);
        if (dynamicUnits.some(unit => val.includes(unit))) {
          return true;
        }
      }
      return false;
    });
    expect(hasDynamicViewportUnits).toBe(true);
  });

});
