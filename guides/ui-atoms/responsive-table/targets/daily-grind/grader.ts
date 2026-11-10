import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  getCascadedStyle,
  CSSStyleRule,
  CSSContainerRule,
  CSSMediaRule,
  CSSGroupingRule,
} from 'cssomnom';
import type { CSSRule, CSSStyleSheet } from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore import.meta.url is supported by the test runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getTopLevelStyleRules(rules: CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    } else if (
      rule instanceof CSSGroupingRule &&
      !(rule instanceof CSSContainerRule) &&
      !(rule instanceof CSSMediaRule)
    ) {
      result.push(...getTopLevelStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function getResponsiveStyleRules(rules: CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSContainerRule || rule instanceof CSSMediaRule) {
      if (/\b600px\b|\bwidth\b|\bmax-width\b|\binline-size\b|\bmax-inline-size\b/.test(rule.conditionText)) {
        result.push(...collectAllStyleRules(Array.from(rule.cssRules)));
      }
    } else if (rule instanceof CSSGroupingRule) {
      result.push(...getResponsiveStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function collectAllStyleRules(rules: CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
      result.push(...collectAllStyleRules(Array.from(rule.cssRules)));
    } else if (rule instanceof CSSGroupingRule) {
      result.push(...collectAllStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function isZeroOffset(val: string): boolean {
  const trimmed = val.trim();
  return /^0([a-z%]+)?$/i.test(trimmed);
}

function hasZeroBlockStart(style: { getPropertyValue(prop: string): string }): boolean {
  return (
    isZeroOffset(style.getPropertyValue('inset-block-start')) ||
    isZeroOffset(style.getPropertyValue('top')) ||
    isZeroOffset(style.getPropertyValue('inset-block')) ||
    isZeroOffset(style.getPropertyValue('inset'))
  );
}

function hasZeroInlineStart(style: { getPropertyValue(prop: string): string }): boolean {
  return (
    isZeroOffset(style.getPropertyValue('inset-inline-start')) ||
    isZeroOffset(style.getPropertyValue('left')) ||
    isZeroOffset(style.getPropertyValue('inset-inline')) ||
    isZeroOffset(style.getPropertyValue('inset'))
  );
}

test.describe('responsive-table Target Grader', () => {
  test('The table uses semantic <table>, <thead>, <tbody>, <tr>, <th>, and <td> elements', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasSemanticTable = docs.some(({ document }) => {
      const tables = Array.from(document.querySelectorAll('table'));
      return tables.some((table) => {
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const theadTrTh = thead?.querySelector('tr th');
        const tbodyTr = tbody?.querySelector('tr');
        const tbodyTh = tbodyTr?.querySelector('th');
        const tbodyTd = tbodyTr?.querySelector('td');
        return Boolean(thead && tbody && theadTrTh && tbodyTr && tbodyTh && tbodyTd);
      });
    });
    expect(hasSemanticTable).toBe(true);
  });

  test('The scrollable table wrapper has a role="region" attribute, an accessible name (via an aria-labelledby or aria-label attribute), and a tabindex="0" attribute', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topRules = getTopLevelStyleRules(Array.from(stylesheet.cssRules));

    const hasValidWrapper = docs.some(({ document }) => {
      const regions = Array.from(document.querySelectorAll('[role="region"][tabindex="0"]'));
      return regions.some((wrapper) => {
        if (!wrapper.querySelector('table')) return false;

        const ariaLabel = wrapper.getAttribute('aria-label')?.trim();
        const ariaLabelledBy = wrapper.getAttribute('aria-labelledby')?.trim();
        const hasValidLabelledBy = Boolean(
          ariaLabelledBy &&
            ariaLabelledBy
              .split(/\s+/)
              .some((id: string) => Boolean(document.getElementById(id)?.textContent?.trim()))
        );
        if (!ariaLabel && !hasValidLabelledBy) return false;

        const cascaded = getCascadedStyle(wrapper, topRules);
        const overflow = [
          cascaded.getPropertyValue('overflow'),
          cascaded.getPropertyValue('overflow-x'),
          cascaded.getPropertyValue('overflow-y'),
        ].join(' ');
        const hasScrollCss =
          /\b(auto|scroll)\b/.test(overflow) ||
          topRules.some(
            (r) =>
              /\b(auto|scroll)\b/.test(
                [
                  r.style.getPropertyValue('overflow'),
                  r.style.getPropertyValue('overflow-x'),
                  r.style.getPropertyValue('overflow-y'),
                ].join(' ')
              )
          ) ||
          /\boverflow-(x-|y-)?(auto|scroll)\b/.test(wrapper.getAttribute('class') || '');

        return hasScrollCss;
      });
    });

    expect(hasValidWrapper).toBe(true);
  });

  test('In the wide table layout, column headers remain fixed at the top of the scrollable area during vertical scroll', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topRules = getTopLevelStyleRules(Array.from(stylesheet.cssRules));

    const hasStickyColumnHeaders = docs.some(({ document }) => {
      const thead = document.querySelector('table thead');
      const theadTh = document.querySelector('table thead th');
      if (!thead && !theadTh) return false;

      const targets = [thead, theadTh].filter((el): el is NonNullable<typeof el> => el !== null);
      const matchedViaCascade = targets.some((el) => {
        const cascaded = getCascadedStyle(el, topRules);
        return (
          cascaded.getPropertyValue('position').trim() === 'sticky' &&
          hasZeroBlockStart(cascaded)
        );
      });

      const matchedViaRule = topRules.some(
        (r) =>
          /\bthead\b/.test(r.selectorText) &&
          r.style.getPropertyValue('position').trim() === 'sticky' &&
          hasZeroBlockStart(r.style)
      );

      const matchedViaUtility = targets.some((el) => {
        const cls = el.getAttribute('class') || '';
        return /\bsticky\b/.test(cls) && /\b(top-0|inset-block-start-0)\b/.test(cls);
      });

      return matchedViaCascade || matchedViaRule || matchedViaUtility;
    });

    expect(hasStickyColumnHeaders).toBe(true);
  });

  test('In the wide table layout, the first column (row headers) remains fixed at the inline start of the scrollable area during horizontal scroll', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topRules = getTopLevelStyleRules(Array.from(stylesheet.cssRules));

    const hasStickyRowHeaders = docs.some(({ document }) => {
      const tbodyTh = document.querySelector('table tbody th');
      if (!tbodyTh) return false;

      const cascaded = getCascadedStyle(tbodyTh, topRules);
      const matchedViaCascade =
        cascaded.getPropertyValue('position').trim() === 'sticky' &&
        hasZeroInlineStart(cascaded);

      const matchedViaRule = topRules.some(
        (r) =>
          /\b(tbody\s+th|th\[scope=['"]?row['"]?\]|tr\s+th)\b/.test(r.selectorText) &&
          r.style.getPropertyValue('position').trim() === 'sticky' &&
          hasZeroInlineStart(r.style)
      );

      const cls = tbodyTh.getAttribute('class') || '';
      const matchedViaUtility =
        /\bsticky\b/.test(cls) && /\b(left-0|start-0|inset-inline-start-0)\b/.test(cls);

      return matchedViaCascade || matchedViaRule || matchedViaUtility;
    });

    expect(hasStickyRowHeaders).toBe(true);
  });

  test('When the table container is narrow (via a @container width query), the table layout transforms into a stacked view where rows are separated blocks', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = Array.from(stylesheet.cssRules);
    const topRules = getTopLevelStyleRules(allRules);
    const responsiveRules = getResponsiveStyleRules(allRules);
    const combinedRules = [...topRules, ...responsiveRules];

    const hasStackedLayout = docs.some(({ document }) => {
      const tr = document.querySelector('table tbody tr');
      const td = document.querySelector('table tbody td');
      if (!tr || !td) return false;

      const hasContainerType =
        topRules.some((r) =>
          /\b(inline-size|size)\b/.test(r.style.getPropertyValue('container-type'))
        ) || Boolean(document.querySelector('[class*="@container"]'));

      const trCascaded = getCascadedStyle(tr, combinedRules);
      const tdCascaded = getCascadedStyle(td, combinedRules);

      const isStackedViaCascade =
        /\b(block|flex|grid)\b/.test(trCascaded.getPropertyValue('display')) &&
        /\b(block|flex|grid)\b/.test(tdCascaded.getPropertyValue('display'));

      const isStackedViaRules =
        responsiveRules.some(
          (r) =>
            /\btr\b/.test(r.selectorText) &&
            /\b(block|flex|grid)\b/.test(r.style.getPropertyValue('display'))
        ) &&
        responsiveRules.some(
          (r) =>
            /\btd\b/.test(r.selectorText) &&
            /\b(block|flex|grid)\b/.test(r.style.getPropertyValue('display'))
        );

      return hasContainerType && (isStackedViaCascade || isStackedViaRules);
    });

    expect(hasStackedLayout).toBe(true);
  });

  test('In the stacked view, the thead element is hidden and is not accessible to screen readers', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = Array.from(stylesheet.cssRules);
    const topRules = getTopLevelStyleRules(allRules);
    const responsiveRules = getResponsiveStyleRules(allRules);
    const combinedRules = [...topRules, ...responsiveRules];

    const isTheadHidden = docs.some(({ document }) => {
      const thead = document.querySelector('table thead');
      if (!thead) return false;

      const cascaded = getCascadedStyle(thead, combinedRules);
      const hiddenViaCascade = cascaded.getPropertyValue('display').trim() === 'none';

      const hiddenViaRule = responsiveRules.some(
        (r) =>
          /\bthead\b/.test(r.selectorText) &&
          r.style.getPropertyValue('display').trim() === 'none'
      );

      return hiddenViaCascade || hiddenViaRule;
    });

    expect(isTheadHidden).toBe(true);
  });

  test('In the stacked view, each data cell (td) displays a label corresponding to its column header using a pseudo-element', async ({ page, TARGET_URL }) => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = Array.from(stylesheet.cssRules);
    const responsiveRules = getResponsiveStyleRules(allRules);
    const allStyleRules = collectAllStyleRules(allRules);

    const candidateRules = responsiveRules.length > 0 ? responsiveRules : allStyleRules;
    const pseudoRulesWithContent = candidateRules.filter((r) => {
      const isTdBefore = /\btd\b.*::?before\b/.test(r.selectorText);
      const content = r.style.getPropertyValue('content').trim();
      const hasValidContent =
        content.length > 0 && content !== 'none' && content !== 'normal' && content !== '""' && content !== "''";
      return isTdBefore && hasValidContent;
    });

    // Collect custom property definitions (--label-*) and resolved pseudo-element content
    const customProps = new Map<string, string>();
    for (const r of allStyleRules) {
      for (let i = 0; i < r.style.length; i++) {
        const propName = r.style.item(i);
        if (propName.startsWith('--')) {
          customProps.set(propName, r.style.getPropertyValue(propName).replace(/['"]/g, '').trim().toLowerCase());
        }
      }
    }

    const resolvedLabels = new Set<string>();
    for (const r of pseudoRulesWithContent) {
      const content = r.style.getPropertyValue('content');
      for (const m of content.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*\)/g)) {
        const val = customProps.get(m[1]);
        if (val) resolvedLabels.add(val);
      }
      const literal = content.replace(/var\([^)]*\)|attr\([^)]*\)|['":\s/]/g, ' ').trim().toLowerCase();
      if (literal) resolvedLabels.add(literal);
    }

    const matchesColumnHeadersStatic = docs.some(({ document }) => {
      const table = document.querySelector('table');
      if (!table) return false;
      const ths = Array.from(table.querySelectorAll('thead th'))
        .map((th) => (th.textContent || '').trim().toLowerCase())
        .filter(Boolean);
      const dataHeaders = ths.slice(1);
      if (dataHeaders.length === 0) return false;

      // Also collect any data-* attribute values referenced via attr(...) on td::before
      const usesAttr = pseudoRulesWithContent.some((r) => /\battr\s*\(/.test(r.style.getPropertyValue('content')));
      if (usesAttr) {
        for (const td of Array.from(table.querySelectorAll('tbody td'))) {
          for (const attr of Array.from(td.attributes || [])) {
            if (attr.name.startsWith('data-') && attr.value) {
              resolvedLabels.add(attr.value.trim().toLowerCase());
            }
          }
        }
      }

      return dataHeaders.every((headerText) =>
        Array.from(resolvedLabels).some(
          (label) => label.includes(headerText) || headerText.includes(label)
        )
      );
    });

    const hasStaticColumnLabels =
      (pseudoRulesWithContent.length >= 2 ||
        pseudoRulesWithContent.some((r) => /\b(attr|var)\s*\(/.test(r.style.getPropertyValue('content')))) &&
      matchesColumnHeadersStatic;

    if (hasStaticColumnLabels) {
      expect(hasStaticColumnLabels).toBe(true);
      return;
    }

    // Fallback to live browser evaluation at narrow viewport so JS-synced custom properties (from guide.md) also pass
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto(TARGET_URL);
    const hasRuntimeColumnLabels = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return false;
      const ths = Array.from(table.querySelectorAll('thead th'))
        .map((th) => (th.textContent || '').trim().toLowerCase())
        .filter(Boolean);
      const dataHeaders = ths.slice(1);
      if (dataHeaders.length === 0) return false;

      const firstRowTds = Array.from(table.querySelectorAll('tbody tr:first-child td'));
      if (firstRowTds.length < dataHeaders.length) return false;

      const beforeLabels = firstRowTds.map((td) =>
        getComputedStyle(td, '::before')
          .getPropertyValue('content')
          .replace(/['":\s/]/g, ' ')
          .trim()
          .toLowerCase()
      );

      return dataHeaders.every((headerText, i) => {
        const cellLabel = beforeLabels[i] || '';
        return (
          cellLabel.length > 0 &&
          cellLabel !== 'none' &&
          cellLabel !== 'normal' &&
          (cellLabel.includes(headerText) || headerText.includes(cellLabel))
        );
      });
    });

    expect(hasRuntimeColumnLabels).toBe(true);
  });

  test('In the stacked view, row headers (tbody th) are sticky at the top of their respective row block during scroll', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = Array.from(stylesheet.cssRules);
    const topRules = getTopLevelStyleRules(allRules);
    const responsiveRules = getResponsiveStyleRules(allRules);
    const combinedRules = [...topRules, ...responsiveRules];

    const hasStickyStackedRowHeader = docs.some(({ document }) => {
      const tbodyTh = document.querySelector('table tbody th');
      if (!tbodyTh) return false;

      if (responsiveRules.length === 0) return false;

      const cascaded = getCascadedStyle(tbodyTh, combinedRules);
      const matchedViaCascade =
        cascaded.getPropertyValue('position').trim() === 'sticky' &&
        hasZeroBlockStart(cascaded);

      const hasStickyPositionRule = combinedRules.some(
        (r) =>
          !/\bthead\b/.test(r.selectorText) &&
          /\b(tbody\s+th|th\[scope=['"]?row['"]?\]|tr\s+th|th)\b/.test(r.selectorText) &&
          r.style.getPropertyValue('position').trim() === 'sticky'
      );
      const hasNonStickyResponsiveOverride = responsiveRules.some((r) => {
        if (/\bthead\b/.test(r.selectorText) || !/\b(tbody\s+th|th)\b/.test(r.selectorText)) return false;
        const pos = r.style.getPropertyValue('position').trim();
        return pos.length > 0 && pos !== 'sticky';
      });
      const matchedViaRules =
        hasStickyPositionRule &&
        !hasNonStickyResponsiveOverride &&
        responsiveRules.some(
          (r) =>
            !/\bthead\b/.test(r.selectorText) &&
            /\b(tbody\s+th|th)\b/.test(r.selectorText) &&
            hasZeroBlockStart(r.style)
        );

      return matchedViaCascade || matchedViaRules;
    });

    expect(hasStickyStackedRowHeader).toBe(true);
  });
});
