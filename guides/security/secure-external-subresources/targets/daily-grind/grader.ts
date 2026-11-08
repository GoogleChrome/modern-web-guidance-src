import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import { CSSStyleRule, CSSFontFaceRule, type CSSStyleSheet } from 'cssomnom';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

const currentFileUrl: string =
  typeof __filename !== 'undefined'
    ? pathToFileURL(__filename).href
    : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

function isExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//');
}

function hasValidIntegrityDigest(value: string | null | undefined): boolean {
  if (!value) return false;
  const tokens = value.trim().split(/\s+/);
  return (
    tokens.length > 0 &&
    tokens.every((token) =>
      token.startsWith('sha384-') ||
      token.startsWith('sha512-') ||
      token.startsWith('sha256-')
    )
  );
}

function hasValidCrossOriginAttr(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed === 'anonymous' || trimmed === 'use-credentials';
}

function getExternalHtmlSubresources(docs: Array<{ file: string; document: any }>): any[] {
  const elements: any[] = [];
  for (const { document } of docs) {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    for (const script of scripts as any[]) {
      if (isExternalUrl(script.getAttribute('src'))) {
        elements.push(script);
      }
    }
    const links = Array.from(document.querySelectorAll('link[href]'));
    for (const link of links as any[]) {
      const rel = (link.getAttribute('rel') || '').toLowerCase();
      if (
        (rel.includes('stylesheet') || rel.includes('preload') || rel.includes('modulepreload')) &&
        isExternalUrl(link.getAttribute('href'))
      ) {
        elements.push(link);
      }
    }
  }
  return elements;
}

function isModifierEquippedCssUrl(val: string): boolean {
  const hasQuotedUrl =
    val.includes('url("') ||
    val.includes("url('") ||
    val.includes('url(\n') ||
    val.includes('url( "') ||
    val.includes('url( \n') ||
    val.includes('url(${JSON.stringify');
  const hasCrossOrigin =
    val.includes('cross-origin(anonymous)') ||
    val.includes('cross-origin(use-credentials)');
  const hasReferrerPolicy =
    val.includes('referrer-policy(no-referrer)') ||
    val.includes('referrer-policy(strict-origin-when-cross-origin)') ||
    val.includes('referrer-policy(origin)') ||
    val.includes('referrer-policy(same-origin)') ||
    val.includes('referrer-policy(strict-origin)') ||
    val.includes('referrer-policy(origin-when-cross-origin)') ||
    val.includes('referrer-policy(no-referrer-when-downgrade)');
  const hasIntegrity =
    val.includes('integrity("sha384-') ||
    val.includes('integrity("sha512-') ||
    val.includes('integrity("sha256-') ||
    val.includes("integrity('sha384-") ||
    val.includes("integrity('sha512-") ||
    val.includes("integrity('sha256-") ||
    val.includes('integrity(${JSON.stringify');
  return hasQuotedUrl && hasCrossOrigin && hasReferrerPolicy && hasIntegrity;
}

