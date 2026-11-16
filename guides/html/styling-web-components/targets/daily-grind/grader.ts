import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  parse,
  CSSRule,
  CSSGroupingRule,
  CSSStyleRule,
  CSSContainerRule,
} from 'cssomnom';
import { parseHTML } from 'linkedom';
import { Node, SyntaxKind, type SourceFile } from 'ts-morph';

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

function parseCssBlock(cssText: string): CSSRule[] {
  if (!cssText.trim()) return [];
  try {
    const sheet = parse(cssText);
    return collectAllCssRules(Array.from(sheet.cssRules));
  } catch {
    return [];
  }
}

function unwrapExpression(node: Node | undefined): Node | undefined {
  let current = node;
  while (
    current &&
    (Node.isParenthesizedExpression(current) ||
      Node.isAsExpression(current) ||
      Node.isTypeAssertion(current) ||
      Node.isSatisfiesExpression(current) ||
      Node.isNonNullExpression(current))
  ) {
    current = current.getExpression();
  }
  return current;
}

function resolveStaticString(
  node: Node | undefined,
  sourceFile: SourceFile,
  visited = new Set<string>()
): string | undefined {
  const target = unwrapExpression(node);
  if (!target) return undefined;

  if (Node.isStringLiteral(target) || Node.isNoSubstitutionTemplateLiteral(target)) {
    return target.getLiteralValue();
  }

  if (Node.isTemplateExpression(target)) {
    let text = target.getHead().getLiteralText();
    for (const span of target.getTemplateSpans()) {
      const exprText = resolveStaticString(span.getExpression(), sourceFile, visited);
      text += (exprText ?? '') + span.getLiteral().getLiteralText();
    }
    return text;
  }

  if (Node.isIdentifier(target)) {
    const name = target.getText();
    if (visited.has(name)) return undefined;
    visited.add(name);
    const decl = sourceFile
      .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((d) => d.getName() === name);
    if (decl) {
      return resolveStaticString(decl.getInitializer(), sourceFile, visited);
    }
  }

  return undefined;
}

/**
 * Extracts CSS rules from the outer Light DOM page stylesheets (.css files and
 * document <style> elements outside of <template> trees) using Linkedom + CSSOMNom.
 */
function getOuterCssRules(files: string[]): CSSRule[] {
  const rules: CSSRule[] = [];

  for (const file of files) {
    if (file.endsWith('.css') && fs.existsSync(file) && fs.statSync(file).isFile()) {
      rules.push(...parseCssBlock(fs.readFileSync(file, 'utf-8')));
    }
  }

  for (const { document } of getHtmlDocuments(files)) {
    document.querySelectorAll('style').forEach((styleEl: any) => {
      if (styleEl.closest?.('template')) return;
      if (styleEl.textContent) {
        rules.push(...parseCssBlock(styleEl.textContent));
      }
    });
  }

  return rules;
}

/**
 * Extracts CSS rules from component shadow stylesheets using Linkedom (<template> trees
 * and HTML fragments) and ts-morph (CSSStyleSheet.replaceSync / replace calls and
 * shadow template HTML strings).
 */
