import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSContainerRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore - package.json does not specify "type": "module" for tsc nodenext
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function collectContainerRules(rules: Iterable<CSSRule>): CSSContainerRule[] {
  const result: CSSContainerRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSContainerRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectContainerRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

test.describe('card Target Grader', () => {
  test('Cards use <article> as the root element and do not wrap interactive controls inside an outer link', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => Array.from(d.document.querySelectorAll('.card')) as any[]);

    const allValidArticleCards =
      cards.length > 0 &&
      cards.every((card: any) => {
        const isArticle = card.tagName?.toLowerCase() === 'article';
        const wrappingLink = card.closest('a');
        if (!wrappingLink) {
          return isArticle;
        }
        const innerInteractives = card.querySelectorAll('a, button, input, select, textarea');
        return isArticle && innerInteractives.length === 0;
      });

    expect(allValidArticleCards).toBe(true);
  });

  test('Card regions (heading, content, footer) are direct children without extraneous body wrappers', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => Array.from(d.document.querySelectorAll('article.card')) as any[]);

    const hasDirectRegionsAndMinimalMarkup =
      cards.length > 0 &&
      cards.every((card: any) => {
        const children = Array.from(card.children) as any[];
        const hasDirectHeading = children.some((c) =>
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'header'].includes(c.tagName?.toLowerCase()),
        );
        const hasDirectContent = children.some((c) =>
          ['p', 'ul', 'dl', 'div'].includes(c.tagName?.toLowerCase()),
        );
        const hasDirectFooter = children.some((c) => c.tagName?.toLowerCase() === 'footer');
        const hasUnnecessaryDivWrapper = children.some(
          (c) => c.tagName?.toLowerCase() === 'div' && c.children.length <= 1,
        );
        return hasDirectHeading && hasDirectContent && hasDirectFooter && !hasUnnecessaryDivWrapper;
      });

    expect(hasDirectRegionsAndMinimalMarkup).toBe(true);
  });

  test('Card defines a CSS size container on .card and adapts descendants using @container rules', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = Array.from(stylesheet.cssRules);
    const styleRules = collectStyleRules(allRules);
    const containerRules = collectContainerRules(allRules);

    const cardIsSizeContainer = styleRules.some((r) => {
      if (!r.selectorText.includes('.card') || r.selectorText.includes('.grid')) return false;
      const containerType = r.style.getPropertyValue('container-type');
      const containerShorthand = r.style.getPropertyValue('container');
      return (
        containerType.includes('inline-size') ||
        containerType.includes('size') ||
        containerShorthand.includes('inline-size') ||
        containerShorthand.includes('size')
      );
    });

    const gridIsNotContainer = !styleRules.some((r) => {
      if (!r.selectorText.includes('.grid')) return false;
      const containerType = r.style.getPropertyValue('container-type');
      const containerShorthand = r.style.getPropertyValue('container');
      return Boolean(containerType || containerShorthand);
    });

    expect(cardIsSizeContainer && gridIsNotContainer && containerRules.length > 0).toBe(true);
  });

  test('Card places regions in sequential grid rows for vertical stacking in narrow containers without CSS order', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));

    const usesSubgridOrRowTracks = styleRules.some(
      (r) =>
        r.selectorText.includes('.card') &&
        (r.style.getPropertyValue('grid-template-rows').includes('subgrid') ||
          r.style.getPropertyValue('grid-row').includes('span')),
    );

    const placesRegionsInOrder =
      styleRules.some(
        (r) =>
          r.selectorText.includes('.card') &&
          (r.selectorText.includes('img') || r.selectorText.includes('video')) &&
          r.style.getPropertyValue('grid-row').trim() === '1',
      ) &&
      styleRules.some(
        (r) =>
          r.selectorText.includes('.card') &&
          r.selectorText.includes('h3') &&
          r.style.getPropertyValue('grid-row').trim() === '2',
      ) &&
      styleRules.some(
        (r) =>
          r.selectorText.includes('.card') &&
          r.selectorText.includes('footer') &&
          r.style.getPropertyValue('grid-row').trim() === '4',
      );

    const usesCssOrder = styleRules.some(
      (r) => r.selectorText.includes('.card') && Boolean(r.style.getPropertyValue('order')),
    );

    expect(usesSubgridOrRowTracks && placesRegionsInOrder && !usesCssOrder).toBe(true);
  });

  test('Wide @container rule places media in a side column spanning rows only when the card has media', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const containerRules = collectContainerRules(Array.from(stylesheet.cssRules));

    const hasScopedWideMediaColumn = containerRules.some((cr) => {
      if (!cr.conditionText.includes('min-width')) return false;
      const innerRules = collectStyleRules(Array.from(cr.cssRules));
      return innerRules.some((r) => {
        const hasMediaScope = r.selectorText.includes(':has(') && r.selectorText.includes('img');
        const col = r.style.getPropertyValue('grid-column');
        const row = r.style.getPropertyValue('grid-row');
        return hasMediaScope && col.includes('1') && row.includes('1') && row.includes('-1');
      });
    });

    expect(hasScopedWideMediaColumn).toBe(true);
  });

  test('Multi-column layout rules on .card are strictly scoped with :has() so cards without media remain single-column', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));

    const unscopedMultiColumnOnCard = styleRules.some((r) => {
      if (!r.selectorText.includes('.card') || r.selectorText.includes(':has(')) return false;
      const cols = r.style.getPropertyValue('grid-template-columns').trim();
      const autoCols = r.style.getPropertyValue('grid-auto-columns').trim();
      const hasMultipleCols =
        (cols !== '' && cols !== 'none' && cols !== '1fr' && cols !== 'minmax(0, 1fr)') ||
        autoCols !== '';
      return hasMultipleCols;
    });

    const hasMediaScopedRules = styleRules.some(
      (r) => r.selectorText.includes('.card:has(') && r.selectorText.includes('img'),
    );

    expect(!unscopedMultiColumnOnCard && hasMediaScopedRules).toBe(true);
  });

  test('Card media rules set aspect-ratio and object-fit: cover directly on media elements', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));

    const hasMediaAspectRatioAndObjectFit = styleRules.some((r) => {
      const targetsCardMedia =
        r.selectorText.includes('.card') &&
        (r.selectorText.includes('img') || r.selectorText.includes('video'));
      const aspectRatio = r.style.getPropertyValue('aspect-ratio').trim();
      const objectFit = r.style.getPropertyValue('object-fit').trim();
      return targetsCardMedia && aspectRatio !== '' && aspectRatio !== 'auto' && objectFit === 'cover';
    });

    expect(hasMediaAspectRatioAndObjectFit).toBe(true);
  });

  test('Card action links inside footer have descriptive accessible text differentiating each card and proper stretched-link scoping if used', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => Array.from(d.document.querySelectorAll('article.card')) as any[]);

    const validCardLinks =
      cards.length > 0 &&
      cards.every((card: any) => {
        const heading = card.querySelector('h1, h2, h3, h4, h5, h6');
        const headingText = heading?.textContent?.trim() || '';
        const footerLinks = Array.from(card.querySelectorAll('footer a')) as any[];
        if (footerLinks.length === 0 || !headingText) return false;

        const footerLinksDescriptive = footerLinks.every((a: any) => {
          const fullText = a.textContent?.trim() || '';
          const hiddenSpan = a.querySelector('span');
          return (
            Boolean(hiddenSpan) &&
            fullText.toLowerCase().includes(headingText.toLowerCase()) &&
            fullText.length > 'View Details'.length
          );
        });

        const allLinks = Array.from(card.querySelectorAll('a')) as any[];
        const stretchedLinks = allLinks.filter((a: any) => a.classList.contains('card-link'));
        const validStretchedLinks =
          stretchedLinks.length === 0 ||
          (stretchedLinks.length === 1 && Boolean(heading?.contains(stretchedLinks[0])));

        return footerLinksDescriptive && validStretchedLinks;
      });

    expect(validCardLinks).toBe(true);
  });

  test('Card hover, focus, and checked states do not alter layout-affecting properties (border-width, padding, font-weight, width, height)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));

    const interactiveCardRules = styleRules.filter(
      (r) =>
        r.selectorText.includes('.card') &&
        (r.selectorText.includes(':hover') ||
          r.selectorText.includes(':focus') ||
          r.selectorText.includes(':checked')),
    );

    const altersLayoutOnState = interactiveCardRules.some((r) => {
      const borderWidth = r.style.getPropertyValue('border-width');
      const padding = r.style.getPropertyValue('padding');
      const fontWeight = r.style.getPropertyValue('font-weight');
      const width = r.style.getPropertyValue('width');
      const height = r.style.getPropertyValue('height');
      return Boolean(borderWidth || padding || fontWeight || width || height);
    });

    const cardsExist = getHtmlDocuments(targetFiles).some(
      (d) => d.document.querySelectorAll('article.card').length > 0,
    );

    expect(cardsExist && !altersLayoutOnState).toBe(true);
  });
});
