import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSSupportsRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - package.json does not declare "type": "module", causing TS1470 under nodenext
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectStyleRules(rule.cssRules as Iterable<CSSRule>));
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
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectMediaRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

function collectSupportsRules(rules: Iterable<CSSRule>): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSSupportsRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectSupportsRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

function getRuleProp(rule: CSSStyleRule, prop: string): string {
  return rule.style.getPropertyValue(prop).trim();
}

function ruleHasTextDecorationLine(rule: CSSStyleRule, lineType: 'underline' | 'overline' | 'line-through'): boolean {
  const shorthand = getRuleProp(rule, 'text-decoration');
  const longhand = getRuleProp(rule, 'text-decoration-line');
  const combined = `${shorthand} ${longhand}`;
  return new RegExp(`\\b${lineType}\\b`).test(combined);
}

test.describe('custom-text-decorations Target Grader', () => {
  test('Native text-decoration properties are used for underlines and overlines or strikethroughs on links and headings', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasUnderline = styleRules.some((r) => ruleHasTextDecorationLine(r, 'underline'));
    const hasOverlineOrStrike = styleRules.some(
      (r) => ruleHasTextDecorationLine(r, 'overline') || ruleHasTextDecorationLine(r, 'line-through')
    );

    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasUtilityUnderline = docs.some((d) =>
      Boolean(d.document.querySelector('.underline, [class*="underline"]'))
    );
    const hasUtilityOtherLine = docs.some((d) =>
      Boolean(d.document.querySelector('.overline, .line-through, [class*="overline"], [class*="line-through"]'))
    );

    expect((hasUnderline || hasUtilityUnderline) && (hasOverlineOrStrike || hasUtilityOtherLine)).toBe(true);
  });

  test('Decoration thickness and underline offset use relative em units so they scale with font size', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasRelativeThickness = styleRules.some((r) => {
      const td = getRuleProp(r, 'text-decoration');
      const tdt = getRuleProp(r, 'text-decoration-thickness');
      return /\d+(\.\d+)?em\b/.test(td) || /\d+(\.\d+)?em\b/.test(tdt);
    });

    const hasRelativeOffset = styleRules.some((r) => {
      const tuo = getRuleProp(r, 'text-underline-offset');
      return /\d+(\.\d+)?em\b/.test(tuo);
    });

    expect(hasRelativeThickness && hasRelativeOffset).toBe(true);
  });

  test('Decorated links are real <a> elements with valid href destinations and not javascript: URLs', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const links = docs.flatMap((d) => Array.from(d.document.querySelectorAll('a')));

    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const hasDecoratedLinks = styleRules.some(
      (r) =>
        (/\ba\b|\bnav\b|\bfooter\b|\bbtn\b|\bdecorated\b|\breveal\b/.test(r.selectorText)) &&
        ruleHasTextDecorationLine(r, 'underline')
    );

    const allLinksValid =
      links.length > 0 &&
      links.every((link) => {
        const href = (link as unknown as Element).getAttribute('href')?.trim() || '';
        return href.length > 0 && !href.toLowerCase().startsWith('javascript:');
      });

    expect(hasDecoratedLinks && allLinksValid).toBe(true);
  });

  test('Hover reveal underline trims the line with text-decoration-inset and reveals it on both :hover and :focus-visible without wrapping inset in @supports', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topRules = Array.from(stylesheet.cssRules);
    const styleRules = collectStyleRules(topRules);
    const supportsRules = collectSupportsRules(topRules);

    const hasTrimmedInset = styleRules.some((r) => {
      const inset = getRuleProp(r, 'text-decoration-inset');
      return inset.includes('100%');
    });

    const hasHoverFocusReveal = styleRules.some((r) => {
      const sel = r.selectorText;
      const inset = getRuleProp(r, 'text-decoration-inset');
      return (
        sel.includes(':hover') &&
        sel.includes(':focus-visible') &&
        inset.length > 0 &&
        !inset.includes('100%')
      );
    });

    const insetWrappedInSupports = supportsRules.some((sr) =>
       sr.conditionText.includes('text-decoration-inset')
    );

    expect(hasTrimmedInset && hasHoverFocusReveal && !insetWrappedInSupports).toBe(true);
  });

  test('Ink skipping uses text-decoration-skip-ink: all or none without redundantly declaring auto or unpreserved skip-spaces', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasSkipInkAll = styleRules.some((r) => getRuleProp(r, 'text-decoration-skip-ink') === 'all');
    const hasRedundantSkipInkAuto = styleRules.some((r) => getRuleProp(r, 'text-decoration-skip-ink') === 'auto');

    const skipSpacesRules = styleRules.filter((r) => getRuleProp(r, 'text-decoration-skip-spaces').length > 0);
    const allSkipSpacesPreserveWhitespace = skipSpacesRules.every((r) => {
      const ws = getRuleProp(r, 'white-space');
      return /\b(pre|pre-wrap|break-spaces)\b/.test(ws);
    });

    expect(hasSkipInkAll && !hasRedundantSkipInkAuto && allSkipSpacesPreserveWhitespace).toBe(true);
  });

  test('Custom draw-on line uses a pseudo-element with border-shape inside @supports (border-shape: circle(50%)), a straight border fallback outside it, and clip-path reveal', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topRules = Array.from(stylesheet.cssRules);
    const styleRules = collectStyleRules(topRules);
    const supportsRules = collectSupportsRules(topRules);

    const hasStraightFallbackPseudo = styleRules.some((r) => {
      const isPseudo = /::(after|before)\b/.test(r.selectorText);
      const borderBlockEnd = getRuleProp(r, 'border-block-end');
      const borderBottom = getRuleProp(r, 'border-bottom');
      return isPseudo && (borderBlockEnd.length > 0 || borderBottom.length > 0) && getRuleProp(r, 'border-shape') === '';
    });

    const hasBorderShapeInSupports = supportsRules.some((sr) => {
      if (!sr.conditionText.includes('border-shape') || sr.conditionText.includes('not')) return false;
      const innerRules = collectStyleRules(sr.cssRules);
      return innerRules.some(
        (r) => /::(after|before)\b/.test(r.selectorText) && getRuleProp(r, 'border-shape').length > 0
      );
    });

    const hasClipPathTransition = styleRules.some((r) => {
      const clip = getRuleProp(r, 'clip-path');
      const trans = getRuleProp(r, 'transition') || getRuleProp(r, 'transition-property');
      return /::(after|before)\b/.test(r.selectorText) && clip.includes('inset') && trans.includes('clip-path');
    });

    expect(hasStraightFallbackPseudo && hasBorderShapeInSupports && hasClipPathTransition).toBe(true);
  });

  test('Hover reveal and draw-on animations are gated behind @media (prefers-reduced-motion: no-preference)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const mediaRules = collectMediaRules(stylesheet.cssRules);

    const noPrefRules = mediaRules.filter((mr) =>
      mr.conditionText.includes('prefers-reduced-motion') && mr.conditionText.includes('no-preference')
    );
    const innerStyleRules = noPrefRules.flatMap((mr) => collectStyleRules(mr.cssRules));

    const gatesInsetReveal = innerStyleRules.some((r) =>
      getRuleProp(r, 'text-decoration-inset').includes('100%')
    );
    const gatesClipPathDraw = innerStyleRules.some((r) =>
      getRuleProp(r, 'clip-path').includes('100%')
    );

    expect(gatesInsetReveal && gatesClipPathDraw).toBe(true);
  });
});
