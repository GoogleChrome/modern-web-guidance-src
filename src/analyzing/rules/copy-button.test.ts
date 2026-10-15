import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  COPY_BUTTON_GUIDE_HASH,
  copyButtonMatcher,
  copyButtonRule,
} from './copy-button.ts';

describe('copy-button rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(copyButtonRule.id, 'copy-button');
    assert.equal(copyButtonRule.guideId, 'copy-button');
    assert.equal(copyButtonRule.guideHash, COPY_BUTTON_GUIDE_HASH);
    assert.equal(copyButtonRule.guideHash.length, 12);
    assert.ok(copyButtonRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(copyButtonRule.phase2Rubric.dropWhen.length >= 2);
  });

  test('flags classic document.execCommand("copy") pattern with temporary textarea', () => {
    const code = `
      function copyText(value) {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    `;
    const { matches } = scanJsSource(
      'utils/clipboard.js',
      code,
      [copyButtonMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /navigator\.clipboard\.writeText/);
  });

  test('flags execCommand("copy") without explicit document prefix', () => {
    const code = `
      function onCopyClick() {
        selectInputText();
        execCommand("copy");
      }
    `;
    const { matches } = scanJsSource(
      'ui/copy.js',
      code,
      [copyButtonMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /navigator\.clipboard\.writeText/);
  });

  test('flags new ClipboardJS instantiation', () => {
    const code = `
      function initCopyButtons() {
        const clipboard = new ClipboardJS('.copy-btn');
        clipboard.on('success', (e) => {
          showToast('Copied!');
        });
      }
    `;
    const { matches } = scanJsSource(
      'ui/button.js',
      code,
      [copyButtonMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /ClipboardJS/);
  });

  test('flags new Clipboard constructor when imported from clipboard package', () => {
    const code = `
      import Clipboard from 'clipboard';

      export function setupCopy(btn) {
        return new Clipboard(btn);
      }
    `;
    const { matches } = scanJsSource(
      'ui/copy-tool.js',
      code,
      [copyButtonMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /ClipboardJS/);
  });

  test('ignores execCommand("copy") inside navigator.clipboard feature guard else branch', () => {
    const code = `
      async function copy(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
      }
    `;
    const { matches } = scanJsSource(
      'utils/copy-fallback.js',
      code,
      [copyButtonMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores execCommand("copy") guarded by negative feature check', () => {
    const code = `
      function fallbackCopy(text) {
        if (!navigator.clipboard) {
          document.execCommand('copy');
        }
      }
    `;
    const { matches } = scanJsSource(
      'utils/safe-copy.js',
      code,
      [copyButtonMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores rich text execCommand commands like "bold" or "insertText"', () => {
    const code = `
      function makeBold() {
        document.execCommand('bold', false, null);
        document.execCommand('insertText', false, 'hello');
      }
    `;
    const { matches } = scanJsSource(
      'editor/wysiwyg.js',
      code,
      [copyButtonMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores unrelated Clipboard constructor without clipboard package import', () => {
    const code = `
      class Clipboard {
        constructor() {
          this.items = [];
        }
      }
      const myClip = new Clipboard();
    `;
    const { matches } = scanJsSource(
      'models/clipboard.js',
      code,
      [copyButtonMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
