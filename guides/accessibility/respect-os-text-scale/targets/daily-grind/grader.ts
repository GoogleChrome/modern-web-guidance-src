import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('respect-os-text-scale Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('Document head opts into OS text scaling via meta text-scale element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const meta = docs
      .map(d => d.document.querySelector('head meta[name="text-scale"], meta[name="text-scale"]'))
      .find(Boolean);

    expect(meta?.getAttribute('content')?.trim().toLowerCase()).toBe('scale');
  });

  test('Component spacing coupled to text size uses relative units rather than fixed pixel dimensions', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const cardRule = rules.find((r): r is CSSStyleRule =>
      r instanceof CSSStyleRule && /(^|[\s,>+~])\.card\b/.test(r.selectorText)
    );
    const padding = cardRule?.style.getPropertyValue('padding') || '';
    const docs = getHtmlDocuments(targetFiles);
    const cardEl = docs.map(d => d.document.querySelector('.card')).find(Boolean);
    const cardClass = cardEl?.getAttribute('class') || '';

    const usesRelativePadding =
      Boolean((padding.includes('rem') || padding.includes('em')) && !/\b\d+px\b/.test(padding)) ||
      /\bp-[a-z0-9]+|\bpx-[a-z0-9]+|\bpy-[a-z0-9]+/.test(cardClass);

    expect(usesRelativePadding).toBe(true);
  });

  test('Responsive grid column sizing uses relative or content-driven thresholds to support reflow rather than fixed pixel minimums', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const gridRule = rules.find((r): r is CSSStyleRule =>
      r instanceof CSSStyleRule && /(^|[\s,>+~])\.grid\b/.test(r.selectorText)
    );
    const cols = gridRule?.style.getPropertyValue('grid-template-columns') || '';
    const docs = getHtmlDocuments(targetFiles);
    const gridEl = docs.map(d => d.document.querySelector('.grid')).find(Boolean);
    const gridClass = gridEl?.getAttribute('class') || '';

    const usesRelativeReflow =
      Boolean((cols.includes('rem') || cols.includes('em') || cols.includes('min(100%')) && !cols.includes('250px')) ||
      /\bgrid-cols-/.test(gridClass);

    expect(usesRelativeReflow).toBe(true);
  });

  test('Text-containing hero section avoids fixed height and allows vertical expansion using min-height', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const heroRules = rules.filter((r): r is CSSStyleRule =>
      r instanceof CSSStyleRule && /(^|[\s,>+~])\.hero\b/.test(r.selectorText)
    );
    const hasFixedHeight = heroRules.some(r =>
      Boolean(r.style.getPropertyValue('height') || r.style.getPropertyValue('block-size'))
    );
    const hasMinHeight = heroRules.some(r =>
      Boolean(r.style.getPropertyValue('min-height') || r.style.getPropertyValue('min-block-size'))
    );
    const docs = getHtmlDocuments(targetFiles);
    const heroEl = docs.map(d => d.document.querySelector('.hero')).find(Boolean);
    const heroClass = heroEl?.getAttribute('class') || '';

    const allowsExpansion =
      (!hasFixedHeight && hasMinHeight) ||
      (/\bmin-h-/.test(heroClass) && !/\bh-(?!screen|auto|full)/.test(heroClass));

    expect(allowsExpansion).toBe(true);
  });

  test('Navigation containers allow text to wrap naturally using flex-wrap', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const navRules = rules.filter((r): r is CSSStyleRule =>
      r instanceof CSSStyleRule && /(^|[\s,>+~])nav(\s+ul)?\b/.test(r.selectorText)
    );
    const hasFlexWrap = navRules.some(r => r.style.getPropertyValue('flex-wrap') === 'wrap');
    const docs = getHtmlDocuments(targetFiles);
    const navEl = docs.map(d => d.document.querySelector('nav, nav ul')).find(Boolean);
    const navClass = navEl?.getAttribute('class') || '';

    const allowsWrap = hasFlexWrap || /\bflex-wrap\b/.test(navClass);

    expect(allowsWrap).toBe(true);
  });

  test('CSS stylesheet does not explicitly set font-size on :root or html when opting into text scaling', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasMetaScale = docs.some(d => {
      const meta = d.document.querySelector('head meta[name="text-scale"], meta[name="text-scale"]');
      return meta?.getAttribute('content')?.trim().toLowerCase() === 'scale';
    });

    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const setsRootFontSize = rules.some(r => {
      if (!(r instanceof CSSStyleRule)) return false;
      const sel = r.selectorText.trim();
      const targetsRoot = /(^|,\s*)(:root|html)(\s*,|$)/.test(sel);
      return targetsRoot && Boolean(r.style.getPropertyValue('font-size'));
    });

    expect(hasMetaScale && !setsRootFontSize).toBe(true);
  });
});