test.describe('secure-external-subresources Target Grader', () => {
  test('External HTML subresources include cryptographic integrity, crossorigin, and referrerpolicy attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const externalElements = getExternalHtmlSubresources(docs);

    const allValid =
      externalElements.length > 0 &&
      externalElements.every((el) => {
        const integrity = el.getAttribute('integrity');
        const crossorigin = el.getAttribute('crossorigin');
        const referrerpolicy = el.getAttribute('referrerpolicy');
        return (
          hasValidIntegrityDigest(integrity) &&
          hasValidCrossOriginAttr(crossorigin) &&
          Boolean(referrerpolicy && referrerpolicy.trim().length > 0)
        );
      });

    expect(allValid).toBe(true);
  });

  test('Document configures a baseline referrer policy via <meta name="referrer">', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasMetaReferrer = docs.some(({ document }) => {
      const metas = Array.from(document.querySelectorAll('meta[name]')) as any[];
      return metas.some((meta) => {
        const name = (meta.getAttribute('name') || '').toLowerCase().trim();
        const content = (meta.getAttribute('content') || '').toLowerCase().trim();
        return (
          name === 'referrer' &&
          content.length > 0 &&
          content !== 'unsafe-url' &&
          content !== 'no-referrer-when-downgrade'
        );
      });
    });

    expect(hasMetaReferrer).toBe(true);
  });

  test('CSS subresources use quoted url() with unquoted cross-origin() and referrer-policy() modifiers and quoted integrity() digest', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const hasStaticCssModifierRule = rules.some((rule) => {
      if (rule instanceof CSSStyleRule || rule instanceof CSSFontFaceRule) {
        return isModifierEquippedCssUrl(rule.cssText);
      }
      return false;
    });

    const project: Project = getJsProject(targetFiles);
    const templateSpans = project
      .getSourceFiles()
      .flatMap((sf) => [
        ...sf.getDescendantsOfKind(SyntaxKind.TemplateExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
      ]);
    const hasJsCssModifierUrl = templateSpans.some((node) =>
      isModifierEquippedCssUrl(node.getText())
    );

    expect(hasStaticCssModifierRule || hasJsCssModifierUrl).toBe(true);
  });

  test('Stylesheets provide a safe fallback before modifier-equipped url() and never mix unverified url() in comma-separated @font-face src', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    let hasUnprotectedHeroUrl = false;
    let hasCommaSeparatedFontFallback = false;
    let hasValidCascadeOrJsFallback = false;

    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && rule.selectorText.includes('.hero')) {
        const bg = rule.style.getPropertyValue('background') || '';
        const bgImg = rule.style.getPropertyValue('background-image') || '';
        if (bg.includes('images.unsplash.com') && !bgImg.includes('integrity(')) {
          hasUnprotectedHeroUrl = true;
        }
      }
      if (rule instanceof CSSFontFaceRule) {
        const text = rule.cssText;
        const srcDecls = text.split('src:').slice(1);
        for (const decl of srcDecls) {
          const declBody = decl.split(';')[0] || '';
          if (declBody.includes('integrity(') && declBody.includes(',')) {
            hasCommaSeparatedFontFallback = true;
          }
        }
        if (isModifierEquippedCssUrl(text)) {
          hasValidCascadeOrJsFallback = true;
        }
      }
      if (rule instanceof CSSStyleRule && isModifierEquippedCssUrl(rule.cssText)) {
        hasValidCascadeOrJsFallback = true;
      }
    }

    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasCssSupportsCheck = callExpressions.some((call) =>
      call.getExpression().getText().includes('supports')
    );
    if (hasCssSupportsCheck) {
      const hasModifierInJs = project
        .getSourceFiles()
        .some((sf) => isModifierEquippedCssUrl(sf.getFullText()));
      if (hasModifierInJs) {
        hasValidCascadeOrJsFallback = true;
      }
    }

    expect(
      !hasUnprotectedHeroUrl &&
        !hasCommaSeparatedFontFallback &&
        hasValidCascadeOrJsFallback
    ).toBe(true);
  });

  test.describe('Browser tests', () => {
    test('Subresources whose content matches their declared Subresource Integrity digest load and apply in the page', async ({
      page,
      TARGET_URL,
    }) => {
      const targetOrigin = new URL(TARGET_URL).origin;
      const isExternal = (url: string) =>
        (url.startsWith('http://') || url.startsWith('https://')) &&
        new URL(url).origin !== targetOrigin;

      const isCheckedSubresourceType = (resourceType: string) =>
        resourceType === 'script' || resourceType === 'stylesheet';

      const sriErrors: string[] = [];
      const failedExternalRequests: string[] = [];
      page.on('console', (msg) => {
        if (
          msg.type() === 'error' &&
          /integrity|subresource/i.test(msg.text())
        ) {
          sriErrors.push(msg.text());
        }
      });
      page.on('requestfailed', (req) => {
        if (isExternal(req.url()) && isCheckedSubresourceType(req.resourceType())) {
          failedExternalRequests.push(
            `${req.url()} (${req.failure()?.errorText || 'failed'})`
          );
        }
      });
      page.on('response', (res) => {
        if (
          isExternal(res.url()) &&
          isCheckedSubresourceType(res.request().resourceType()) &&
          res.status() >= 400
        ) {
          failedExternalRequests.push(`${res.url()} (${res.status()})`);
        }
      });

      await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

      const result = await page.evaluate(() => {
        const origin = window.location.origin;
        const isExt = (u: string) =>
          (u.startsWith('http://') || u.startsWith('https://')) &&
          new URL(u).origin !== origin;

        const extStylesheets = Array.from(
          document.querySelectorAll('link[rel="stylesheet"][href]')
        )
          .filter((el) => isExt((el as HTMLLinkElement).href))
          .map((el) => ({
            href: (el as HTMLLinkElement).href,
            integrity: el.getAttribute('integrity'),
            hasSheet: Boolean((el as HTMLLinkElement).sheet),
          }));

        const extScripts = Array.from(document.querySelectorAll('script[src]'))
          .filter((el) => isExt((el as HTMLScriptElement).src))
          .map((el) => ({
            src: (el as HTMLScriptElement).src,
            integrity: el.getAttribute('integrity'),
          }));

        return { extStylesheets, extScripts };
      });

      expect(
        result.extStylesheets.length + result.extScripts.length
      ).toBeGreaterThan(0);
      expect(
        result.extStylesheets.every((s) => Boolean(s.integrity) && s.hasSheet)
      ).toBe(true);
      expect(result.extScripts.every((s) => Boolean(s.integrity))).toBe(true);
      expect(sriErrors).toEqual([]);
      expect(failedExternalRequests).toEqual([]);
    });

    test('When a subresource response does not match its declared Subresource Integrity digest, the browser blocks it from executing or applying', async ({
      page,
      TARGET_URL,
    }) => {
      const targetOrigin = new URL(TARGET_URL).origin;
      const interceptedExternal: string[] = [];

      await page.route('**/*', (route) => {
        const req = route.request();
        const url = req.url();
        if (
          (url.startsWith('http://') || url.startsWith('https://')) &&
          new URL(url).origin !== targetOrigin
        ) {
          const type = req.resourceType();
          interceptedExternal.push(`${type}:${url}`);
          if (type === 'stylesheet' || /\.css(?:$|\?)/i.test(url)) {
            return route.fulfill({
              status: 200,
              contentType: 'text/css',
              headers: { 'access-control-allow-origin': '*' },
              body: ':root { --__sri-tampered-css: 1; }',
            });
          }
          if (type === 'script' || /\.(?:m?js)(?:$|\?)/i.test(url)) {
            return route.fulfill({
              status: 200,
              contentType: 'application/javascript',
              headers: { 'access-control-allow-origin': '*' },
              body: 'window.__sriTamperedScript = true;',
            });
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/octet-stream',
            headers: { 'access-control-allow-origin': '*' },
            body: 'tampered-subresource-bytes',
          });
        }
        return route.continue();
      });

      await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

      const result = await page.evaluate(() => {
        const origin = window.location.origin;
        const isExt = (u: string) =>
          (u.startsWith('http://') || u.startsWith('https://')) &&
          new URL(u).origin !== origin;

        const extStylesheets = Array.from(
          document.querySelectorAll('link[rel="stylesheet"][href]')
        )
          .filter((el) => isExt((el as HTMLLinkElement).href))
          .map((el) => ({
            href: (el as HTMLLinkElement).href,
            hasSheet: Boolean((el as HTMLLinkElement).sheet),
          }));

        const extIntegrityEls = Array.from(
          document.querySelectorAll('script[src][integrity], link[href][integrity]')
        ).filter((el) => {
          const u =
            el.getAttribute('src') || el.getAttribute('href') || '';
          return (
            u.startsWith('http://') ||
            u.startsWith('https://') ||
            u.startsWith('//')
          );
        });

        const tamperedCssApplied =
          getComputedStyle(document.documentElement)
            .getPropertyValue('--__sri-tampered-css')
            .trim() !== '';

        const tamperedScriptExecuted =
          Boolean((window as any).__sriTamperedScript);

        return {
          extIntegrityCount: extIntegrityEls.length,
          extStylesheets,
          tamperedCssApplied,
          tamperedScriptExecuted,
        };
      });

      expect(result.extIntegrityCount).toBeGreaterThan(0);
      expect(interceptedExternal.length).toBeGreaterThan(0);
      expect(result.tamperedCssApplied).toBe(false);
      expect(result.tamperedScriptExecuted).toBe(false);
      expect(result.extStylesheets.every((s) => !s.hasSheet)).toBe(true);
    });
  });
});
