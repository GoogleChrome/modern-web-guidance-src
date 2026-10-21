import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  sanitizeUntrustedHtmlRules,
  sanitizerJsMatcher,
} from './sanitize-untrusted-html.ts';

const jsMatcher = sanitizerJsMatcher;

void test('sanitize-untrusted-html default rules array excludes package-sanitizer (R46, R49)', () => {
  assert.equal(sanitizeUntrustedHtmlRules.length, 1);
  assert.equal(
    sanitizeUntrustedHtmlRules[0]?.id,
    'sanitize-untrusted-html/js-dompurify-innerhtml',
  );
});

void test('sanitize-untrusted-html JS matcher', async (t) => {
  await t.test('flags direct el.innerHTML = DOMPurify.sanitize(input)', () => {
    const project = createInMemoryProject();
    const code = `
      const target = document.getElementById('preview');
      target.innerHTML = DOMPurify.sanitize(userInput);
    `;
    const sourceFile = project.createSourceFile('preview.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'preview.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /innerHTML/);
  });

  await t.test('flags local variable assigned to innerHTML (cyberchef pattern)', () => {
    const project = createInMemoryProject();
    const code = `
      const clean = DOMPurify.sanitize(name);
      item.innerHTML = clean;
    `;
    const sourceFile = project.createSourceFile('recipe.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'recipe.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /innerHTML/);
  });

  await t.test('flags el.insertAdjacentHTML with sanitized html', () => {
    const project = createInMemoryProject();
    const code = `
      container.insertAdjacentHTML('beforeend', DOMPurify.sanitize(content));
    `;
    const sourceFile = project.createSourceFile('render.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'render.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /insertAdjacentHTML/);
  });

  await t.test('flags jQuery .html() with sanitizeHtml', () => {
    const project = createInMemoryProject();
    const code = `
      $('#output').html(sanitizeHtml(dirtyHtml));
    `;
    const sourceFile = project.createSourceFile('view.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'view.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /html/);
  });

  await t.test('exempts React dangerouslySetInnerHTML with DOMPurify.sanitize (R49)', () => {
    const project = createInMemoryProject();
    const code = `
      function PostContent({ html }) {
        return (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
        );
      }
    `;
    const sourceFile = project.createSourceFile('Post.tsx', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'Post.tsx',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts when guarded by native setHTML feature check', () => {
    const project = createInMemoryProject();
    const code = `
      if ('setHTML' in Element.prototype) {
        el.setHTML(html);
      } else {
        el.innerHTML = DOMPurify.sanitize(html);
      }
    `;
    const sourceFile = project.createSourceFile('fallback.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'fallback.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts safe plain text assignments', () => {
    const project = createInMemoryProject();
    const code = `
      el.innerHTML = '<span>Static Label</span>';
    `;
    const sourceFile = project.createSourceFile('static.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'static.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
