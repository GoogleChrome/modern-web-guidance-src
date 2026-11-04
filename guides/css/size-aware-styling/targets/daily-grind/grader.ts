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
  CSSNestedDeclarations,
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

const LAYOUT_PROPS = ['display', 'flex-direction', 'grid-template-columns'];

function hasAncestor(rule: CSSRule, predicate: (r: CSSRule) => boolean): boolean {
  for (let p = rule.parentRule; p; p = p.parentRule) {
    if (predicate(p)) return true;
  }
  return false;
}

// Resolves the effective selector for a (possibly nested) style rule or nested declaration block.
function resolveSelector(rule: CSSRule): string | null {
  let parentSelector: string | null = null;
  for (let p = rule.parentRule; p; p = p.parentRule) {
    if (p instanceof CSSStyleRule) {
      parentSelector = resolveSelector(p);
      break;
    }
  }
  if (rule instanceof CSSStyleRule) {
    const own = rule.selectorText.trim();
    if (!parentSelector) return own.replace(/\s+/g, ' ');
    const resolved = own.includes('&') ? own.replace(/&/g, parentSelector) : `${parentSelector} ${own}`;
    return resolved.replace(/\s+/g, ' ');
  }
  return parentSelector;
}

function getStyle(rule: CSSRule): { getPropertyValue(prop: string): string } | null {
  if (rule instanceof CSSStyleRule || rule instanceof CSSNestedDeclarations) return rule.style;
  return null;
}

// Counts explicit grid column tracks. auto-fit/auto-fill repeats adapt to the available width, so they count as one.
function columnTrackCount(value: string): number {
  let v = value.trim();
  if (!v || v === 'none') return 0;
  if (/repeat\(\s*auto-(fit|fill)/i.test(v)) return 1;
  let extra = 0;
  v = v.replace(/\[[^\]]*\]/g, ' ');
  v = v.replace(/repeat\(\s*(\d+)\s*,/gi, (_m, n: string) => {
    extra += Number(n) - 1;
    return 'repeat(';
  });
  while (/\([^()]*\)/.test(v)) v = v.replace(/\([^()]*\)/g, '');
  return extra + v.split(/\s+/).filter(Boolean).length;
}

// True when the given declarations produce a side-by-side (multi-column) layout rather than a stacked one.
function isSideBySide(decls: Map<string, string>): boolean {
  const display = decls.get('display') || '';
  const fd = decls.get('flex-direction') || '';
  const gtc = decls.get('grid-template-columns') || '';
  if (/\b(inline-)?flex\b/i.test(display) && !/\bcolumn/i.test(fd)) return true;
  if (/\b(inline-)?grid\b/i.test(display) && columnTrackCount(gtc) >= 2) return true;
  return false;
}

// Tailwind container-query variants, e.g. `@md:flex-row`, `@[640px]:grid-cols-3`, `@min-[400px]:flex-row`.
const TW_CONTAINER_VARIANT = /^@(?!container\b)[^:\s]+:(.+)$/;
const TW_LAYOUT_UTILITY = /^(flex|inline-flex|flex-(row|col)(-reverse)?|grid|inline-grid|grid-cols-.+|block|columns-.+)$/;

function tailwindToDecls(utilities: string[]): Map<string, string> {
  const decls = new Map<string, string>();
  for (const u of utilities) {
    if (u === 'flex' || u === 'inline-flex') decls.set('display', u);
    else if (u === 'grid' || u === 'inline-grid' || u === 'block') decls.set('display', u);
    else if (/^flex-(row|col)(-reverse)?$/.test(u)) decls.set('flex-direction', u.replace('col', 'column').slice(5));
    else if (/^grid-cols-(\d+)$/.test(u)) decls.set('grid-template-columns', `repeat(${u.slice(10)}, 1fr)`);
  }
  return decls;
}

/**
 * A "default safe layout" means the styles that apply when container queries are NOT evaluated
 * (i.e. in unsupported browsers) still render the component in a usable, stacked-first way.
 * The unsafe case is desktop-first: a side-by-side default that a container query collapses
 * to a stacked layout, which would leave unsupported browsers with a cramped layout.
 * Requires at least one layout change driven by a container query (authored CSS or Tailwind variants).
 */
function hasSafeDefaultLayout(allRules: CSSRule[], htmlDocs: Array<{ document: any }>): boolean {
  const isCondition = (r: CSSRule): boolean =>
    r instanceof CSSContainerRule || r instanceof CSSMediaRule || r instanceof CSSSupportsRule;

  const baseDecls = new Map<string, Map<string, string>>();
  const queriedDecls = new Map<string, Map<string, string>>();
  const collect = (target: Map<string, Map<string, string>>, selector: string, style: { getPropertyValue(p: string): string }): void => {
    const decls = target.get(selector) ?? new Map<string, string>();
    for (const p of LAYOUT_PROPS) {
      const v = style.getPropertyValue(p);
      if (v) decls.set(p, v);
    }
    target.set(selector, decls);
  };

  for (const r of allRules) {
    const style = getStyle(r);
    if (!style) continue;
    const selector = resolveSelector(r);
    if (!selector) continue;
    if (!LAYOUT_PROPS.some((p) => style.getPropertyValue(p) !== '')) continue;

    if (hasAncestor(r, (p) => p instanceof CSSContainerRule)) collect(queriedDecls, selector, style);
    else if (!hasAncestor(r, isCondition)) collect(baseDecls, selector, style);
  }

  const results: boolean[] = [];
  for (const [sel, queried] of queriedDecls) {
    const base = baseDecls.get(sel) ?? new Map<string, string>();
    const queryState = new Map([...base, ...queried]);
    results.push(!(isSideBySide(base) && !isSideBySide(queryState)));
  }

  for (const d of htmlDocs) {
    for (const el of Array.from(d.document.querySelectorAll('[class]')) as any[]) {
      const classes: string[] = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      const variantUtilities = classes
        .map((c) => TW_CONTAINER_VARIANT.exec(c)?.[1])
        .filter((u): u is string => Boolean(u && TW_LAYOUT_UTILITY.test(u)));
      if (variantUtilities.length === 0) continue;
      const baseUtilities = classes.filter((c) => !c.includes(':'));
      const base = tailwindToDecls(baseUtilities);
      const queryState = tailwindToDecls([...baseUtilities, ...variantUtilities]);
      results.push(!(isSideBySide(base) && !isSideBySide(queryState)));
    }
  }

  return results.length > 0 && results.every(Boolean);
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

  // Expectation: A fallback strategy using media queries or a default safe layout is provided for browsers that do not support container queries.
  // Either an explicit @supports/@media fallback OR a safe (stacked) default layout outside of container queries satisfies this.
  test('Fallback strategy using media queries or a default safe layout is provided', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);
    const mediaRules = allRules.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule);

    const hasExplicitFallback =
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

    expect(hasExplicitFallback || hasSafeDefaultLayout(allRules, docs)).toBe(true);
  });
});
