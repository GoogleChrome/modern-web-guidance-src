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
  getTargetFiles,
  expectNever,
  checkPageLoad,
  checkTargetPageLoad,
  isReservedPlaceholderHost,
  startTargetServer,
  getBaseAppAllowedBuilds,
  writeScopedPnpmWorkspace,
  getSessionAndTreePids,
} from './test-fixture.ts';
import { runPlaywright } from './run-grader.ts';
import { chromium, type Browser } from 'playwright';
import { CSSContainerRule, CSSPropertyRule, CSSStyleRule } from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      const astroFile = path.join(tempDir, 'Card.astro');
      fs.writeFileSync(
        astroFile,
        `---
const { highlight = false } = Astro.props;
---
<div class="card" style={highlight ? "border: 2px solid red;" : undefined}>
  <slot />
</div>
<style>
  :global(.card-container) .card {
    padding: 16px;
  }
  @container (inline-size > 400px) {
    .card {
      padding: 24px;
    }
  }
</style>
`,
        'utf8'
      );

      const stylesheet = getCssStyleSheet([astroFile]);
      const rules = Array.from(stylesheet.cssRules);

      const globalUnwrapped = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.card-container .card');
      assert.ok(globalUnwrapped, 'Should unwrap :global(.card-container) .card selector');
      assert.strictEqual(globalUnwrapped.style.getPropertyValue('padding'), '16px');

      const containerRule = rules.find((r): r is CSSContainerRule => r instanceof CSSContainerRule);
      assert.ok(containerRule, 'Should preserve @container rule');
      assert.strictEqual(containerRule.conditionText, '(inline-size > 400px)');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getHtmlDocuments parses standard HTML files correctly', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-html-test-'));
    try {
      const htmlFile = path.join(tempDir, 'index.html');
      fs.writeFileSync(
        htmlFile,
        '<!DOCTYPE html><html><head><title>Test</title></head><body><div id="root" class="main-container"><p>Hello World</p></div></body></html>',
        'utf8'
      );

      const docs = getHtmlDocuments([htmlFile]);
      assert.strictEqual(docs.length, 1);
      assert.strictEqual(docs[0].file, htmlFile);

      const doc = docs[0].document;
      assert.ok(doc, 'Should return a document object');
      assert.strictEqual(doc.title, 'Test');
      assert.ok(doc.querySelector('#root'), 'Should find #root');
      assert.strictEqual(doc.querySelector('p').textContent, 'Hello World');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getHtmlDocuments strips Astro frontmatter and parses class:list directives', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-astro-html-test-'));
    try {
      const astroFile = path.join(tempDir, 'Component.astro');
      fs.writeFileSync(
        astroFile,
        `---
const { value = 50, contentClass = "default-content" } = Astro.props;
const isComplete = value >= 100;
---
<div class="wrapper">
  <div class:list={['progress-ring-wrapper', { 'is-complete': isComplete }]}>
    <progress class={\`progress-ring \${isComplete ? 'complete' : ''}\`} value={value}></progress>
  </div>
  <div class:list={['base-content', 'progress-ring-content', contentClass]}>
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

  describe('expectNever', () => {
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
    test('detects a page that throws (pageerror), a broken script load, and passes a clean page (ignoring console.error)', async () => {
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
      const browser: Browser = await chromium.launch();

      try {
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
        await browser.close();
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

    test('checkTargetPageLoad records buildWarning when build fails but start succeeds and page loads cleanly', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-buildwarning-'));
      try {
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'fixture-buildwarning-app',
            type: 'module',
            scripts: {
              build: 'node -e "console.error(\'em++ not found\'); process.exit(1)"',
              start: 'node server.mjs',
            },
          }),
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

    test('runPlaywright does not start target server during static-only grader run and writes pageLoad afterwards', async () => {
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

    test('getBaseAppAllowedBuilds reads canonical base app allowlist and startTargetServer blocks agent-added dependency install scripts', async () => {
      assert.deepStrictEqual(getBaseAppAllowedBuilds('devtools-times'), ['esbuild', 'sharp']);
      assert.deepStrictEqual(getBaseAppAllowedBuilds('daily-grind'), []);
      assert.deepStrictEqual(getBaseAppAllowedBuilds('non-existent-app'), []);

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-pnpm-builds-'));
      const evilPkgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-evil-pkg-'));
      const evilMarker = path.join(tempDir, 'evil-postinstall-ran.marker');
      try {
        // Create an agent-added package with a postinstall script
        fs.writeFileSync(
          path.join(evilPkgDir, 'package.json'),
          JSON.stringify({
            name: 'evil-agent-pkg',
            version: '1.0.0',
            scripts: {
              postinstall: `node -e "require('fs').writeFileSync(${JSON.stringify(evilMarker)}, 'ran')"`,
            },
          }),
          'utf8',
        );
        const { spawnSync } = await import('node:child_process');
        spawnSync('npm', ['pack', '--quiet'], { cwd: evilPkgDir });
        const tarballPath = path.join(evilPkgDir, 'evil-agent-pkg-1.0.0.tgz');

        // Even if the agent tampered with targetDir/package.json to add evil-agent-pkg to pnpm.onlyBuiltDependencies,
        // startTargetServer must read only from the canonical base app (daily-grind -> []) and block evil-agent-pkg's postinstall.
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'daily-grind',
            type: 'module',
            scripts: {
              start: [
                'node -e "import(\'node:http\').then(({createServer})=>createServer((_,res)=>{res.writeHead(200);res.end(\'ok\')}).listen(Number(process.env.PORT||3000)))"',
              ].join(''),
            },
            dependencies: {
              'evil-agent-pkg': `file:${tarballPath}`,
            },
            pnpm: {
              onlyBuiltDependencies: ['evil-agent-pkg'],
            },
          }),
          'utf8',
        );

        const yamlPath = writeScopedPnpmWorkspace(tempDir, getBaseAppAllowedBuilds('daily-grind'));
        const yamlText = fs.readFileSync(yamlPath, 'utf8');
        assert.match(yamlText, /strictDepBuilds: false/);
        assert.match(yamlText, /onlyBuiltDependencies: \[\]/);
        assert.match(yamlText, /allowBuilds: \{\}/);

        const srv = await startTargetServer(tempDir, { exportTargetUrlEnv: false });
        try {
          assert.ok(srv.url, `Expected server to start after pnpm install, got error: ${srv.error}`);
          assert.strictEqual(
            fs.existsSync(evilMarker),
            false,
            'Agent-added dependency postinstall script must NEVER execute on the host',
          );
          assert.strictEqual(
            fs.existsSync(path.join(tempDir, 'node_modules', 'evil-agent-pkg', 'package.json')),
            true,
            'Dependency should still be installed into node_modules when target has dependencies',
          );
        } finally {
          srv.stop();
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.rmSync(evilPkgDir, { recursive: true, force: true });
      }
    });

    test('no target server or detached child process outlives stop() or runPlaywright grading', async () => {
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

        srv.stop();

        let childAliveAfterStop = true;
        try {
          process.kill(childPid, 0);
        } catch {
          childAliveAfterStop = false;
        }
        assert.strictEqual(childAliveAfterStop, false, 'Child server in separate PGID must not outlive srv.stop()');
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
        let gradedChildAlive = true;
        try {
          process.kill(gradedChildPid, 0);
        } catch {
          gradedChildAlive = false;
        }
        assert.strictEqual(gradedChildAlive, false, 'No target server process may outlive runPlaywright grading');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
