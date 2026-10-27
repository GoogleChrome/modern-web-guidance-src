import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import sanitizeUntrustedHtmlRules, { sanitizerJsMatcher } from './sanitize-untrusted-html.ts';

const jsMatcher = sanitizerJsMatcher;

void test('sanitize-untrusted-html default rules array excludes package-sanitizer', () => {
  assert.equal(sanitizeUntrustedHtmlRules.length, 1);
  assert.equal(
    sanitizeUntrustedHtmlRules[0]?.id,
    'sanitize-untrusted-html/js-dompurify-innerhtml',
  );
});

void test('sanitize-untrusted-html JS matcher', async (t) => {
  await t.test('flags direct el.innerHTML = DOMPurify.sanitize(input)', () => {
    const code = `
      const target = document.getElementById('preview');
      target.innerHTML = DOMPurify.sanitize(userInput);
    `;
    const matches = matchJsRule(jsMatcher, 'preview.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /innerHTML/);
  });

  await t.test('flags local variable assigned to innerHTML (cyberchef pattern)', () => {
    const code = `
      const clean = DOMPurify.sanitize(name);
      item.innerHTML = clean;
    `;
    const matches = matchJsRule(jsMatcher, 'recipe.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /innerHTML/);
  });

  await t.test('flags el.insertAdjacentHTML with sanitized html', () => {
    const code = `
      container.insertAdjacentHTML('beforeend', DOMPurify.sanitize(content));
    `;
    const matches = matchJsRule(jsMatcher, 'render.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /insertAdjacentHTML/);
  });

  await t.test('flags jQuery .html() with sanitizeHtml', () => {
    const code = `
      $('#output').html(sanitizeHtml(dirtyHtml));
    `;
    const matches = matchJsRule(jsMatcher, 'view.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /html/);
  });

  await t.test('exempts React dangerouslySetInnerHTML with DOMPurify.sanitize', () => {
    const code = `
      function PostContent({ html }) {
        return (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
        );
      }
    `;
    const matches = matchJsRule(jsMatcher, 'Post.tsx', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts when guarded by native setHTML feature check', () => {
    const code = `
      if ('setHTML' in Element.prototype) {
        el.setHTML(html);
      } else {
        el.innerHTML = DOMPurify.sanitize(html);
      }
    `;
    const matches = matchJsRule(jsMatcher, 'fallback.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts safe plain text assignments', () => {
    const code = `
      el.innerHTML = '<span>Static Label</span>';
    `;
    const matches = matchJsRule(jsMatcher, 'static.js', code);
    assert.equal(matches.length, 0);
  });
});
