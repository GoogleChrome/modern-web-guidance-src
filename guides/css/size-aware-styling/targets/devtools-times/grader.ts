import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import {
  CSSRule,
  CSSStyleRule,
  CSSGroupingRule,
  CSSSupportsRule,
  CSSMediaRule,
  CSSContainerRule,
  CSSNestedDeclarations,
  type CSSStyleSheet,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllCssRules(container: CSSStyleSheet | CSSGroupingRule | CSSRule): CSSRule[] {
  const result: CSSRule[] = [];
  if ('cssRules' in container && container.cssRules) {
    const rules = Array.from(container.cssRules);
    for (const rule of rules) {
      result.push(rule);
      if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
        result.push(...getAllCssRules(rule as CSSGroupingRule));
      }
    }
  }
  return result;
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
  // Requirement 1: The component wrapper has container-type: inline-size (or size) applied.
  test('component wrapper defines container-type as inline-size or size', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet);
    const htmlDocs = getHtmlDocuments(targetFiles);

    const hasContainerType = allRules.some((r): boolean => {
      if (r instanceof CSSStyleRule) {
        const containerType = r.style.getPropertyValue('container-type') || '';
        const container = r.style.getPropertyValue('container') || '';
        return /\b(inline-size|size)\b/i.test(containerType) || /\b(inline-size|size)\b/i.test(container);
      }
      return false;
    }) || htmlDocs.some((d): boolean => Boolean(d.document.querySelector('[class*="@container"]')));

    expect(hasContainerType).toBe(true);
  });

  // Requirement 2: The component uses @container queries to apply different styles based on the container's width.
  test('component uses @container queries targeting container width', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet);
    const htmlDocs = getHtmlDocuments(targetFiles);

    const hasContainerQuery = allRules.some((r): boolean => {
      if (r instanceof CSSContainerRule) {
        const cond = (r.conditionText || r.containerQuery || '').toLowerCase();
        return /\b(min-width|max-width|width|min-inline-size|max-inline-size|inline-size)\b/i.test(cond) || /\d+(px|rem|em|cqi|cqw)/i.test(cond);
      }
      return false;
    }) || htmlDocs.some((d): boolean => Boolean(d.document.querySelector('[class*="@"][class*="flex"], [class*="@"][class*="grid"], [class*="@"][class*="block"], [class*="@"][class*="text-"]')));

    expect(hasContainerQuery).toBe(true);
  });

  // Requirement 3: The component changes layout (e.g., from stacked to side-by-side) when the container width crosses a specific threshold (e.g., 400px).
  test('component changes layout when container width crosses a threshold', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet);
    const htmlDocs = getHtmlDocuments(targetFiles);

    const hasLayoutChange = allRules.some((r): boolean => {
      if (r instanceof CSSContainerRule) {
        const childRules = getAllCssRules(r);
        return childRules.some((cr): boolean => {
          if (cr instanceof CSSStyleRule) {
            const fd = cr.style.getPropertyValue('flex-direction') || '';
            const gtc = cr.style.getPropertyValue('grid-template-columns') || '';
            const disp = cr.style.getPropertyValue('display') || '';
            const flex = cr.style.getPropertyValue('flex') || '';
            const cols = cr.style.getPropertyValue('columns') || '';
            return /\b(row|row-reverse|column|column-reverse)\b/i.test(fd)
              || gtc.trim().length > 0
              || /\b(flex|grid|inline-flex|inline-grid)\b/i.test(disp)
              || flex.trim().length > 0
              || cols.trim().length > 0;
          }
          return false;
        });
      }
      return false;
    }) || htmlDocs.some((d): boolean => Boolean(d.document.querySelector('[class*="@"][class*="flex-row"], [class*="@"][class*="grid-cols-"], [class*="@"][class*="inline-"]')));

    expect(hasLayoutChange).toBe(true);
  });

  // Requirement 4: A fallback strategy using media queries or a default safe layout is provided for browsers that do not support container queries.
  // Either an explicit @supports/@media fallback OR a safe (stacked) default layout outside of container queries satisfies this.
  test('provides fallback strategy using media queries or a default safe layout', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet);
    const htmlDocs = getHtmlDocuments(targetFiles);

    const hasExplicitFallback = allRules.some((r): boolean => {
      if (r instanceof CSSSupportsRule && /\b(container-type|container)\b/i.test(r.conditionText)) {
        return true;
      }
      if (r instanceof CSSMediaRule) {
        const childRules = getAllCssRules(r);
        return childRules.some((cr): boolean => {
          if (cr instanceof CSSStyleRule) {
            const fd = cr.style.getPropertyValue('flex-direction') || '';
            const gtc = cr.style.getPropertyValue('grid-template-columns') || '';
            const disp = cr.style.getPropertyValue('display') || '';
            return /\b(row|column|flex|grid)\b/i.test(fd) || gtc.trim().length > 0 || /\b(flex|grid)\b/i.test(disp);
          }
          return false;
        });
      }
      return false;
    });

    expect(hasExplicitFallback || hasSafeDefaultLayout(allRules, htmlDocs)).toBe(true);
  });
});
