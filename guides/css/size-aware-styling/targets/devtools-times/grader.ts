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
  test('provides fallback strategy using media queries or progressive @supports enhancement', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet);

    const hasFallbackStrategy = allRules.some((r): boolean => {
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

    expect(hasFallbackStrategy).toBe(true);
  });
});
