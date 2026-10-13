import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { getCssStyleSheet, getHtmlDocuments, getJsProject } from './test-fixture.ts';
import { CSSPropertyRule, CSSStyleRule } from 'cssomnom';
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

  test('getJsProject populates ts-morph Project from .ts and <script> tags', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-js-test-'));
    try {
      const tsFile = path.join(tempDir, 'logic.ts');
      fs.writeFileSync(tsFile, 'export function calculateTotal(a: number, b: number): number { return a + b; }', 'utf8');

      const htmlFile = path.join(tempDir, 'index.html');
      fs.writeFileSync(htmlFile, '<script>function inlineHelper() { return 42; }</script>', 'utf8');

      const project = getJsProject([tsFile, htmlFile]);
      const sourceFiles = project.getSourceFiles();
      assert.ok(sourceFiles.length >= 2);

      const functionDecls = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration));
      const funcNames = functionDecls.map(fn => fn.getName());
      assert.ok(funcNames.includes('calculateTotal'));
      assert.ok(funcNames.includes('inlineHelper'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
