import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSRule,
  CSSGroupingRule,
  CSSStyleRule,
  CSSContainerRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-expect-error TS1470: Playwright executes grader.ts as an ES module where import.meta.url is available
const targetFiles: string[] = getTargetFiles(import.meta.url);
const indexFile =
  targetFiles.find((f) => path.basename(f) === 'index.html') ?? targetFiles[0] ?? '';
const targetDir = indexFile ? path.dirname(indexFile) : process.cwd();

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function collectAllCssRules(ruleList: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of ruleList) {
    result.push(rule);
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...collectAllCssRules(Array.from((rule as CSSGroupingRule).cssRules)));
    }
  }
  return result;
}

function isHostSelector(selectorText: string): boolean {
  return /(^|,)\s*:host(\b|\(|$)/.test(selectorText) && !selectorText.includes(':host-context(');
}

test.describe('styling-web-components Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test("The component's shadow stylesheet sets the host's display with a :host rule", () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(Array.from(stylesheet.cssRules));
    const hostRules = allRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && isHostSelector(r.selectorText)
    );

    expect(hostRules.length).toBeGreaterThan(0);

    const setsHostDisplay = hostRules.some(
      (r) => r.style.getPropertyValue('display').trim().length > 0
    );
    expect(setsHostDisplay).toBe(true);
  });

  test("The component's shadow stylesheet does not use :host-context()", () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(Array.from(stylesheet.cssRules));
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hostRules = styleRules.filter((r) => isHostSelector(r.selectorText));
    expect(hostRules.length).toBeGreaterThan(0);

    const hostContextRules = styleRules.filter((r) => r.selectorText.includes(':host-context('));
    expect(hostContextRules).toHaveLength(0);
  });

  test('Public theming custom properties are read with a var() fallback and are not declared on :host', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(Array.from(stylesheet.cssRules));
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hostRules = styleRules.filter((r) => isHostSelector(r.selectorText));
    expect(hostRules.length).toBeGreaterThan(0);

    const declaredOnHost = new Set<string>();
    for (const rule of hostRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style.item(i);
        if (prop.startsWith('--')) {
          declaredOnHost.add(prop);
        }
      }
    }

    // Any custom property declared directly on :host must be a private alias (--_*)
    const publicDeclaredOnHost = Array.from(declaredOnHost).filter(
      (prop) => !prop.startsWith('--_')
    );
    expect(publicDeclaredOnHost).toHaveLength(0);

    // Verify public custom properties are read with a var(--public-prop, fallback) expression
    const publicVarWithFallbackCount = styleRules.reduce((count, rule) => {
      let matches = 0;
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style.item(i);
        const val = rule.style.getPropertyValue(prop);
        if (/var\(\s*--(?!_)[a-zA-Z0-9_-]+\s*,/.test(val)) {
          matches++;
        }
      }
      return count + matches;
    }, 0);

    expect(publicVarWithFallbackCount).toBeGreaterThan(0);
  });

  test('The outer stylesheet uses ::part() to style exposed shadow parts', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(Array.from(stylesheet.cssRules));
    const partRules = allRules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule && r.selectorText.includes('::part(') && r.style.length > 0
    );

    expect(partRules.length).toBeGreaterThan(0);
  });

  test('The shadow stylesheet defines container-type: inline-size and a @container rule', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(Array.from(stylesheet.cssRules));

    const containerRules = allRules.filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule && r.cssRules.length > 0
    );
    expect(containerRules.length).toBeGreaterThan(0);

    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const hasInlineSizeContainer = styleRules.some((r) => {
      const containerType = r.style.getPropertyValue('container-type');
      const containerShorthand = r.style.getPropertyValue('container');
      return (
        /\binline-size\b/.test(containerType) || /\binline-size\b/.test(containerShorthand)
      );
    });
    expect(hasInlineSizeContainer).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('http://localhost/**', async (route) => {
        const url = new URL(route.request().url());
        const relPath =
          url.pathname === '/' || url.pathname === '/index.html'
            ? 'index.html'
            : decodeURIComponent(url.pathname.replace(/^\/+/, ''));
        const filePath = path.resolve(targetDir, relPath);
        if (
          filePath.startsWith(targetDir) &&
          fs.existsSync(filePath) &&
          fs.statSync(filePath).isFile()
        ) {
          const ext = path.extname(filePath).toLowerCase();
          await route.fulfill({
            status: 200,
            contentType: MIME_TYPES[ext] ?? 'application/octet-stream',
            body: fs.readFileSync(filePath),
          });
        } else {
          await route.fulfill({ status: 404, body: 'Not found' });
        }
      });
      await page.goto('http://localhost/index.html');
    });

    test('Setting a public theming custom property on a Light DOM ancestor changes an internal element computed style', async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const customElementsWithShadow = Array.from(document.querySelectorAll('main *')).filter(
          (el): el is HTMLElement => el.tagName.includes('-') && Boolean(el.shadowRoot)
        );
        if (customElementsWithShadow.length === 0) {
          return { cardCount: 0, internalStyleChanged: false };
        }

        // Collect all public custom property names (--name, not --_name) referenced via var() in shadow stylesheets
        const publicProps = new Set<string>();
        for (const host of customElementsWithShadow) {
          const shadow = host.shadowRoot!;
          const styleTexts: string[] = [];
          shadow.querySelectorAll('style').forEach((s) => {
            if (s.textContent) styleTexts.push(s.textContent);
          });
          if ('adoptedStyleSheets' in shadow && shadow.adoptedStyleSheets) {
            for (const sheet of shadow.adoptedStyleSheets) {
              try {
                for (const rule of Array.from(sheet.cssRules)) {
                  styleTexts.push(rule.cssText);
                }
              } catch {
                // ignore cross-origin sheets
              }
            }
          }
          const combined = styleTexts.join('\n');
          const matches = combined.matchAll(/var\(\s*(--(?!_)[a-zA-Z0-9_-]+)/g);
          for (const m of matches) {
            publicProps.add(m[1]);
          }
        }

        if (publicProps.size === 0) {
          return { cardCount: customElementsWithShadow.length, internalStyleChanged: false };
        }

        const testColor = 'rgb(18, 52, 86)';
        const trackedProps = [
          'backgroundColor',
          'color',
          'borderTopColor',
          'borderBottomColor',
          'borderLeftColor',
          'borderRightColor',
          'outlineColor',
        ] as const;

        // Snapshot host and internal element styles before setting custom properties on the Light DOM ancestor
        const beforeSnapshots = customElementsWithShadow.map((host) => {
          const internals = [host, ...Array.from(host.shadowRoot!.querySelectorAll('*'))];
          return internals.map((el) => {
            const cs = window.getComputedStyle(el);
            return trackedProps.map((p) => cs[p]);
          });
        });

        // Set public custom properties on the Light DOM parent of the cards
        const ancestors = new Set<HTMLElement>();
        for (const host of customElementsWithShadow) {
          if (host.parentElement) {
            ancestors.add(host.parentElement);
          }
        }
        for (const ancestor of ancestors) {
          for (const prop of publicProps) {
            ancestor.style.setProperty(prop, testColor);
          }
        }

        let internalStyleChanged = false;
        customElementsWithShadow.forEach((host, hostIdx) => {
          const internals = [host, ...Array.from(host.shadowRoot!.querySelectorAll('*'))];
          internals.forEach((el, elIdx) => {
            const cs = window.getComputedStyle(el);
            const before = beforeSnapshots[hostIdx][elIdx];
            trackedProps.forEach((p, propIdx) => {
              const afterVal = cs[p];
              if (afterVal !== before[propIdx] && afterVal === testColor) {
                internalStyleChanged = true;
              }
            });
          });
        });

        // Clean up ancestor inline styles
        for (const ancestor of ancestors) {
          for (const prop of publicProps) {
            ancestor.style.removeProperty(prop);
          }
        }

        return {
          cardCount: customElementsWithShadow.length,
          internalStyleChanged,
        };
      });

      expect(result.cardCount).toBeGreaterThan(0);
      expect(result.internalStyleChanged).toBe(true);
    });

    test('The shadow tree exposes internal elements via part and the outer stylesheet changes their computed styles via ::part()', async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const customElementsWithShadow = Array.from(document.querySelectorAll('main *')).filter(
          (el): el is HTMLElement => el.tagName.includes('-') && Boolean(el.shadowRoot)
        );
        if (customElementsWithShadow.length === 0) {
          return { partElementCount: 0, partStyleChanged: false };
        }

        const inspectedProps = [
          'fontWeight',
          'fontSize',
          'letterSpacing',
          'backgroundColor',
          'color',
          'borderTopColor',
          'borderRadius',
          'paddingTop',
          'paddingLeft',
          'textTransform',
          'lineHeight',
          'fontStyle',
          'textDecorationLine',
          'boxShadow',
          'opacity',
        ] as const;

        let partElementCount = 0;
        let partStyleChanged = false;

        for (const host of customElementsWithShadow) {
          const partEls = Array.from(host.shadowRoot!.querySelectorAll('[part]'));
          for (const el of partEls) {
            const partValue = el.getAttribute('part');
            if (!partValue) continue;
            partElementCount++;

            const withPart = inspectedProps.map((p) => window.getComputedStyle(el)[p]);
            el.removeAttribute('part');
            const withoutPart = inspectedProps.map((p) => window.getComputedStyle(el)[p]);
            el.setAttribute('part', partValue);

            if (withPart.some((val, idx) => val !== withoutPart[idx])) {
              partStyleChanged = true;
            }
          }
        }

        return { partElementCount, partStyleChanged };
      });

      expect(result.partElementCount).toBeGreaterThan(0);
      expect(result.partStyleChanged).toBe(true);
    });

    test('The inline-size container has a display other than inline or contents and @container changes an internal element computed style across its breakpoint', async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const customElementsWithShadow = Array.from(document.querySelectorAll('main *')).filter(
          (el): el is HTMLElement => el.tagName.includes('-') && Boolean(el.shadowRoot)
        );
        if (customElementsWithShadow.length === 0) {
          return {
            foundContainer: false,
            containerDisplay: '',
            responsiveChanged: false,
          };
        }

        const host = customElementsWithShadow[0];
        const candidates: Element[] = [
          host,
          ...Array.from(host.shadowRoot!.querySelectorAll('*')),
        ];

        const containerEl = candidates.find((el) =>
          /\binline-size\b/.test(window.getComputedStyle(el).containerType)
        );

        if (!containerEl) {
          return {
            foundContainer: false,
            containerDisplay: '',
            responsiveChanged: false,
          };
        }

        const containerDisplay = window.getComputedStyle(containerEl).display;

        const snapshotInternalLayout = (root: ShadowRoot) => {
          return Array.from(root.querySelectorAll('*')).map((el) => {
            const cs = window.getComputedStyle(el);
            const gridCols = cs.gridTemplateColumns.trim();
            const colTrackCount =
              gridCols && gridCols !== 'none' ? gridCols.split(/\s+/).length : 0;
            return {
              colTrackCount,
              textAlign: cs.textAlign,
              paddingTop: cs.paddingTop,
              paddingLeft: cs.paddingLeft,
              flexDirection: cs.flexDirection,
              alignItems: cs.alignItems,
              justifyContent: cs.justifyContent,
              alignSelf: cs.alignSelf,
              columnGap: cs.columnGap,
              rowGap: cs.rowGap,
            };
          });
        };

        const prevWidth = host.style.width;
        const prevMaxWidth = host.style.maxWidth;
        const prevMinWidth = host.style.minWidth;

        host.style.minWidth = '0px';
        host.style.maxWidth = 'none';
        host.style.width = '180px';
        const narrowLayout = snapshotInternalLayout(host.shadowRoot!);

        host.style.width = '750px';
        const wideLayout = snapshotInternalLayout(host.shadowRoot!);

        host.style.width = prevWidth;
        host.style.maxWidth = prevMaxWidth;
        host.style.minWidth = prevMinWidth;

        const responsiveChanged = narrowLayout.some((narrow, idx) => {
          const wide = wideLayout[idx];
          return (
            narrow.colTrackCount !== wide.colTrackCount ||
            narrow.textAlign !== wide.textAlign ||
            narrow.paddingTop !== wide.paddingTop ||
            narrow.paddingLeft !== wide.paddingLeft ||
            narrow.flexDirection !== wide.flexDirection ||
            narrow.alignItems !== wide.alignItems ||
            narrow.justifyContent !== wide.justifyContent ||
            narrow.alignSelf !== wide.alignSelf ||
            narrow.columnGap !== wide.columnGap ||
            narrow.rowGap !== wide.rowGap
          );
        });

        return {
          foundContainer: true,
          containerDisplay,
          responsiveChanged,
        };
      });

      expect(result.foundContainer).toBe(true);
      expect(result.containerDisplay).not.toBe('inline');
      expect(result.containerDisplay).not.toBe('contents');
      expect(result.responsiveChanged).toBe(true);
    });
  });
});
