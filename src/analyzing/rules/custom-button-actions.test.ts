import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  customButtonActionsJsMatcher
} from './custom-button-actions.ts';
void test('custom-button-actions: positive brownfield matches', async (t) => {
  await t.test('flags spin button click listener querying target element to toggle class', () => {
    const code = `
      const spinBtn = document.getElementById('spin-btn');
      spinBtn.addEventListener('click', () => {
        const target = document.getElementById('action-target');
        target.classList.toggle('is-spun');
      });
    `;
    const matches = matchJsRule(customButtonActionsJsMatcher, 'button-spin.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /commandfor/);
  });

  await t.test('flags delegated click listener handling button data-action to dispatch event', () => {
    const code = `
      document.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const target = document.querySelector(button.dataset.target);
        target.dispatchEvent(new CustomEvent('action'));
      });
    `;
    const matches = matchJsRule(customButtonActionsJsMatcher, 'delegated.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('custom-button-actions: negative / exempt cases', async (t) => {
  await t.test('exempts file already using commandfor attribute', () => {
    const code = `
      const btn = document.querySelector('button[commandfor="target"]');
      btn.addEventListener('click', () => {
        console.log('invoker active');
      });
    `;
    const matches = matchJsRule(customButtonActionsJsMatcher, 'modern-invoker.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts dialog or popover openers (handled by dialog rules)', () => {
    const code = `
      btn.addEventListener('click', () => {
        dialog.showModal();
      });
    `;
    const matches = matchJsRule(customButtonActionsJsMatcher, 'dialog-open.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts button toggling its own active class', () => {
    const code = `
      button.addEventListener('click', () => {
        button.classList.toggle('active');
      });
    `;
    const matches = matchJsRule(customButtonActionsJsMatcher, 'self-toggle.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts button managing simple internal counter with no target element', () => {
    const code = `
      let count = 0;
      button.addEventListener('click', () => {
        count++;
      });
    `;
    const matches = matchJsRule(customButtonActionsJsMatcher, 'counter.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-button element listeners, self $element toggles, and native input Event dispatch', () => {
    const code = `
      annoteDlNode.addEventListener('click', (event) => {
        const clickedEl = event.target;
        if (clickedEl.dataset.targetCell) {
          clickedEl.classList.add('code-annotation-active');
        }
      });

      button.$element.addEventListener('click', () => {
        button.$element.classList.toggle('is-active');
      });

      resetBtn.addEventListener('click', () => {
        const target = document.getElementById('field');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      });
    `;
    const matches = matchJsRule(customButtonActionsJsMatcher, 'non-invoker.js', code);
    assert.equal(matches.length, 0);
  });
});