function getShadowCssRules(files: string[]): CSSRule[] {
  const rules: CSSRule[] = [];
  const extractStylesFromHtmlFragment = (html: string) => {
    if (!html.includes('<style')) return;
    try {
      const { document } = parseHTML(html);
      document.querySelectorAll('style').forEach((styleEl: any) => {
        if (styleEl.textContent) {
          rules.push(...parseCssBlock(styleEl.textContent));
        }
      });
    } catch {
      // ignore malformed HTML fragment
    }
  };

  // 1. HTML <template> elements via Linkedom
  for (const { document } of getHtmlDocuments(files)) {
    document.querySelectorAll('template').forEach((tmpl: any) => {
      const html = tmpl.innerHTML || tmpl.content?.innerHTML || '';
      extractStylesFromHtmlFragment(html);
    });
  }

  // 2. JS/TS AST via ts-morph (template innerHTML strings and Constructable Stylesheets)
  const project = getJsProject(files);
  for (const sf of project.getSourceFiles()) {
    // 2a. Calls to sheet.replaceSync(css) or sheet.replace(css)
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = unwrapExpression(call.getExpression());
      if (Node.isPropertyAccessExpression(callee)) {
        const method = callee.getName();
        if (method === 'replaceSync' || method === 'replace') {
          const cssArg = resolveStaticString(call.getArguments()[0], sf);
          if (cssArg) {
            rules.push(...parseCssBlock(cssArg));
          }
        }
      }
    }

    // 2b. String/template literals containing <style> markup (e.g. template.innerHTML = `...`)
    for (const node of [
      ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
      ...sf.getDescendantsOfKind(SyntaxKind.TemplateExpression),
      ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ]) {
      if (Node.isTemplateExpression(node.getParent()?.getParent())) continue;
      const val = resolveStaticString(node, sf);
      if (val && val.includes('<style')) {
        extractStylesFromHtmlFragment(val);
      }
    }
  }

  return rules;
}

function splitTopLevelSelectors(selectorList: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selectorList) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Matches a selector list where at least one selector targets `:host` or `:host(...)`
 * directly as the subject (not a descendant like `:host .child` and not `:host-context()`).
 */
function isHostSubjectSelector(selectorText: string): boolean {
  if (selectorText.includes(':host-context(')) return false;
  return splitTopLevelSelectors(selectorText).some((sel) => {
    if (!sel.startsWith(':host')) return false;
    const rest = sel.slice(':host'.length);
    if (rest === '') return true;
    if (!rest.startsWith('(')) return false;
    // Walk balanced parentheses after :host(
    let depth = 0;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '(') depth++;
      else if (rest[i] === ')') {
        depth--;
        if (depth === 0) {
          const afterHostFn = rest.slice(i + 1);
          // Allow pseudo-classes on the host itself (e.g. :host([variant]):hover), but no combinators/whitespace outside parens
          return !/[\s>+~]/.test(afterHostFn);
        }
      }
    }
    return false;
  });
}

/**
 * Matches a selector list containing an unconditional `:host` selector.
 */
function isPlainHostSelector(selectorText: string): boolean {
  return splitTopLevelSelectors(selectorText).some((sel) => sel === ':host');
}

