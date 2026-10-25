import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SCROLL_COMPLETION_EFFECTS_GUIDE_HASH,
  scrollCompletionEffectsJsMatcher,
  scrollCompletionEffectsRule,
  scrollCompletionEffectsRules,
} from './scroll-completion-effects.ts';

void test('scroll-completion-effects: rule metadata', () => {
  assert.equal(scrollCompletionEffectsRule.id, 'scroll-completion-effects');
  assert.equal(scrollCompletionEffectsRule.guideId, 'scroll-completion-effects');
  assert.equal(
    scrollCompletionEffectsRule.guideHash,
    SCROLL_COMPLETION_EFFECTS_GUIDE_HASH,
  );
  assert.equal(SCROLL_COMPLETION_EFFECTS_GUIDE_HASH.length, 12);
  assert.equal(scrollCompletionEffectsRules.length, 1);
  assert.ok(scrollCompletionEffectsRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(scrollCompletionEffectsRule.verifierRubric.dropWhen.length >= 2);
});

void test('scroll-completion-effects: positive brownfield matches', async (t) => {
  await t.test('flags scrollIntoView with smooth behavior followed by setTimeout focus', () => {
    const project = createInMemoryProject();
    const code = `
      function navigateTo(targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          targetElement.focus();
        }, 500);
      }
    `;
    const sourceFile = project.createSourceFile('smooth-nav.js', code);
    const matches = scrollCompletionEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'smooth-nav.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /setTimeout/);
  });

  await t.test('flags window.scrollTo with smooth behavior paired with setTimeout highlight class', () => {
    const project = createInMemoryProject();
    const code = `
      function scrollToHeader() {
        window.scrollTo({ top: 300, behavior: 'smooth' });
        setTimeout(() => {
          header.classList.add('highlight');
        }, 400);
      }
    `;
    const sourceFile = project.createSourceFile('scroll-highlight.js', code);
    const matches = scrollCompletionEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'scroll-highlight.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });
});

void test('scroll-completion-effects: negative / exempt cases', async (t) => {
  await t.test('exempts code awaiting scrollIntoView directly', () => {
    const project = createInMemoryProject();
    const code = `
      async function modernNavigate(targetElement) {
        await targetElement.scrollIntoView({ behavior: 'smooth' });
        targetElement.focus({ preventScroll: true });
      }
    `;
    const sourceFile = project.createSourceFile('modern.js', code);
    const matches = scrollCompletionEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'modern.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts instant scrolls without smooth behavior', () => {
    const project = createInMemoryProject();
    const code = `
      function instantJump(target) {
        window.scrollTo(0, 0);
        setTimeout(() => {
          doSomething();
        }, 100);
      }
    `;
    const sourceFile = project.createSourceFile('instant.js', code);
    const matches = scrollCompletionEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'instant.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts setTimeout preceding smooth scroll', () => {
    const project = createInMemoryProject();
    const code = `
      function init() {
        setTimeout(() => console.log('ready'), 500);
        element.scrollIntoView({ behavior: 'smooth' });
      }
    `;
    const sourceFile = project.createSourceFile('init.js', code);
    const matches = scrollCompletionEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'init.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts scroll guarded by scroll promise feature detection', () => {
    const project = createInMemoryProject();
    const code = `
      function safeScroll(el) {
        const res = el.scrollIntoView({ behavior: 'smooth' });
        if (!(res instanceof Promise)) {
          setTimeout(() => el.focus(), 500);
        }
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = scrollCompletionEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
