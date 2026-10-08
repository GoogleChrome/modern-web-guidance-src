import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { getCssStyleSheet, getHtmlDocuments, getJsProject } from './test-fixture.ts';
import { CSSStyleRule, CSSContainerRule } from 'cssomnom';
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

  test('getCssStyleSheet ignores unparsed JSX inline style expressions in .astro files without corrupting subsequent rules', () => {
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
