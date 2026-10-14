import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, CSSContainerRule } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Responsive Table Target Grader', () => {
  test('Table markup uses semantic table, thead, tbody, tr, th, and td elements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasSemanticTable = docs.some(({ document }) => {
      const table = document.querySelector('table');
      if (!table) return false;
      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');
      const tr = table.querySelector('tr');
      const th = table.querySelector('th');
      const td = table.querySelector('td');
      return Boolean(thead && tbody && tr && th && td);
    });
    expect(hasSemanticTable).toBe(true);
  });

  test('Column headers remain sticky at the top of the scrollable area when container is wider than 600px', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hasScrollableContainer =
      rules.some(r =>
        /\b(auto|scroll)\b/i.test(
          r.style.getPropertyValue('overflow') ||
            r.style.getPropertyValue('overflow-y') ||
            r.style.getPropertyValue('overflow-block')
        )
      ) ||
      docs.some(({ document }) =>
        Boolean(
          document.querySelector(
            '.overflow-auto, .overflow-scroll, .overflow-y-auto, .overflow-y-scroll'
          )
        )
      );

    const hasStickyColumnHeader =
      rules.some(r => {
        const sel = r.selectorText;
        const matchesColHeader =
          /(^|[\s,>])thead(\b|\s|>)/i.test(sel) ||
          /(^|[\s,>])th\[scope=["']?col["']?\]/i.test(sel);
        if (!matchesColHeader) return false;
        const pos = r.style.getPropertyValue('position');
        const top =
          r.style.getPropertyValue('inset-block-start') ||
          r.style.getPropertyValue('top') ||
          r.style.getPropertyValue('inset');
        const isZero = top === '0' || top === '0px' || top.startsWith('0');
        return (pos === 'sticky' || pos === '-webkit-sticky') && isZero;
      }) ||
      docs.some(({ document }) =>
        Boolean(document.querySelector('thead.sticky, thead [class*="sticky"], th[scope="col"].sticky'))
      );

    expect(hasScrollableContainer && hasStickyColumnHeader).toBe(true);
  });

  test('Row headers remain sticky at the left of the scrollable area when container is wider than 600px', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hasStickyRowHeader = rules.some(r => {
      const sel = r.selectorText;
      const matchesRowHeader =
        /(^|[\s,>])tbody\s+(tr\s+)?th\b/i.test(sel) ||
        /(^|[\s,>])th\[scope=["']?row["']?\]/i.test(sel) ||
        /(^|[\s,>])tr\s*>\s*th:first-child\b/i.test(sel);
      if (!matchesRowHeader) return false;
      const pos = r.style.getPropertyValue('position');
      const left =
        r.style.getPropertyValue('inset-inline-start') ||
        r.style.getPropertyValue('left') ||
        r.style.getPropertyValue('inset');
      const isZero = left === '0' || left === '0px' || left.startsWith('0');
      return (pos === 'sticky' || pos === '-webkit-sticky') && isZero;
    });

    expect(hasStickyRowHeader).toBe(true);
  });

  test('Table layout transforms into a stacked view with separated row blocks when container width is below 600px', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const containerRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );
    const stackedRule = containerRules.find(cr =>
      /(width\s*<\s*600|max-width:\s*600|inline-size\s*<\s*600|max-inline-size:\s*600)/i.test(
        cr.conditionText
      )
    );
    const innerRules = stackedRule
      ? Array.from(stackedRule.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
      : [];

    const hasBlockDisplay = innerRules.some(r => {
      const sel = r.selectorText;
      const matchesTableEl = /(^|[\s,>])(tr|td|th|table|tbody)\b/i.test(sel);
      if (!matchesTableEl) return false;
      const display = r.style.getPropertyValue('display');
      return /\b(block|grid|flex)\b/i.test(display);
    });

    const hasRowSeparation = innerRules.some(r => {
      const sel = r.selectorText;
      const matchesTr = /(^|[\s,>])(tbody\s+)?tr\b/i.test(sel);
      if (!matchesTr) return false;
      const margin =
        r.style.getPropertyValue('margin-block-end') ||
        r.style.getPropertyValue('margin-bottom') ||
        r.style.getPropertyValue('margin');
      const border =
        r.style.getPropertyValue('border') ||
        r.style.getPropertyValue('border-block-end') ||
        r.style.getPropertyValue('border-bottom');
      return Boolean(margin || border);
    });

    expect(Boolean(stackedRule && hasBlockDisplay && hasRowSeparation)).toBe(true);
  });

  test('The thead element is hidden and removed from accessibility tree in stacked view', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const containerRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );
    const stackedRule = containerRules.find(cr =>
      /(width\s*<\s*600|max-width:\s*600|inline-size\s*<\s*600|max-inline-size:\s*600)/i.test(
        cr.conditionText
      )
    );
    const innerRules = stackedRule
      ? Array.from(stackedRule.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
      : [];

    const hidesThead = innerRules.some(r => {
      const sel = r.selectorText;
      const matchesThead = /(^|[\s,>])thead\b/i.test(sel);
      if (!matchesThead) return false;
      return r.style.getPropertyValue('display') === 'none';
    });

    expect(hidesThead).toBe(true);
  });

  test('Each data cell displays a label corresponding to its column header using a pseudo-element in stacked view', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const containerRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );
    const stackedRule = containerRules.find(cr =>
      /(width\s*<\s*600|max-width:\s*600|inline-size\s*<\s*600|max-inline-size:\s*600)/i.test(
        cr.conditionText
      )
    );
    const innerRules = stackedRule
      ? Array.from(stackedRule.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
      : [];

    const tdPseudoRules = innerRules.filter(r => {
      const isTdPseudo = /(^|[\s,>])td[^\s{]*::?(before|after)\b/i.test(r.selectorText);
      if (!isTdPseudo) return false;
      const content = r.style.getPropertyValue('content');
      return Boolean(content && content !== 'none' && content !== 'normal');
    });

    expect(tdPseudoRules.length >= 2).toBe(true);
  });

  test('Pseudo-element cell labels provide an explicit accessible name using slash syntax in the content property', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const containerRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );
    const stackedRule = containerRules.find(cr =>
      /(width\s*<\s*600|max-width:\s*600|inline-size\s*<\s*600|max-inline-size:\s*600)/i.test(
        cr.conditionText
      )
    );
    const innerRules = stackedRule
      ? Array.from(stackedRule.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
      : [];

    const tdPseudoRules = innerRules.filter(r => {
      const isTdPseudo = /(^|[\s,>])td[^\s{]*::?(before|after)\b/i.test(r.selectorText);
      if (!isTdPseudo) return false;
      const content = r.style.getPropertyValue('content');
      return Boolean(content && content !== 'none' && content !== 'normal');
    });

    const hasSlashAccessibleName =
      tdPseudoRules.length > 0 &&
      tdPseudoRules.every(r => r.style.getPropertyValue('content').includes('/'));

    expect(hasSlashAccessibleName).toBe(true);
  });

  test('Row headers in stacked view are sticky at the top of their respective row block', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const topRules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const containerRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );
    const stackedRule = containerRules.find(cr =>
      /(width\s*<\s*600|max-width:\s*600|inline-size\s*<\s*600|max-inline-size:\s*600)/i.test(
        cr.conditionText
      )
    );
    const innerRules = stackedRule
      ? Array.from(stackedRule.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
      : [];

    const isRowHeaderSel = (sel: string) =>
      /(^|[\s,>])tbody\s+(tr\s+)?th\b/i.test(sel) || /(^|[\s,>])th\[scope=["']?row["']?\]/i.test(sel);

    const hasStickyPosition = [...topRules, ...innerRules].some(r => {
      if (!isRowHeaderSel(r.selectorText)) return false;
      const pos = r.style.getPropertyValue('position');
      return pos === 'sticky' || pos === '-webkit-sticky';
    });

    const hasTopZeroInStacked = innerRules.some(r => {
      if (!isRowHeaderSel(r.selectorText)) return false;
      const top =
        r.style.getPropertyValue('inset-block-start') ||
        r.style.getPropertyValue('top') ||
        r.style.getPropertyValue('inset');
      return top === '0' || top === '0px' || top.startsWith('0');
    });

    expect(hasStickyPosition && hasTopZeroInStacked).toBe(true);
  });
});
