import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import { formFieldsAutomaticallyFitContentsRule } from './form-fields-automatically-fit-contents.ts';

const matcher = formFieldsAutomaticallyFitContentsRule.matcher as JsRuleMatcher;

void test('form-fields-automatically-fit-contents: positive cases', async (t) => {
  await t.test('flags autosize(textarea) library call', () => {
    const code = `
      import autosize from 'autosize';

      export function initCommentForm() {
        const textarea = document.querySelector('textarea');
        autosize(textarea);
      }
    `;
    const { matches } = scanJsSource('autosize-init.js', code, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 6);
    assert.match(matches[0]?.message ?? '', /autosize\(\)/);
  });

  await t.test('flags autosize call on React ref in componentDidMount', () => {
    const code = `
      import autosize from 'autosize';

      class ExpandableTextarea extends React.Component {
        componentDidMount() {
          autosize(this.textareaRef.current);
        }
      }
    `;
    const { matches } = scanJsSource('react-textarea.js', code, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 6);
  });

  await t.test('flags classic textarea input listener with height auto/scrollHeight pattern', () => {
    const code = `
      const textarea = document.getElementById('chat-input');
      textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
      });
    `;
    const { matches } = scanJsSource('chat.js', code, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
    assert.match(matches[0]?.message ?? '', /field-sizing: content/);
  });

  await t.test('flags elFinder real-world textarea keyup auto-expansion', () => {
    const code = `
      input.on('keyup text', function() {
        if (tarea) {
          this.style.height = '1px';
          this.style.height = this.scrollHeight + 'px';
        }
      });
    `;
    const { matches } = scanJsSource('elfinder.js', code, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });

  await t.test('flags helper function autoExpand calculating revised height from scrollHeight', () => {
    const code = `
      function autoExpandTextarea(domNode) {
        domNode.style.height = "auto";
        const newHeight = domNode.scrollHeight + 4;
        domNode.style.height = newHeight + "px";
      }
    `;
    const { matches } = scanJsSource('expand.js', code, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });
});

void test('form-fields-automatically-fit-contents: negative cases', async (t) => {
  await t.test('skips when guarded by CSS.supports for field-sizing', () => {
    const code = `
      if (!CSS.supports('field-sizing', 'content')) {
        document.querySelectorAll('textarea').forEach((ta) => {
          ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
          });
        });
      }
    `;
    const { matches } = scanJsSource('guarded.js', code, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips dialog content overflow inspection', () => {
    const code = `
      function checkDialogOverflow(dialogContentNode) {
        if (dialogContentNode.scrollHeight > dialogContentNode.clientHeight) {
          showScrollIndicators();
        }
      }
    `;
    const { matches } = scanJsSource('dialog.js', code, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips unrelated window scrolling calculations', () => {
    const code = `
      function updateScrollProgress(container) {
        const scrolled = container.scrollTop;
        const total = container.scrollHeight - container.clientHeight;
        progressBar.style.width = (scrolled / total * 100) + '%';
      }
    `;
    const { matches } = scanJsSource('progress.js', code, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips orientationchange and hashchange event listeners', () => {
    const code = `
      window.addEventListener('orientationchange', function() {
        container.style.height = container.scrollHeight + 'px';
      });
    `;
    const { matches } = scanJsSource('orientation.js', code, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips chart.autosize() or grid.autosize() calls', () => {
    const code = `
      function resizeDashboard(chart, grid) {
        chart.autosize();
        grid.autosize();
      }
    `;
    const { matches } = scanJsSource('dashboard.js', code, [matcher]);
    assert.equal(matches.length, 0);
  });
});
