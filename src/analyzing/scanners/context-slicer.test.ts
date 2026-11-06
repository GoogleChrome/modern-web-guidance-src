import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInMemoryProject } from './js-scanner.ts';
import { extractScriptBlocks } from './sfc-extractor.ts';
import {
  extractCompactSnippet,
  formatNumberedLines,
  sliceJsAstContext,
  sliceStructuredBlock,
  sliceStructuredContext,
} from './context-slicer.ts';

describe('context-slicer', () => {
  it('Bug 1: preserves unblanked <template> HTML and <style> CSS in Vue/Svelte/HTML script slices', () => {
    const vueContent = [
      '<template>',
      '  <header id="site-header" class="sticky-top">',
      '    <nav>Navigation</nav>',
      '  </header>',
      '</template>',
      '<script>',
      'export default {',
      '  mounted() {',
      '    const header = document.getElementById("site-header");',
      '    window.addEventListener("scroll", () => {',
      '      header.classList.toggle("is-stuck", window.scrollY > 0);',
      '    });',
      '  }',
      '};',
      '</script>',
      '<style>',
      '#site-header.is-stuck {',
      '  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);',
      '}',
      '</style>',
    ].join('\n');

    const blocks = extractScriptBlocks('src/components/Header.vue', vueContent);
    assert.equal(blocks.length, 1);
    const block = blocks[0];
    assert.ok(block);

    const project = createInMemoryProject();
    const sourceFile = project.createSourceFile(block.virtualPath, block.blankedContent, {
      overwrite: true,
    });

    const { contextSlice } = sliceStructuredContext(
      'src/components/Header.vue',
      vueContent,
      11,
      sourceFile,
    );

    // Must contain the enclosing mounted() method and target line marker
    assert.match(contextSlice, /mounted\(\)/);
    assert.match(contextSlice, />   11 \|       header\.classList\.toggle\("is-stuck", window\.scrollY > 0\);/);

    // Must also include the unblanked <template> and <style> context
    assert.match(contextSlice, /\/\/ --- Template \/ Style Context ---/);
    assert.match(contextSlice, /<header id="site-header" class="sticky-top">/);
    assert.match(contextSlice, /#site-header\.is-stuck \{/);
  });

  it('Bug 2: walks past inner callback ArrowFunctions/FunctionExpressions to the enclosing function or top-level statement', () => {
    const jsContent = [
      'import { trackScroll } from "./analytics.js";',
      '',
      'function setupStickyHeader() {',
      '  const header = document.querySelector(".header");',
      '  let isStuck = false;',
      '  window.addEventListener("scroll", () => {',
      '    requestAnimationFrame(() => {',
      '      isStuck = window.scrollY > 0;',
      '      header.classList.toggle("stuck", isStuck);',
      '    });',
      '  });',
      '}',
    ].join('\n');

    const project = createInMemoryProject();
    const sourceFile = project.createSourceFile('src/header.ts', jsContent, {
      overwrite: true,
    });

    const slice = sliceJsAstContext(sourceFile, 9, jsContent);

    // Enclosing function setupStickyHeader and local variables must be preserved
    assert.match(slice, /function setupStickyHeader\(\)/);
    assert.match(slice, /const header = document\.querySelector\("\.header"\);/);
    assert.match(slice, /let isStuck = false;/);
    assert.match(slice, />    9 \|       header\.classList\.toggle\("stuck", isStuck\);/);
  });

  it('Bug 2b: walks past inner callbacks to top-level VariableStatement or outer CallExpression when not in a named function', () => {
    const jsContent = [
      'const observer = new IntersectionObserver((entries) => {',
      '  entries.forEach((entry) => {',
      '    if (entry.isIntersecting) {',
      '      entry.target.classList.add("visible");',
      '    }',
      '  });',
      '});',
    ].join('\n');

    const project = createInMemoryProject();
    const sourceFile = project.createSourceFile('src/observer.js', jsContent, {
      overwrite: true,
    });

    const slice = sliceJsAstContext(sourceFile, 4, jsContent);
    assert.match(slice, /const observer = new IntersectionObserver/);
    assert.match(slice, /entries\.forEach/);
    assert.match(slice, />    4 \|       entry\.target\.classList\.add\("visible"\);/);
  });

  it('Bug 3: preserves top-level CommonJS require(...) statements in the Imports header', () => {
    const cjsContent = [
      'const sanitizeHtml = require("sanitize-html");',
      'const marked = require("marked");',
      '',
      'function renderComment(rawMarkdown) {',
      '  const html = marked.parse(rawMarkdown);',
      '  return sanitizeHtml(html);',
      '}',
    ].join('\n');

    const project = createInMemoryProject();
    const sourceFile = project.createSourceFile('src/comment.cjs', cjsContent, {
      overwrite: true,
    });

    const slice = sliceJsAstContext(sourceFile, 6, cjsContent);

    assert.match(slice, /\/\/ --- Imports ---/);
    assert.match(slice, /const sanitizeHtml = require\("sanitize-html"\);/);
    assert.match(slice, /const marked = require\("marked"\);/);
    assert.match(slice, /function renderComment\(rawMarkdown\)/);
    assert.match(slice, />    6 \|   return sanitizeHtml\(html\);/);
  });

  it('Bug 2c: expands short top-level statements by +-15 lines so adjacent variable declarations are preserved', () => {
    const topLevelScript = [
      'import DOMPurify from "dompurify";',
      '',
      'const container = document.getElementById("comment-box");',
      'const cleanHtml = DOMPurify.sanitize(untrustedMarkup);',
      'container.innerHTML = cleanHtml;',
    ].join('\n');

    const project = createInMemoryProject();
    const sourceFile = project.createSourceFile('src/render.js', topLevelScript, {
      overwrite: true,
    });

    const slice = sliceJsAstContext(sourceFile, 5, topLevelScript);
    assert.match(slice, /\/\/ --- Imports ---/);
    assert.match(slice, /import DOMPurify from "dompurify";/);
    assert.match(slice, /const container = document\.getElementById\("comment-box"\);/);
    assert.match(slice, /const cleanHtml = DOMPurify\.sanitize\(untrustedMarkup\);/);
    assert.match(slice, />    5 \| container\.innerHTML = cleanHtml;/);
  });

  it('Bug 4: returns entire package.json when <= 200 lines, and header + window when > 200 lines', () => {
    const smallPkgLines = [
      '{',
      '  "name": "express-pug-server",',
      '  "version": "1.0.0",',
      '  "bin": "./bin/server.js",',
      '  "dependencies": {',
      '    "express": "^4.18.2",',
      '    "pug": "^3.0.2",',
      '    "sanitize-html": "^2.11.0"',
      '  }',
      '}',
    ];
    const smallPkg = smallPkgLines.join('\n');
    const smallSliced = sliceStructuredContext('frontend/package.json', smallPkg, 8);

    assert.match(smallSliced.contextSlice, /"name": "express-pug-server"/);
    assert.match(smallSliced.contextSlice, /"bin": "\.\/bin\/server\.js"/);
    assert.match(smallSliced.contextSlice, /"express": "\^4\.18\.2"/);
    assert.match(smallSliced.contextSlice, />    8 \|     "sanitize-html": "\^2\.11\.0"/);

    // Build a > 200 line package.json where targetLine is at line 180
    const largePkgLines: string[] = [
      '{',
      '  "name": "large-monorepo-pkg",',
      '  "bin": "./cli.js",',
      '  "scripts": {',
      '    "start": "node index.js"',
      '  },',
      '  "dependencies": {',
      '    "express": "^4.18.2",',
    ];
    for (let i = 9; i <= 210; i++) {
      const pkgEntry = i === 180 ? '    "sanitize-html": "^2.11.0",' : `    "pkg-${i}": "^1.0.0",`;
      largePkgLines.push(pkgEntry);
    }
    largePkgLines.push('    "zod": "^3.22.0"', '  }', '}');

    const largePkg = largePkgLines.join('\n');
    assert.ok(largePkgLines.length > 200);

    const largeSliced = sliceStructuredContext('package.json', largePkg, 180);
    // Must include first 35 lines (name, bin, scripts, dependencies, express)
    assert.match(largeSliced.contextSlice, /"name": "large-monorepo-pkg"/);
    assert.match(largeSliced.contextSlice, /"bin": "\.\/cli\.js"/);
    assert.match(largeSliced.contextSlice, /"express": "\^4\.18\.2"/);
    assert.match(largeSliced.contextSlice, /   35 \|/);
    // Must include ellipsis separator and +-30 window around line 180
    assert.match(largeSliced.contextSlice, /\.\.\./);
    assert.match(largeSliced.contextSlice, />  180 \|     "sanitize-html": "\^2\.11\.0",/);
    assert.match(largeSliced.contextSlice, /  150 \|/);
    assert.match(largeSliced.contextSlice, /  210 \|/);
  });

  it('formatNumberedLines, sliceJsAstContext folding, and sliceStructuredBlock slice accurately', () => {
    const formatted = formatNumberedLines(['const a = 1;', 'const b = 2;', 'const c = 3;'], 10, 11);
    assert.match(formatted, /10 \| const a = 1;/);
    assert.match(formatted, />   11 \| const b = 2;/);
    assert.match(formatted, /12 \| const c = 3;/);

    const project = createInMemoryProject();
    const bodyLines = Array.from({ length: 150 }, (_, i) => `  line_${i + 1}();`);
    const hugeSf = project.createSourceFile(
      'huge.ts',
      `function hugeFunction() {\n${bodyLines.join('\n')}\n}\n`,
    );
    const folded = sliceJsAstContext(hugeSf, 75);
    assert.match(folded, /lines folded in enclosing scope/);
    assert.match(folded, />\s+75 \|   line_74\(\);/);

    const html = '<form>\n  <input type="password">\n  <button>Submit</button>\n</form>\n';
    assert.match(extractCompactSnippet(html, 2), />    2 \|   <input type="password">/);
    assert.match(sliceStructuredBlock(html, 3), />    3 \|   <button>Submit<\/button>/);

    const context = sliceStructuredContext('test.html', html, 2);
    assert.ok(context.codeSnippet);
    assert.ok(context.contextSlice);
    assert.equal(context.lineContent, '<input type="password">');
  });
});