test.describe('styling-web-components Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test("The component's shadow stylesheet sets the host's display with a :host rule", () => {
    const shadowRules = getShadowCssRules(targetFiles);
    const plainHostRules = shadowRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && isPlainHostSelector(r.selectorText)
    );

    expect(plainHostRules.length).toBeGreaterThan(0);

    const setsHostDisplay = plainHostRules.some(
      (r) => r.style.getPropertyValue('display').trim().length > 0
    );
    expect(setsHostDisplay).toBe(true);
  });

  test("The component's shadow stylesheet does not use :host-context()", () => {
    const shadowRules = getShadowCssRules(targetFiles);
    const styleRules = shadowRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hostRules = styleRules.filter((r) => isHostSubjectSelector(r.selectorText));
    expect(hostRules.length).toBeGreaterThan(0);

    const hostContextRules = styleRules.filter((r) => r.selectorText.includes(':host-context('));
    expect(hostContextRules).toHaveLength(0);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR + PARSER VERIFICATION) ---

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

    test("Public theming custom properties (such as --card-bg) are read with a var() fallback and are not declared on :host; private aliases on :host that read them (such as --_card-bg: var(--card-bg, white)) are allowed. Setting the public property on any Light DOM ancestor changes the host's or an internal element's computed style", async ({
      page,
    }) => {
      // 1. Static shadow CSSOM check: public custom properties are read with var() fallback and not declared on :host
      const shadowRules = getShadowCssRules(targetFiles);
      const styleRules = shadowRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

      const hostRules = styleRules.filter((r) => isHostSubjectSelector(r.selectorText));
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

      const publicDeclaredOnHost = Array.from(declaredOnHost).filter(
        (prop) => !prop.startsWith('--_')
      );
      expect(publicDeclaredOnHost).toHaveLength(0);

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

      // 2. Runtime check: setting the public custom property on a Light DOM ancestor changes host or internal element computed style
      const result = await page.evaluate(() => {
        const customElementsWithShadow = Array.from(document.querySelectorAll('main *')).filter(
          (el): el is HTMLElement => el.tagName.includes('-') && Boolean(el.shadowRoot)
        );
        if (customElementsWithShadow.length === 0) {
          return { cardCount: 0, styleChanged: false };
        }

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
          for (const m of combined.matchAll(/var\(\s*(--(?!_)[a-zA-Z0-9_-]+)/g)) {
            publicProps.add(m[1]);
          }
        }

        if (publicProps.size === 0) {
          return { cardCount: customElementsWithShadow.length, styleChanged: false };
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

        const beforeSnapshots = customElementsWithShadow.map((host) => {
          const elements = [host, ...Array.from(host.shadowRoot!.querySelectorAll('*'))];
          return elements.map((el) => {
            const cs = window.getComputedStyle(el);
            return trackedProps.map((p) => cs[p]);
          });
        });

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

        let styleChanged = false;
        customElementsWithShadow.forEach((host, hostIdx) => {
          const elements = [host, ...Array.from(host.shadowRoot!.querySelectorAll('*'))];
          elements.forEach((el, elIdx) => {
            const cs = window.getComputedStyle(el);
            const before = beforeSnapshots[hostIdx][elIdx];
            trackedProps.forEach((p, propIdx) => {
              const afterVal = cs[p];
              if (afterVal !== before[propIdx] && afterVal === testColor) {
                styleChanged = true;
              }
            });
          });
        });

        for (const ancestor of ancestors) {
          for (const prop of publicProps) {
            ancestor.style.removeProperty(prop);
          }
        }

        return {
          cardCount: customElementsWithShadow.length,
          styleChanged,
        };
      });

      expect(result.cardCount).toBeGreaterThan(0);
      expect(result.styleChanged).toBe(true);
    });

    test('The shadow tree exposes designated internal elements via the part attribute, and the outer stylesheet styles them across the shadow boundary using the ::part() pseudo-element to change their computed styles', async ({
      page,
    }) => {
      // 1. Static outer CSSOM check: outer Light DOM stylesheet contains ::part() rules
      const outerRules = getOuterCssRules(targetFiles);
      const partRules = outerRules.filter(
        (r): r is CSSStyleRule =>
          r instanceof CSSStyleRule && r.selectorText.includes('::part(') && r.style.length > 0
      );
      expect(partRules.length).toBeGreaterThan(0);

      // 2. Runtime check: shadow tree exposes [part] elements and outer ::part() rules change their computed style
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

    test("The element given container-type: inline-size (on the host or an internal wrapper) has a display property other than inline or contents, and a @container rule in the shadow stylesheet changes an internal element's computed style when the component's inline size crosses its breakpoint", async ({
      page,
    }) => {
      // 1. Static shadow CSSOM check: shadow stylesheet defines container-type: inline-size and a @container rule
      const shadowRules = getShadowCssRules(targetFiles);
      const containerRules = shadowRules.filter(
        (r): r is CSSContainerRule => r instanceof CSSContainerRule && r.cssRules.length > 0
      );
      expect(containerRules.length).toBeGreaterThan(0);

      const styleRules = shadowRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
      const hasInlineSizeContainer = styleRules.some((r) => {
        const containerType = r.style.getPropertyValue('container-type');
        const containerShorthand = r.style.getPropertyValue('container');
        return (
          /\binline-size\b/.test(containerType) || /\binline-size\b/.test(containerShorthand)
        );
      });
      expect(hasInlineSizeContainer).toBe(true);

      // 2. Runtime check: inline-size container has display !== 'inline' / 'contents' and @container changes internal computed style across breakpoint
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
