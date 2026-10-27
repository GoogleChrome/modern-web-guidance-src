import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSGroupingRule,
  CSSContainerRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectAllRules(rule.cssRules));
    }
  }
  return result;
}

function getAllStyleRules(sheet: CSSStyleSheet): CSSStyleRule[] {
  return collectAllRules(sheet.cssRules).filter(
    (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule
  );
}

function isPlainHostSelector(selectorText: string): boolean {
  return selectorText
    .split(',')
    .map((s) => s.trim())
    .some((s) => s === ':host');
}

function extractVarReferences(value: string): Array<{ prop: string; fallback: string }> {
  const results: Array<{ prop: string; fallback: string }> = [];
  const token = 'var(';
  let idx = value.indexOf(token);
  while (idx !== -1) {
    let depth = 1;
    let i = idx + token.length;
    let commaIdx = -1;
    while (i < value.length && depth > 0) {
      if (value[i] === '(') depth++;
      else if (value[i] === ')') depth--;
      else if (value[i] === ',' && depth === 1 && commaIdx === -1) {
        commaIdx = i;
      }
      i++;
    }
    if (depth === 0) {
      const inner = value.slice(idx + token.length, i - 1);
      if (commaIdx !== -1) {
        const prop = value.slice(idx + token.length, commaIdx).trim();
        const fallback = value.slice(commaIdx + 1, i - 1).trim();
        results.push({ prop, fallback });
        results.push(...extractVarReferences(fallback));
      } else {
        results.push({ prop: inner.trim(), fallback: '' });
      }
    }
    idx = value.indexOf(token, idx + token.length);
  }
  return results;
}

test.describe('styling-web-components Target Grader', () => {
  test('The component shadow stylesheet sets the host display with a :host rule', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);
    const hasHostDisplay = styleRules.some(
      (rule) =>
        isPlainHostSelector(rule.selectorText) &&
        rule.style.getPropertyValue('display').trim().length > 0
    );
    expect(hasHostDisplay).toBe(true);
  });

  test('The component shadow stylesheet does not use :host-context()', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);
    const hasHostComponent = styleRules.some((rule) =>
      /\b:host\b/.test(rule.selectorText)
    );
    const usesHostContext = styleRules.some((rule) =>
      rule.selectorText.includes(':host-context(')
    );
    expect(hasHostComponent && !usesHostContext).toBe(true);
  });

  test('Public theming custom properties are read with a var() fallback and are not declared on :host', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);
    const hostRules = styleRules.filter((rule) =>
      /\b:host\b/.test(rule.selectorText)
    );

    const declaredOnHost = new Set<string>();
    for (const rule of hostRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const propName = rule.style[i];
        if (propName && propName.startsWith('--')) {
          declaredOnHost.add(propName.trim());
        }
      }
    }

    const publicVarWithFallback = new Set<string>();
    for (const rule of styleRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const propName = rule.style[i];
        if (!propName) continue;
        const propVal = rule.style.getPropertyValue(propName);
        const refs = extractVarReferences(propVal);
        for (const ref of refs) {
          if (
            ref.prop.startsWith('--') &&
            !ref.prop.startsWith('--_') &&
            ref.fallback.length > 0
          ) {
            publicVarWithFallback.add(ref.prop);
          }
        }
      }
    }

    const hasValidPublicThemingVars =
      hostRules.length > 0 &&
      publicVarWithFallback.size > 0 &&
      Array.from(publicVarWithFallback).every((prop) => !declaredOnHost.has(prop));

    expect(hasValidPublicThemingVars).toBe(true);
  });

  test('The element given container-type: inline-size has a display property other than inline or contents and a @container rule in the shadow stylesheet', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);
    const styleRules = allRules.filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule
    );
    const containerRules = allRules.filter(
      (rule): rule is CSSContainerRule => rule instanceof CSSContainerRule
    );

    const containerElementRules = styleRules.filter((rule) =>
      /\binline-size\b/.test(rule.style.getPropertyValue('container-type'))
    );

    const hasValidContainerSetup =
      containerElementRules.some((containerRule) => {
        const matchingSelectorRules = styleRules.filter(
          (r) => r.selectorText.trim() === containerRule.selectorText.trim()
        );
        const displayValues = matchingSelectorRules
          .map((r) => r.style.getPropertyValue('display').trim())
          .filter(Boolean);
        return (
          displayValues.length > 0 &&
          displayValues.every((d) => d !== 'inline' && d !== 'contents')
        );
      }) &&
      containerRules.some((cr) => collectAllRules(cr.cssRules).length > 0);

    expect(hasValidContainerSetup).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Setting a public theming custom property on a Light DOM ancestor changes the internal element computed style', async ({
      page,
    }) => {
      const styleChanged = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const host = allElements.find(
          (el) => el.tagName.includes('-') && el.shadowRoot
        ) as HTMLElement | undefined;
        if (!host || !host.shadowRoot) return false;

        const shadowElements = Array.from(
          host.shadowRoot.querySelectorAll('*')
        ).filter((el) => el.tagName !== 'STYLE' && el.tagName !== 'SLOT');
        if (shadowElements.length === 0) return false;

        // Collect all public custom properties referenced in the component's shadow styles
        const publicProps = new Set<string>();
        const collectFromRules = (rules: Iterable<any>) => {
          for (const rule of Array.from(rules)) {
            if (rule && rule.cssRules) {
              collectFromRules(rule.cssRules);
            }
            if (rule && rule.style && typeof rule.style.cssText === 'string') {
              const cssText: string = rule.style.cssText;
              const matches = cssText.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*,/g);
              for (const m of matches) {
                if (!m[1].startsWith('--_')) {
                  publicProps.add(m[1]);
                }
              }
            }
          }
        };

        for (const sheet of Array.from(host.shadowRoot.styleSheets)) {
          collectFromRules(sheet.cssRules);
        }
        for (const styleEl of Array.from(host.shadowRoot.querySelectorAll('style'))) {
          if (styleEl.sheet) collectFromRules(styleEl.sheet.cssRules);
        }

        if (publicProps.size === 0) return false;

        const trackedCssProps = [
          'backgroundColor',
          'color',
          'borderRadius',
          'paddingTop',
          'boxShadow',
        ] as const;

        const snapshot = () =>
          shadowElements.map((el) => {
            const cs = window.getComputedStyle(el);
            return trackedCssProps.map((p) => cs[p]).join('|');
          });

        const before = snapshot();
        const ancestor = host.parentElement || document.body;

        for (const prop of publicProps) {
          if (/bg|background|color|fg|title|heading/i.test(prop)) {
            ancestor.style.setProperty(prop, 'rgb(12, 34, 56)');
          } else if (/radius|padding|gap/i.test(prop)) {
            ancestor.style.setProperty(prop, '42px');
          } else {
            ancestor.style.setProperty(prop, 'rgb(12, 34, 56)');
          }
        }

        const after = snapshot();
        for (const prop of publicProps) {
          ancestor.style.removeProperty(prop);
        }

        return before.some((val, idx) => val !== after[idx]);
      });

      expect(styleChanged).toBe(true);
    });

    test('The shadow tree exposes designated internal elements via the part attribute and styling via ::part() in the outer stylesheet changes their computed styles', async ({
      page,
    }) => {
      const partStyled = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const host = allElements.find(
          (el) => el.tagName.includes('-') && el.shadowRoot
        ) as HTMLElement | undefined;
        if (!host || !host.shadowRoot) return false;

        const partEl = host.shadowRoot.querySelector('[part]');
        if (!partEl) return false;

        const partAttr = partEl.getAttribute('part')?.trim() || '';
        const partName = partAttr.split(/\s+/)[0];
        if (!partName) return false;

        const tagName = host.tagName.toLowerCase();
        const beforeBg = window.getComputedStyle(partEl).backgroundColor;
        const beforeOutline = window.getComputedStyle(partEl).outlineColor;

        const outerStyle = document.createElement('style');
        outerStyle.textContent = `${tagName}::part(${partName}) { background-color: rgb(21, 43, 65) !important; outline: 4px solid rgb(98, 76, 54) !important; }`;
        document.head.appendChild(outerStyle);

        const afterBg = window.getComputedStyle(partEl).backgroundColor;
        const afterOutline = window.getComputedStyle(partEl).outlineColor;
        outerStyle.remove();

        return (
          (afterBg === 'rgb(21, 43, 65)' && beforeBg !== afterBg) ||
          (afterOutline === 'rgb(98, 76, 54)' && beforeOutline !== afterOutline)
        );
      });

      expect(partStyled).toBe(true);
    });

    test('A @container rule in the shadow stylesheet changes an internal element computed style when the component inline size crosses its breakpoint', async ({
      page,
    }) => {
      const containerResponsive = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const host = allElements.find(
          (el) => el.tagName.includes('-') && el.shadowRoot
        ) as HTMLElement | undefined;
        if (!host || !host.shadowRoot) return false;

        const shadowElements = Array.from(
          host.shadowRoot.querySelectorAll('*')
        ).filter((el) => el.tagName !== 'STYLE' && el.tagName !== 'SLOT');
        if (shadowElements.length === 0) return false;

        const trackedProps = [
          'gridTemplateColumns',
          'textAlign',
          'flexDirection',
          'columnGap',
          'rowGap',
          'paddingTop',
          'justifyContent',
        ] as const;

        const getLayoutSnapshot = () =>
          shadowElements.map((el) => {
            const cs = window.getComputedStyle(el);
            return trackedProps.map((p) => cs[p]).join('|');
          });

        const prevWidth = host.style.width;
        const prevMaxWidth = host.style.maxWidth;
        const prevMinWidth = host.style.minWidth;

        host.style.minWidth = '0px';
        host.style.maxWidth = 'none';
        host.style.width = '180px';
        // Force layout reflow
        void host.offsetWidth;
        const narrowSnapshot = getLayoutSnapshot();

        host.style.width = '700px';
        void host.offsetWidth;
        const wideSnapshot = getLayoutSnapshot();

        host.style.width = prevWidth;
        host.style.maxWidth = prevMaxWidth;
        host.style.minWidth = prevMinWidth;

        return narrowSnapshot.some((val, idx) => val !== wideSnapshot[idx]);
      });

      expect(containerResponsive).toBe(true);
    });
  });
});
