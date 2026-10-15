import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  IME_SAFE_ENTER_SUBMIT_GUIDE_HASH,
  imeSafeEnterSubmitMatcher,
  imeSafeEnterSubmitRule,
} from './ime-safe-enter-submit.ts';

describe('ime-safe-enter-submit rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(imeSafeEnterSubmitRule.id, 'ime-safe-enter-submit');
    assert.equal(imeSafeEnterSubmitRule.guideId, 'ime-safe-enter-submit');
    assert.equal(imeSafeEnterSubmitRule.guideHash, IME_SAFE_ENTER_SUBMIT_GUIDE_HASH);
    assert.equal(imeSafeEnterSubmitRule.guideHash.length, 12);
    assert.ok(imeSafeEnterSubmitRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(imeSafeEnterSubmitRule.phase2Rubric.dropWhen.length >= 2);
  });

  test('flags addEventListener keydown checking event.key === "Enter"', () => {
    const code = `
      textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          form.requestSubmit();
        }
      });
    `;
    const { matches } = scanJsSource(
      'chat/input.js',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /isComposing|IME/);
  });

  test('flags jQuery keydown with keyCode === 13 (grocy pattern)', () => {
    const code = `
      $('#barcode-form input').keydown(function(event) {
        if (event.keyCode === 13) {
          event.preventDefault();
          $('#save-barcode-button').click();
        }
      });
    `;
    const { matches } = scanJsSource(
      'forms/barcode.js',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /isComposing|IME/);
  });

  test('flags JSX onKeyDown handler checking event.key === "Enter"', () => {
    const code = `
      export function ChatBox({ onSend }) {
        return (
          <textarea
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
        );
      }
    `;
    const { matches } = scanJsSource(
      'components/ChatBox.tsx',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /isComposing|IME/);
  });

  test('flags element.onkeydown assignment with event.which === 13', () => {
    const code = `
      const input = document.getElementById('search');
      input.onkeydown = function(e) {
        if (e.which === 13) {
          e.preventDefault();
          doSearch();
        }
      };
    `;
    const { matches } = scanJsSource(
      'search/search.js',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /isComposing|IME/);
  });

  test('flags switch statement on keyCode 13 inside keydown listener', () => {
    const code = `
      input.addEventListener('keydown', (event) => {
        switch (event.keyCode) {
          case 13:
            event.preventDefault();
            submitForm();
            break;
        }
      });
    `;
    const { matches } = scanJsSource(
      'input/switch.js',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /isComposing|IME/);
  });

  test('ignores handler that checks event.isComposing', () => {
    const code = `
      textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if (event.isComposing) {
            return;
          }
          form.requestSubmit();
        }
      });
    `;
    const { matches } = scanJsSource(
      'chat/safe-input.js',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores handler that checks event.keyCode === 229', () => {
    const code = `
      textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          if (event.isComposing || event.keyCode === 229) {
            return;
          }
          form.requestSubmit();
        }
      });
    `;
    const { matches } = scanJsSource(
      'chat/safe-safari.js',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores keyup and keypress event listeners', () => {
    const code = `
      input.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
          form.requestSubmit();
        }
      });
      input.addEventListener('keypress', (event) => {
        if (event.keyCode === 13) {
          form.requestSubmit();
        }
      });
    `;
    const { matches } = scanJsSource(
      'forms/keyup.js',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores Ctrl+Enter or Cmd+Enter shortcut submissions', () => {
    const code = `
      textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          submitMessage();
        }
      });
    `;
    const { matches } = scanJsSource(
      'chat/shortcut.js',
      code,
      [imeSafeEnterSubmitMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
