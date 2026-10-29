import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { scanJsSource } from '../scanners/index.ts';
import {
  imeSafeEnterSubmitMatcher
} from './ime-safe-enter-submit.ts';

describe('ime-safe-enter-submit rule', () => {
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
      [imeSafeEnterSubmitMatcher]
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
      [imeSafeEnterSubmitMatcher]
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
      [imeSafeEnterSubmitMatcher]
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
      [imeSafeEnterSubmitMatcher]
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
      [imeSafeEnterSubmitMatcher]
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
      [imeSafeEnterSubmitMatcher]
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
      [imeSafeEnterSubmitMatcher]
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
      [imeSafeEnterSubmitMatcher]
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
      [imeSafeEnterSubmitMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('flags canonical if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) bug with negated modifiers', () => {
    const code = `
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    `;
    const { matches } = scanJsSource(
      'chat/negated-modifiers.js',
      code,
      [imeSafeEnterSubmitMatcher]
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /isComposing|IME/);
  });

  test('ignores Enter handlers that only call preventDefault, stopPropagation, or return false without submission', () => {
    const code = `
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
        }
      });
      textarea.addEventListener('keydown', (e) => {
        if (e.keyCode === 13) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      });
      input2.addEventListener('keydown', (e) => {
        switch (e.keyCode) {
          case 13:
            e.preventDefault();
            break;
        }
      });
    `;
    const { matches } = scanJsSource(
      'chat/suppress-only.js',
      code,
      [imeSafeEnterSubmitMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores custom ARIA role="button" elements with keydown activation', () => {
    const code = `
      const btn = document.getElementById('custom-btn');
      btn.setAttribute('role', 'button');
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btn.click();
        }
      });

      const tab = document.getElementById('tab-1');
      tab.role = 'tab';
      tab.onkeydown = (e) => {
        if (e.keyCode === 13) {
          e.preventDefault();
          tab.click();
        }
      };

      $('[role="button"]').on('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          $(this).click();
        }
      });
    `;
    const { matches } = scanJsSource(
      'ui/aria-button.js',
      code,
      [imeSafeEnterSubmitMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores JSX elements with role="button" handling Enter', () => {
    const code = `
      export function CustomButton({ onClick }) {
        return (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onClick();
              }
            }}
          >
            Click me
          </div>
        );
      }
    `;
    const { matches } = scanJsSource(
      'components/CustomButton.tsx',
      code,
      [imeSafeEnterSubmitMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('exempts keydown Enter handlers inside test and spec files', () => {
    const code = `
      textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          form.requestSubmit();
        }
      });
    `;
    const testPaths = [
      'src/__tests__/chat.test.ts',
      'tests/input.spec.js',
      'components/ChatBox.test.tsx',
    ];
    for (const testPath of testPaths) {
      const { matches } = scanJsSource(
        testPath,
        code,
        [imeSafeEnterSubmitMatcher]
      );
      assert.equal(matches.length, 0, `Expected no matches for test file ${testPath}`);
    }
  });

  test('flags custom action methods like this.login() or props.onCommit() on Enter keydown', () => {
    const code = `
      input.addEventListener('keydown', function(e) {
        if (e.keyCode === 13) {
          this.login();
        }
      });
    `;
    const { matches } = scanJsSource(
      'auth/login.js',
      code,
      [imeSafeEnterSubmitMatcher]
    );
    assert.equal(matches.length, 1);
  });

  test('ignores global document hotkeys, Alt+Enter shortcuts, Space+Enter button activation, and arrow-key widget navigation', () => {
    const code = `
      document.addEventListener('keydown', (event) => {
        switch (event.keyCode) {
          case 13:
            isOverview() ? deactivateOverview() : triggered = false;
            break;
        }
      });

      input.addEventListener('keydown', (event) => {
        if (event.altKey && event.key === 'Enter') {
          submitShortcut();
        }
      });

      customBtn.addEventListener('keydown', function(event) {
        if (event.code === 'Enter' || event.code === 'Space') {
          this.click();
        }
      });

      dropdown.addEventListener('keydown', (event) => {
        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowDown':
            moveFocus();
            break;
          case 'Enter':
            option.click();
            break;
        }
      });
    `;
    const { matches } = scanJsSource(
      'ui/keyboard-shortcuts.js',
      code,
      [imeSafeEnterSubmitMatcher]
    );
    assert.equal(matches.length, 0);
  });
});
