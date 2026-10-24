import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  CUSTOM_BUTTON_ACTIONS_GUIDE_HASH,
  customButtonActionsJsMatcher,
  customButtonActionsRule,
  customButtonActionsRules,
} from './custom-button-actions.ts';

void test('custom-button-actions: rule metadata', () => {
  assert.equal(customButtonActionsRule.id, 'custom-button-actions');
  assert.equal(customButtonActionsRule.guideId, 'custom-button-actions');
  assert.equal(
    customButtonActionsRule.guideHash,
    CUSTOM_BUTTON_ACTIONS_GUIDE_HASH,
  );
  assert.equal(CUSTOM_BUTTON_ACTIONS_GUIDE_HASH.length, 12);
  assert.equal(customButtonActionsRules.length, 1);
  assert.ok(customButtonActionsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(customButtonActionsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('custom-button-actions: positive brownfield matches', async (t) => {
  await t.test('flags spin button click listener querying target element to toggle class', () => {
    const project = createInMemoryProject();
    const code = `
      const spinBtn = document.getElementById('spin-btn');
      spinBtn.addEventListener('click', () => {
        const target = document.getElementById('action-target');
        target.classList.toggle('is-spun');
      });
    `;
    const sourceFile = project.createSourceFile('button-spin.js', code);
    const matches = customButtonActionsJsMatcher.matchFile(sourceFile, {
      filePath: 'button-spin.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /commandfor/);
  });

  await t.test('flags delegated click listener handling button data-action to dispatch event', () => {
    const project = createInMemoryProject();
    const code = `
      document.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const target = document.querySelector(button.dataset.target);
        target.dispatchEvent(new CustomEvent('action'));
      });
    `;
    const sourceFile = project.createSourceFile('delegated.js', code);
    const matches = customButtonActionsJsMatcher.matchFile(sourceFile, {
      filePath: 'delegated.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('custom-button-actions: negative / exempt cases', async (t) => {
  await t.test('exempts file already using commandfor attribute', () => {
    const project = createInMemoryProject();
    const code = `
      const btn = document.querySelector('button[commandfor="target"]');
      btn.addEventListener('click', () => {
        console.log('invoker active');
      });
    `;
    const sourceFile = project.createSourceFile('modern-invoker.js', code);
    const matches = customButtonActionsJsMatcher.matchFile(sourceFile, {
      filePath: 'modern-invoker.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts dialog or popover openers (handled by dialog rules)', () => {
    const project = createInMemoryProject();
    const code = `
      btn.addEventListener('click', () => {
        dialog.showModal();
      });
    `;
    const sourceFile = project.createSourceFile('dialog-open.js', code);
    const matches = customButtonActionsJsMatcher.matchFile(sourceFile, {
      filePath: 'dialog-open.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts button toggling its own active class', () => {
    const project = createInMemoryProject();
    const code = `
      button.addEventListener('click', () => {
        button.classList.toggle('active');
      });
    `;
    const sourceFile = project.createSourceFile('self-toggle.js', code);
    const matches = customButtonActionsJsMatcher.matchFile(sourceFile, {
      filePath: 'self-toggle.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts button managing simple internal counter with no target element', () => {
    const project = createInMemoryProject();
    const code = `
      let count = 0;
      button.addEventListener('click', () => {
        count++;
      });
    `;
    const sourceFile = project.createSourceFile('counter.js', code);
    const matches = customButtonActionsJsMatcher.matchFile(sourceFile, {
      filePath: 'counter.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
