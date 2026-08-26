import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import {
  CSSStyleRule,
  CSSContainerRule,
  CSSSupportsRule,
  CSSMediaRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(
    // @ts-ignore
    import.meta.url
  );

function getAllCssRules(ruleList: Iterable<CSSRule>): CSSRule[] {
  const all: CSSRule[] = [];
  for (const rule of ruleList) {
    all.push(rule);
    if ('cssRules' in rule && (rule as { cssRules?: Iterable<CSSRule> }).cssRules) {
      all.push(...getAllCssRules((rule as { cssRules: Iterable<CSSRule> }).cssRules!));
    }
  }
  return all;
}

test.describe('Size-Aware Styling Target Grader', () => {
  test('Component wrapper specifies container-type of inline-size or size', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const hasContainerType =
      allRules.some((r) => {
        if (r instanceof CSSStyleRule) {
          const ct = r.style.getPropertyValue('container-type');
          const c = r.style.getPropertyValue('container');
          return /\b(inline-size|size)\b/i.test(ct) || /\b(inline-size|size)\b/i.test(c);
        }
        return false;
      }) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="@container"], [class*="container-type"]'))
      );

    expect(hasContainerType).toBe(true);
  });

  test('HTML markup contains wrapper elements for the size-aware components', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasContainerWrapper = docs.some((d) =>
      Boolean(
        d.document.querySelector(
          '.card-container, [class*="card-container"], [class*="@container"], [data-container]'
        )
      )
    );

    expect(hasContainerWrapper).toBe(true);
  });

  test('Stylesheet applies @container queries conditioned on container width', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const containerRules = allRules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const hasContainerQuery =
      containerRules.some((r) => {
        const cond = r.conditionText || r.containerQuery || '';
        return /\b(width|inline-size)\b/i.test(cond);
      }) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="@["], [class*="@sm:"], [class*="@md:"], [class*="@lg:"]'))
      );

    expect(hasContainerQuery).toBe(true);
  });

  test('Container query establishes a width threshold condition for responsive styling', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const containerRules = allRules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const hasWidthThreshold =
      containerRules.some((cr) => {
        const cond = cr.conditionText || cr.containerQuery || '';
        return /\b(min-width|max-width|width|inline-size)\s*[:><=]/i.test(cond);
      }) ||
      docs.some((d) =>
        Boolean(
          d.document.querySelector(
            '[class*="@min-"], [class*="@max-"], [class*="@md"], [class*="@lg"], [class*="@["], [class*="@sm"]'
          )
        )
      );

    expect(hasWidthThreshold).toBe(true);
  });

  test('Container query rules adapt component layout between stacked and side-by-side structures', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const containerRules = allRules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const containerLayoutRules = containerRules.flatMap((cr) =>
      getAllCssRules(cr.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
    );

    const hasLayoutAdaptation =
      containerLayoutRules.some((r) => {
        const flexDir = r.style.getPropertyValue('flex-direction');
        const gridCols = r.style.getPropertyValue('grid-template-columns');
        const display = r.style.getPropertyValue('display');
        const gridAuto = r.style.getPropertyValue('grid-auto-flow');
        return (
          /\b(row|row-reverse|column)\b/i.test(flexDir) ||
          gridCols !== '' ||
          gridAuto !== '' ||
          /\b(flex|grid)\b/i.test(display)
        );
      }) ||
      docs.some((d) =>
        Boolean(
          d.document.querySelector(
            '[class*="@"][class*="flex"], [class*="@"][class*="grid"], [class*="@"][class*="row"], [class*="@"][class*="col"]'
          )
        )
      );

    expect(hasLayoutAdaptation).toBe(true);
  });

  test('Component defines a safe default layout when container queries are not applied', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const hasDefaultSafeLayout =
      styleRules.some((r) => {
        if (r.parentRule instanceof CSSContainerRule) return false;
        const sel = r.selectorText;
        if (/\b(card|coffee-card)\b/i.test(sel)) {
          const display = r.style.getPropertyValue('display');
          const flexDir = r.style.getPropertyValue('flex-direction');
          return /\bcolumn\b/i.test(flexDir) || (/\bflex\b/i.test(display) && flexDir !== 'row');
        }
        return false;
      }) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="flex-col"], [class*="flex"][class*="col"]'))
      );

    expect(hasDefaultSafeLayout).toBe(true);
  });

  test('Fallback strategy using @supports or media queries is provided for older browsers', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);
    const mediaRules = allRules.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule);

    const hasFallbackStrategy =
      supportsRules.some((r) => /\bcontainer(-type)?\b/i.test(r.conditionText)) ||
      mediaRules.some((r) => {
        const innerStyleRules = getAllCssRules(r.cssRules).filter(
          (x): x is CSSStyleRule => x instanceof CSSStyleRule
        );
        return innerStyleRules.some(
          (sr) =>
            /\b(card|coffee-card)\b/i.test(sr.selectorText) &&
            (sr.style.getPropertyValue('flex-direction') !== '' ||
              sr.style.getPropertyValue('display') !== '')
        );
      });

    expect(hasFallbackStrategy).toBe(true);
  });
});
