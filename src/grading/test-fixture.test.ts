import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  getCssStyleSheet,
  getHtmlDocuments,
  getJsProject,
  getRules,
  getTargetFiles,
  expectNever,
  checkPageLoad,
  checkTargetPageLoad,
  isReservedPlaceholderHost,
  startTargetServer,
  getSessionAndTreePids,
  isProcessRunning,
} from './test-fixture.ts';
import { runPlaywright } from './run-grader.ts';
import { chromium, type Browser } from 'playwright';
import {
  closestRule,
  resolveSelector,
  parseSelectorAST,
  getDeclaredProperties,
  getPropertyValues,
  CSSContainerRule,
  CSSPropertyRule,
  CSSStyleRule,
  CSSMediaRule,
  CSSPositionTryRule,
} from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Browser-backed tests need Playwright's Chromium. CI's `basics` job doesn't install browsers; the `browser` job runs this file.
const NO_CHROMIUM = fs.existsSync(chromium.executablePath()) ? false : 'Chromium is not installed (the CI browser job runs these)';

describe('test-fixture helpers', () => {

  test('getCssStyleSheet extracts and parses CSS from .css, .html <style>, and inline styles', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-css-test-'));
    try {
      const cssFile = path.join(tempDir, 'style.css');
      fs.writeFileSync(cssFile, '.card { display: flex; color: red; }', 'utf8');

      const htmlFile = path.join(tempDir, 'index.html');
      fs.writeFileSync(
        htmlFile,
        '<html><head><style>.header { font-weight: bold; }</style></head><body><div class="box" style="position-anchor: --my-anchor; opacity: 1;"></div></body></html>',
        'utf8'
      );

      const tsFile = path.join(tempDir, 'component.ts');
      fs.writeFileSync(tsFile, 'const template = `<style>.footer { margin-top: 10px; }</style>`;', 'utf8');

      const stylesheet = getCssStyleSheet([cssFile, htmlFile, tsFile]);
      assert.ok(stylesheet, 'Should return a CSSStyleSheet');

      const rules = Array.from(stylesheet.cssRules);

      // Check .css rule
      const cardRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.card');
      assert.ok(cardRule, 'Should find .card rule');
      assert.strictEqual(cardRule.style.getPropertyValue('display'), 'flex');
      assert.strictEqual(cardRule.style.getPropertyValue('color'), 'red');

      // Check HTML <style> rule
      const headerRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.header');
      assert.ok(headerRule, 'Should find .header rule from HTML <style>');
      assert.strictEqual(headerRule.style.getPropertyValue('font-weight'), 'bold');

      // Check HTML inline style rule
      const inlineRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '[style]');
      assert.ok(inlineRule, 'Should find inline style rule');
      assert.strictEqual(inlineRule.style.getPropertyValue('position-anchor'), '--my-anchor');
      assert.strictEqual(inlineRule.style.getPropertyValue('opacity'), '1');

      // Check TS embedded <style> rule
      const footerRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.footer');
      assert.ok(footerRule, 'Should find .footer rule from TS file');
      assert.strictEqual(footerRule.style.getPropertyValue('margin-top'), '10px');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getCssStyleSheet ignores Astro JSX style={...} expressions without corrupting top-level @property rules in subsequent .css files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-astro-css-test-'));
    try {
      const astroFile = path.join(tempDir, 'ProgressRing.astro');
      fs.writeFileSync(
        astroFile,
        `---
const { value = 75, resolvedSize = 150, thickness = "16px" } = Astro.props;
---
<div
  class:list={["progress-ring-wrapper", extraClass]}
  style={{ "--size": resolvedSize, "--thickness": thickness }}
>
  <progress
    class="progress-ring"
    value={value}
    max="100"
    style={\`width: \${resolvedSize}px; height: \${resolvedSize}px;\`}
  ></progress>
</div>
`,
        'utf8'
      );

      const globalCssFile = path.join(tempDir, 'global.css');
      fs.writeFileSync(
        globalCssFile,
        `@property --value {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}
progress.progress-ring {
  transition: --value 0.4s ease-in-out;
}`,
        'utf8'
      );

      const stylesheet = getCssStyleSheet([astroFile, globalCssFile]);
      const rules = Array.from(stylesheet.cssRules);

      const propRule = rules.find((r): r is CSSPropertyRule => r instanceof CSSPropertyRule && r.name === '--value');
      assert.ok(propRule, 'Should preserve top-level @property --value rule in global.css after Astro inline styles');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getCssStyleSheet ignores unparsed JSX inline style expressions and unwraps :global() in .astro files without corrupting subsequent rules', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-astro-style-test-'));
    try {
      const astroFile = path.join(tempDir, 'ArticleTeaser.astro');
      fs.writeFileSync(
        astroFile,
        [
          '---',
          'const explicitSurface = "featured";',
          '---',
          '<article style={explicitSurface ? `--surface: ${explicitSurface};` : undefined} class="teaser">',
          '  <span class="badge">Featured</span>',
          '</article>',
          '<style>',
          '  :global(:where([data-surface="featured"])) .badge { display: inline-flex; }',
          '</style>',
        ].join('\n'),
        'utf8'
      );

      const cssFile = path.join(tempDir, 'global.css');
      fs.writeFileSync(
        cssFile,
        [
          '.surface-featured { --surface: featured; }',
          '@container style(--surface: featured) { .badge { display: block; } }',
        ].join('\n'),
        'utf8'
      );

      const stylesheet = getCssStyleSheet([astroFile, cssFile]);
      const rules = Array.from(stylesheet.cssRules);

      const whereRule = rules.find(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.includes(':where(')
      );
      assert.ok(whereRule, 'Should unwrap :global() and parse :where() fallback rule in Astro <style>');

      const surfaceRule = rules.find(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.surface-featured'
      );
      assert.ok(surfaceRule, 'Should preserve top-level .surface-featured CSSStyleRule after Astro file');
      assert.strictEqual(surfaceRule.style.getPropertyValue('--surface').trim(), 'featured');

      const containerRule = rules.find((r): r is CSSContainerRule => r instanceof CSSContainerRule);
      assert.ok(containerRule, 'Should preserve top-level @container rule after Astro file');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getCssStyleSheet isolates unterminated comments, strings, and url() in one source from subsequent files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-css-isolation-test-'));
    try {
      const htmlFile = path.join(tempDir, 'index.html');
      fs.writeFileSync(
        htmlFile,
        [
          '<div style="color: red; background: url(">a</div>',
          '<p style="font-family: &quot;Unclosed">b</p>',
          '<style>.broken { color: red; /* unclosed comment</style>',
        ].join('\n'),
        'utf8'
      );

      const cssFile = path.join(tempDir, 'global.css');
      fs.writeFileSync(cssFile, '.after { color: blue; }', 'utf8');

      const stylesheet = getCssStyleSheet([htmlFile, cssFile]);
      const rules = Array.from(stylesheet.cssRules);

      const afterRule = rules.find(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.after'
      );
      assert.ok(afterRule, 'Should preserve .after rule from global.css despite broken earlier sources');
      assert.strictEqual(afterRule.style.getPropertyValue('color').trim(), 'blue');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getCssStyleSheet extracts <style> inside <script> tags and excludes <style>/[style] inside <template> elements in .html', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-html-template-test-'));
    try {
      const htmlFile = path.join(tempDir, 'index.html');
      fs.writeFileSync(
        htmlFile,
        `<html>
          <head>
            <style>.global-style { color: red; }</style>
          </head>
          <body>
            <template id="card-template">
              <style>.template-style { color: blue; }</style>
              <div style="font-size: 14px;"></div>
              <template id="nested-template">
                <style>.nested-template-style { color: yellow; }</style>
              </template>
            </template>
            <div style="margin: 20px;"></div>
            <script>
              class MyCard extends HTMLElement {
                connectedCallback() {
                  this.shadowRoot.innerHTML = \`<style>.shadow-style { display: block; }</style>\`;
                  const tmpl = \`<template><style>.script-template-style { color: green; }</style></template>\`;
                }
              }
            </script>
          </body>
        </html>`,
        'utf8'
      );

      const stylesheet = getCssStyleSheet([htmlFile]);
      const rules = Array.from(stylesheet.cssRules);

      // Top-level <style> should be found
      const globalRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.global-style');
      assert.ok(globalRule, 'Should find top-level .global-style rule');

      // Top-level inline [style] should be found
      const inlineRules = rules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '[style]');
      assert.strictEqual(inlineRules.length, 1, 'Should find exactly 1 top-level inline [style] rule');
      assert.strictEqual(inlineRules[0].style.getPropertyValue('margin'), '20px');

      // <style> inside <script> should be extracted (e.g. shadowRoot.innerHTML)
      const shadowRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.shadow-style');
      assert.ok(shadowRule, 'Should extract .shadow-style rule from <script> template literal');

      // <style> inside <template> inside <script> template literal should also be preserved
      const scriptTemplateRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.script-template-style');
      assert.ok(scriptTemplateRule, 'Should extract .script-template-style rule from <template> inside <script>');

      // <style> and [style] inside <template> (including nested <template>) MUST NOT be extracted as global page styles
      const templateRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.template-style');
      assert.ok(!templateRule, 'Must NOT extract .template-style from inside <template>');

      const nestedTemplateRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.nested-template-style');
      assert.ok(!nestedTemplateRule, 'Must NOT extract .nested-template-style from inside nested <template>');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getCssStyleSheet handles empty file lists gracefully', () => {
    const stylesheet = getCssStyleSheet([]);
    assert.ok(stylesheet);
    assert.strictEqual(stylesheet.cssRules.length, 0);
  });

  test('getHtmlDocuments parses HTML files into Linkedom documents', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-html-test-'));
    try {
      const htmlFile = path.join(tempDir, 'index.html');
      fs.writeFileSync(htmlFile, '<div id="main" class="container"><p>Hello</p></div>', 'utf8');

      const docs = getHtmlDocuments([htmlFile]);
      assert.strictEqual(docs.length, 1);
      assert.strictEqual(docs[0].file, htmlFile);

      const pEl = docs[0].document.querySelector('.container p');
      assert.ok(pEl);
      assert.strictEqual(pEl.textContent, 'Hello');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getHtmlDocuments normalizes Astro class:list, dynamic class expressions, and frontmatter', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-astro-html-test-'));
    try {
      const astroFile = path.join(tempDir, 'ProgressRing.astro');
      fs.writeFileSync(
        astroFile,
        `---
const { value = 75, contentClass = '' } = Astro.props;
const isComplete = value < 100;
---
<div class:list={['progress-ring-wrapper', { 'is-complete': isComplete }]}>
  <progress class={\`progress-ring \${contentClass}\`} value={value} max="100" aria-label="Progress"></progress>
  <div class="base-content" class:list={['progress-ring-content', contentClass]}>
    <span>{value}%</span>
  </div>
</div>
`,
        'utf8'
      );

      const docs = getHtmlDocuments([astroFile]);
      assert.strictEqual(docs.length, 1);
      const doc = docs[0].document;

      assert.ok(doc.querySelector('.progress-ring-wrapper'), 'Should find wrapper via class:list');
      assert.ok(doc.querySelector('.is-complete'), 'Should find nested object key in class:list');
      assert.ok(doc.querySelector('progress.progress-ring'), 'Should find progress via template literal class');
      const contentEl = doc.querySelector('.progress-ring-content');
      assert.ok(contentEl, 'Should find content element via class:list');
      assert.ok(contentEl.classList.contains('base-content'), 'Should retain static class when merged with class:list');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getHtmlDocuments exposes <?...> processing instructions as comment nodes like browsers do', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-html-pi-test-'));
    try {
      const htmlFile = path.join(tempDir, 'index.html');
      fs.writeFileSync(
        htmlFile,
        `<!DOCTYPE html>
<html><head><title>a <?start> title</title></head><body>
<section id="favorites"><?start name="favorites"><p class="fallback">Loading…</p><?end></section>
<?marker name="m">
<!-- existing <?start name="ignored"> comment -->
<template for="favorites"><ul><li>Latte</li></ul></template>
<script>const s = '<?start name="x">';</script>
<style>.a::after { content: "<?end>"; }</style>
<textarea><?marker name="t"></textarea>
</body></html>`,
        'utf8'
      );

      const docs = getHtmlDocuments([htmlFile]);
      assert.strictEqual(docs.length, 1);
      const doc = docs[0].document;

      const comments: string[] = [];
      const walker = doc.createTreeWalker(doc, 128 /* NodeFilter.SHOW_COMMENT */);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) comments.push(n.data);
      assert.deepStrictEqual(comments, [
        '?start name="favorites"',
        '?end',
        '?marker name="m"',
        ' existing <?start name="ignored"> comment ',
      ]);

      const section = doc.querySelector('#favorites');
      const kids = Array.from(section.childNodes as ArrayLike<any>);
      assert.deepStrictEqual(
        kids.map((n) => [n.nodeType, n.nodeType === 8 ? n.data : n.className]),
        [[8, '?start name="favorites"'], [1, 'fallback'], [8, '?end']],
        'Fallback content should remain between the start and end markers'
      );

      const template = doc.querySelector('template[for="favorites"]');
      assert.ok(template, 'Should parse <template for>');
      assert.ok(template.content.querySelector('li'), 'Template content should parse');

      assert.strictEqual(doc.querySelector('script').textContent, `const s = '<?start name="x">';`);
      assert.strictEqual(doc.querySelector('style').textContent, '.a::after { content: "<?end>"; }');
      assert.strictEqual(doc.querySelector('textarea').textContent, '<?marker name="t">');
      assert.strictEqual(doc.querySelector('title').textContent, 'a <?start> title');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getJsProject populates ts-morph Project from .ts, .mjs, and <script> tags', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-js-test-'));
    try {
      const tsFile = path.join(tempDir, 'logic.ts');
      fs.writeFileSync(tsFile, 'export function calculateTotal(a: number, b: number): number { return a + b; }', 'utf8');

      const mjsFile = path.join(tempDir, 'server.mjs');
      fs.writeFileSync(mjsFile, 'export function setSecurityHeaders(res) { res.setHeader("Permissions-Policy", "camera=()"); }', 'utf8');

      const testMjsFile = path.join(tempDir, 'hydration.test.mjs');
      fs.writeFileSync(testMjsFile, 'function testHarnessOnly() { return false; }', 'utf8');

      const htmlFile = path.join(tempDir, 'index.html');
      fs.writeFileSync(htmlFile, '<script>function inlineHelper() { return 42; }</script>', 'utf8');

      const project = getJsProject([tsFile, mjsFile, testMjsFile, htmlFile]);
      const sourceFiles = project.getSourceFiles();
      assert.strictEqual(sourceFiles.length, 3);

      const functionDecls = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration));
      const funcNames = functionDecls.map(fn => fn.getName());
      assert.ok(funcNames.includes('calculateTotal'));
      assert.ok(funcNames.includes('setSecurityHeaders'));
      assert.ok(funcNames.includes('inlineHelper'));
      assert.ok(!funcNames.includes('testHarnessOnly'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
  test('operates on stylesheets with nesting, cssomnom helpers, and @position-try', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-helpers-test-'));
    try {
      const cssFile = path.join(tempDir, 'sample.css');
      fs.writeFileSync(
        cssFile,
        `
        @media (min-width: 768px) {
          .card {
            grid-template-rows: auto;
            grid-template-rows: subgrid;
            width: 250px;
            & > .title {
              color: blue;
            }
          }
        }
        @position-try --below {
          inset-area: block-end;
        }
        `,
        'utf8'
      );

      const stylesheet = getCssStyleSheet([cssFile]);
      const allRules = getRules(stylesheet);
      assert.ok(allRules.length >= 3);

      const styleRules = getRules(stylesheet, CSSStyleRule);
      assert.strictEqual(styleRules.length, 2);

      const cardRule = styleRules.find(r => r.selectorText === '.card');
      assert.ok(cardRule);

      // closestRule
      const enclosingMedia = closestRule(cardRule, CSSMediaRule);
      assert.ok(enclosingMedia);
      assert.strictEqual(enclosingMedia.conditionText, '(min-width: 768px)');

      // resolveSelector & parseSelectorAST
      const titleRule = styleRules.find(r => r.selectorText === '& > .title');
      assert.ok(titleRule);
      assert.strictEqual(resolveSelector(titleRule), ':is(.card) > .title');
      const ast = parseSelectorAST(titleRule);
      assert.strictEqual(ast?.type, 'selector-list');

      // getPropertyValues with multiple declarations and logical/physical mapping
      const rowValues = getPropertyValues(cardRule, 'grid-template-rows');
      assert.deepStrictEqual(rowValues, ['auto', 'subgrid']);
      const inlineSizeValues = getPropertyValues(cardRule, 'inline-size');
      assert.deepStrictEqual(inlineSizeValues, ['250px']);

      // getDeclaredProperties
      const declProps = getDeclaredProperties(stylesheet);
      assert.ok(declProps.has('grid-template-rows'));
      assert.ok(declProps.has('width'));
      assert.ok(declProps.has('color'));

      // CSSPositionTryRule
      const tryRules = getRules(stylesheet, CSSPositionTryRule);
      assert.strictEqual(tryRules.length, 1);
      assert.strictEqual(tryRules[0].name, '--below');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getRules accepts string[] file paths directly and getCssStyleSheet is memoized', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-getrules-memoize-test-'));
    try {
      const cssFile = path.join(tempDir, 'sample.css');
      fs.writeFileSync(
        cssFile,
        `
        .header { color: red; font-size: 16px; }
        .footer { color: blue; }
        `,
        'utf8'
      );

      const files = [cssFile];

      // 1. getCssStyleSheet is memoized for same array reference
      const sheet1 = getCssStyleSheet(files);
      const sheet2 = getCssStyleSheet(files);
      assert.strictEqual(sheet1, sheet2, 'Should return identical memoized CSSStyleSheet instance for same files array');

      // 2. getCssStyleSheet is memoized for distinct array with same unmodified files
      const sheet3 = getCssStyleSheet([cssFile]);
      assert.strictEqual(sheet1, sheet3, 'Should return identical memoized CSSStyleSheet instance for identical file stats');

      // 3. getRules works directly with string[] file paths
      const styleRules = getRules(files, CSSStyleRule);
      assert.strictEqual(styleRules.length, 2);
      assert.strictEqual(styleRules[0].selectorText, '.header');
      assert.strictEqual(styleRules[1].selectorText, '.footer');

      // 4. getRules without rule constructor flattens all rules from string[]
      const allRules = getRules(files);
      assert.strictEqual(allRules.length, 2);
      assert.strictEqual(allRules[0], styleRules[0]);

      // 5. getRules returns empty array directly for empty input
      assert.deepStrictEqual(getRules([]), []);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getTargetFiles falls back to base-app default files when PATCH_FILE is unset (starting-app calibration)', () => {
    const prev = process.env.PATCH_FILE;
    delete process.env.PATCH_FILE;
    try {
      const files = getTargetFiles('file:///repo/guides/forms/switch/targets/daily-grind/grader.ts');
      assert.deepStrictEqual(files, [path.resolve(process.cwd(), 'index.html')]);
    } finally {
      if (prev === undefined) delete process.env.PATCH_FILE;
      else process.env.PATCH_FILE = prev;
    }
  });

  describe('expectNever', { skip: NO_CHROMIUM }, () => {
    test('fails a 400ms window when page state turns bad at 300ms, and passes when state never turns bad', async () => {
      const browser: Browser = await chromium.launch();
      try {
        const page = await browser.newPage();

        // 1. State turns bad at 300ms (and even reverts at 360ms to prove active observation) -> fails 400ms window
        await page.setContent(`<!doctype html><script>
          window.__bad = false;
          setTimeout(() => { window.__bad = true; }, 300);
          setTimeout(() => { window.__bad = false; }, 360);
        </script>`);

        await assert.rejects(
          () => expectNever(page, () => (window as unknown as { __bad: boolean }).__bad, { forMs: 400 }),
          /expectNever failed: predicate became truthy after \d+ms \(observation window: 400ms\)/,
        );

        // 2. State never turns bad -> passes 400ms window
        await page.setContent(`<!doctype html><script>
          window.__bad = false;
        </script>`);

        await expectNever(page, () => (window as unknown as { __bad: boolean }).__bad, { forMs: 400 });
      } finally {
        await browser.close();
      }
    });
  });

  describe('checkPageLoad', () => {
    test('detects a page that throws (pageerror), a broken script load, and passes a clean page (ignoring console.error)', { skip: NO_CHROMIUM }, async () => {
      const server = http.createServer((req, res) => {
        if (req.url === '/throws.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<!doctype html><html><body><script>throw new TypeError("uncaught boom on load");</script></body></html>');
          return;
        }
        if (req.url === '/broken-script.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<!doctype html><html><body><script src="/missing-bundle.js"></script></body></html>');
          return;
        }
        if (req.url === '/clean.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end([
            '<!doctype html><html><body>',
            '<img src="/missing-image.png">',
            '<script src="/ok.js"></script>',
            '<script>console.error("noisy console error"); console.warn("noisy warning");</script>',
            '</body></html>',
          ].join(''));
          return;
        }
        if (req.url === '/ok.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end('window.__loadedOk = true;');
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as net.AddressInfo).port;
      const baseUrl = `http://127.0.0.1:${port}`;
      let browser: Browser | undefined;

      try {
        browser = await chromium.launch();
        // 1. Fixture page that throws an uncaught exception
        const throwsResult = await checkPageLoad(browser, `${baseUrl}/throws.html`);
        assert.strictEqual(throwsResult.ok, false);
        assert.strictEqual(throwsResult.errors.length, 1);
        assert.match(throwsResult.errors[0], /\[pageerror\].*uncaught boom on load/);

        // 2. Fixture page with a broken script (404)
        const brokenScriptResult = await checkPageLoad(browser, `${baseUrl}/broken-script.html`);
        assert.strictEqual(brokenScriptResult.ok, false);
        assert.strictEqual(brokenScriptResult.errors.length, 1);
        assert.match(brokenScriptResult.errors[0], /\[response 404\] GET http:\/\/127\.0\.0\.1:\d+\/missing-bundle\.js/);

        // 3. Clean fixture page (with console.error, console.warn, and a 404 image that is not a script)
        const cleanResult = await checkPageLoad(browser, `${baseUrl}/clean.html`);
        assert.deepStrictEqual(cleanResult, { ok: true, errors: [] });

        // 4. Browser/context failure inside checkPageLoad never throws; records [browser] error
        const brokenBrowser = {
          newContext: async () => {
            throw new Error('simulated browser context crash');
          },
        } as unknown as Browser;
        const browserFailResult = await checkPageLoad(brokenBrowser, `${baseUrl}/clean.html`);
        assert.strictEqual(browserFailResult.ok, false);
        assert.strictEqual(browserFailResult.errors.length, 1);
        assert.match(browserFailResult.errors[0], /^\[browser\] simulated browser context crash/);
      } finally {
        await browser?.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    test('isReservedPlaceholderHost matches RFC 2606/6761 reserved domains and rejects real hosts', () => {
      assert.strictEqual(isReservedPlaceholderHost('example.com'), true);
      assert.strictEqual(isReservedPlaceholderHost('cdn.example.com'), true);
      assert.strictEqual(isReservedPlaceholderHost('sub.example.net'), true);
      assert.strictEqual(isReservedPlaceholderHost('assets.example.org'), true);
      assert.strictEqual(isReservedPlaceholderHost('app.test'), true);
      assert.strictEqual(isReservedPlaceholderHost('foo.example'), true);
      assert.strictEqual(isReservedPlaceholderHost('bar.invalid'), true);
      assert.strictEqual(isReservedPlaceholderHost('localhost'), false);
      assert.strictEqual(isReservedPlaceholderHost('notexample.com'), false);
      assert.strictEqual(isReservedPlaceholderHost('cdn.jsdelivr.net'), false);
    });

    test('checkTargetPageLoad records buildWarning when build fails but start succeeds and page loads cleanly', { skip: NO_CHROMIUM }, async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-buildwarning-'));
      try {
        const buildAttemptsLog = path.join(tempDir, 'build-attempts.log');
        const buildAttempts = () => (fs.existsSync(buildAttemptsLog) ? fs.readFileSync(buildAttemptsLog, 'utf8').length : 0);
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'fixture-buildwarning-app',
            type: 'module',
            scripts: {
              build: 'node build.mjs',
              start: 'node server.mjs',
            },
          }),
          'utf8',
        );
        fs.writeFileSync(
          path.join(tempDir, 'build.mjs'),
          [
            `import fs from 'node:fs';`,
            `fs.appendFileSync(${JSON.stringify(buildAttemptsLog)}, 'x');`,
            `console.error('em++ not found');`,
            `process.exit(1);`,
          ].join('\n'),
          'utf8',
        );
        fs.writeFileSync(
          path.join(tempDir, 'server.mjs'),
          [
            `import http from 'node:http';`,
            `const port = Number(process.env.PORT || 3000);`,
            `http.createServer((_req, res) => {`,
            `  res.writeHead(200, { 'Content-Type': 'text/html' });`,
            `  res.end('<!doctype html><html><body><p>Prebuilt works</p></body></html>');`,
            `}).listen(port);`,
          ].join('\n'),
          'utf8',
        );

        const res = await checkTargetPageLoad(tempDir);
        assert.ok(res);
        assert.strictEqual(res.ok, true, 'Page load should remain ok when start succeeds and page loads');
        assert.deepStrictEqual(res.errors, []);
        assert.match(res.buildWarning || '', /em\+\+ not found/);
        assert.strictEqual(buildAttempts(), 1);

        // A caller that already saw the build fail passes the warning along, so the check skips install and build.
        const reused = await checkTargetPageLoad(tempDir, undefined, { buildWarning: res.buildWarning });
        assert.strictEqual(buildAttempts(), 1, 'Passing buildWarning must not build again');
        assert.strictEqual(reused?.ok, true);
        assert.strictEqual(reused?.buildWarning, res.buildWarning);

        // Regression test: a browser grader (using TARGET_URL) on the same failed-build target
        // must still fail its test (nothing started by the diagnostic page-load check is exposed to TARGET_URL).
        const fixtureImportPath = path.join(__dirname, 'test-fixture.ts');
        const browserGraderFile = path.join(tempDir, 'grader.ts');
        fs.writeFileSync(
          browserGraderFile,
          [
            `import { test, expect } from ${JSON.stringify(fixtureImportPath)};`,
            `test('browser check must fail when build fails', async ({ page, TARGET_URL }) => {`,
            `  await page.goto(TARGET_URL);`,
            `  await expect(page.locator('p')).toHaveText('Prebuilt works');`,
            `});`,
          ].join('\n'),
          'utf8',
        );

        const graderRun = await runPlaywright(tempDir, browserGraderFile, 'ignore');
        assert.strictEqual(graderRun.stats.expected, 0, 'Browser test must not pass when scripts.build fails');
        assert.strictEqual(graderRun.stats.unexpected, 1, 'Browser test must fail on failed build as before');
        assert.strictEqual(buildAttempts(), 2, 'runPlaywright builds once (the prebuild) and reuses that failure for the page-load check');
        assert.ok(graderRun.pageLoad, 'pageLoad must still be recorded');
        assert.strictEqual(graderRun.pageLoad.ok, true, 'Diagnostic page-load check records ok: true');
        assert.deepStrictEqual(graderRun.pageLoad.errors, []);
        assert.match(graderRun.pageLoad.buildWarning || '', /em\+\+ not found/);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('runPlaywright writes noPage sentinel when target has no start script and omits pageLoad', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-nopage-grader-'));
      try {
        const fixtureImportPath = path.join(__dirname, 'test-fixture.ts');
        const graderFile = path.join(tempDir, 'grader.ts');
        fs.writeFileSync(
          graderFile,
          [
            `import { test, expect } from ${JSON.stringify(fixtureImportPath)};`,
            `test('static check on no-page target', () => {`,
            `  expect(1 + 1).toBe(2);`,
            `});`,
          ].join('\n'),
          'utf8',
        );
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'no-start-script', type: 'module', scripts: {} }),
          'utf8',
        );

        const res = await runPlaywright(tempDir, graderFile, 'ignore');
        assert.strictEqual(res.stats.expected, 1);
        assert.strictEqual(res.pageLoad, undefined);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('runPlaywright does not start target server during static-only grader run and writes pageLoad afterwards', { skip: NO_CHROMIUM }, async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-pageload-grader-'));
      const prevPageLoadOut = process.env.PAGE_LOAD_OUTPUT;
      try {
        const fixtureImportPath = path.join(__dirname, 'test-fixture.ts');
        const graderFile = path.join(tempDir, 'grader.ts');
        fs.writeFileSync(
          graderFile,
          [
            `import { test, expect, getHtmlDocuments } from ${JSON.stringify(fixtureImportPath)};`,
            `import * as fs from 'node:fs';`,
            `import * as path from 'node:path';`,
            `test('static HTML check runs without starting _targetServer and passes even when runtime throws', () => {`,
            `  expect(fs.existsSync(path.join(process.cwd(), 'server-started.marker'))).toBe(false);`,
            `  expect(process.env.TARGET_URL).toBeUndefined();`,
            `  const docs = getHtmlDocuments([path.join(process.cwd(), 'index.html')]);`,
            `  expect(docs[0].document.querySelector('#app')).not.toBeNull();`,
            `});`,
          ].join('\n'),
          'utf8',
        );

        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'fixture-pageload-app',
            type: 'module',
            scripts: { start: 'node server.mjs' },
          }),
          'utf8',
        );

        fs.writeFileSync(
          path.join(tempDir, 'server.mjs'),
          [
            `import http from 'node:http';`,
            `import fs from 'node:fs';`,
            `fs.writeFileSync('server-started.marker', 'started', 'utf8');`,
            `const port = Number(process.env.PORT || 3000);`,
            `http.createServer((req, res) => {`,
            `  if (req.url === '/' || req.url === '/index.html') {`,
            `    res.writeHead(200, { 'Content-Type': 'text/html' });`,
            `    res.end(fs.readFileSync('index.html', 'utf8'));`,
            `    return;`,
            `  }`,
            `  res.writeHead(404); res.end();`,
            `}).listen(port);`,
          ].join('\n'),
          'utf8',
        );

        const pageLoadOutFile = path.join(tempDir, 'page-load-out.json');
        process.env.PAGE_LOAD_OUTPUT = pageLoadOutFile;

        // Case 1: Page throws at runtime, static check runs without server and passes (record-only)
        fs.writeFileSync(
          path.join(tempDir, 'index.html'),
          '<!doctype html><div id="app">Hello</div><script>throw new Error("runtime crash");</script>',
          'utf8',
        );

        const brokenRun = await runPlaywright(tempDir, graderFile, 'ignore');
        assert.strictEqual(brokenRun.stats.expected, 1, 'Static check must pass without starting _targetServer during Playwright run');
        assert.strictEqual(brokenRun.stats.unexpected, 0);
        assert.ok(brokenRun.pageLoad, 'pageLoad must be attached to Playwright JSON results');
        assert.strictEqual(brokenRun.pageLoad.ok, false);
        assert.match(brokenRun.pageLoad.errors[0], /\[pageerror\].*runtime crash/);
        assert.strictEqual(fs.existsSync(pageLoadOutFile), true, 'PAGE_LOAD_OUTPUT must be written after Playwright run');
        const writtenBroken = JSON.parse(fs.readFileSync(pageLoadOutFile, 'utf8'));
        assert.strictEqual(writtenBroken.ok, false);

        // Case 2: Clean page (remove marker before second run so static test proves server still doesn't start during Playwright)
        fs.rmSync(path.join(tempDir, 'server-started.marker'), { force: true });
        fs.writeFileSync(
          path.join(tempDir, 'index.html'),
          '<!doctype html><div id="app">Hello</div><script>window.__ok = true;</script>',
          'utf8',
        );

        const cleanRun = await runPlaywright(tempDir, graderFile, 'ignore');
        assert.strictEqual(cleanRun.stats.expected, 1);
        assert.strictEqual(cleanRun.stats.unexpected, 0);
        assert.deepStrictEqual(cleanRun.pageLoad, { ok: true, errors: [] });
        const writtenClean = JSON.parse(fs.readFileSync(pageLoadOutFile, 'utf8'));
        assert.deepStrictEqual(writtenClean, { ok: true, errors: [] });
      } finally {
        if (prevPageLoadOut === undefined) delete process.env.PAGE_LOAD_OUTPUT;
        else process.env.PAGE_LOAD_OUTPUT = prevPageLoadOut;
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('no target server or detached child process outlives stop() or runPlaywright grading', { skip: NO_CHROMIUM }, async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-server-leak-'));
      try {
        const childPidFile = path.join(tempDir, 'child-server.pid');
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'leak-check-app',
            type: 'module',
            scripts: {
              start: 'node start-wrapper.mjs',
            },
          }),
          'utf8',
        );
        // Simulate pnpm run start spawning a child node server in its own process group (detached: true)
        fs.writeFileSync(
          path.join(tempDir, 'start-wrapper.mjs'),
          [
            `import { spawn } from 'node:child_process';`,
            `import fs from 'node:fs';`,
            `const child = spawn(process.execPath, ['child-entry.mjs'], { detached: true, stdio: 'ignore', env: process.env });`,
            `fs.writeFileSync(${JSON.stringify(childPidFile)}, String(child.pid), 'utf8');`,
            `setInterval(() => {}, 1000);`,
          ].join('\n'),
          'utf8',
        );
        fs.writeFileSync(
          path.join(tempDir, 'child-entry.mjs'),
          [
            `import http from 'node:http';`,
            `const port = Number(process.env.PORT || 3000);`,
            `http.createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><p>ok</p>'); }).listen(port);`,
          ].join('\n'),
          'utf8',
        );

        const srv = await startTargetServer(tempDir, { exportTargetUrlEnv: false });
        assert.ok(srv.url, `Expected server to start, got: ${srv.error}`);
        const childPid = Number(fs.readFileSync(childPidFile, 'utf8').trim());
        assert.ok(Number.isInteger(childPid) && childPid > 1, 'Expected child server PID to be recorded');

        // Verify child process is alive while server is running
        assert.doesNotThrow(() => process.kill(childPid, 0), 'Child server should be alive before stop()');

        await srv.stop();

        assert.strictEqual(
          isProcessRunning(childPid),
          false,
          'Child server in separate PGID must not outlive srv.stop()',
        );
        assert.deepStrictEqual(getSessionAndTreePids(childPid), []);

        // Also run a full browser grader via runPlaywright and verify no server outlives runPlaywright
        fs.unlinkSync(childPidFile);
        const graderFile = path.join(tempDir, 'grader.ts');
        const fixtureImportPath = path.join(__dirname, 'test-fixture.ts');
        fs.writeFileSync(
          graderFile,
          [
            `import { test, expect } from ${JSON.stringify(fixtureImportPath)};`,
            `test('loads page from server', async ({ page, TARGET_URL }) => {`,
            `  await page.goto(TARGET_URL);`,
            `  await expect(page.locator('p')).toHaveText('ok');`,
            `});`,
          ].join('\n'),
          'utf8',
        );

        const report = await runPlaywright(tempDir, graderFile, 'ignore');
        assert.strictEqual(report.stats.expected, 1);
        const gradedChildPid = Number(fs.readFileSync(childPidFile, 'utf8').trim());
        assert.strictEqual(
          isProcessRunning(gradedChildPid),
          false,
          'No target server process may outlive runPlaywright grading',
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
