import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  scrollCompletionEffectsJsMatcher
} from './scroll-completion-effects.ts';
void test('scroll-completion-effects: positive brownfield matches', async (t) => {
  await t.test('flags scrollIntoView with smooth behavior followed by setTimeout focus', () => {
    const code = `
      function navigateTo(targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          targetElement.focus();
        }, 500);
      }
    `;
    const matches = matchJsRule(scrollCompletionEffectsJsMatcher, 'smooth-nav.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /setTimeout/);
  });

  await t.test('flags window.scrollTo with smooth behavior paired with setTimeout highlight class', () => {
    const code = `
      function scrollToHeader() {
        window.scrollTo({ top: 300, behavior: 'smooth' });
        setTimeout(() => {
          header.classList.add('highlight');
        }, 400);
      }
    `;
    const matches = matchJsRule(scrollCompletionEffectsJsMatcher, 'scroll-highlight.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });
});

void test('scroll-completion-effects: negative / exempt cases', async (t) => {
  await t.test('exempts code awaiting scrollIntoView directly', () => {
    const code = `
      async function modernNavigate(targetElement) {
        await targetElement.scrollIntoView({ behavior: 'smooth' });
        targetElement.focus({ preventScroll: true });
      }
    `;
    const matches = matchJsRule(scrollCompletionEffectsJsMatcher, 'modern.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts instant scrolls without smooth behavior', () => {
    const code = `
      function instantJump(target) {
        window.scrollTo(0, 0);
        setTimeout(() => {
          doSomething();
        }, 100);
      }
    `;
    const matches = matchJsRule(scrollCompletionEffectsJsMatcher, 'instant.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts setTimeout preceding smooth scroll', () => {
    const code = `
      function init() {
        setTimeout(() => console.log('ready'), 500);
        element.scrollIntoView({ behavior: 'smooth' });
      }
    `;
    const matches = matchJsRule(scrollCompletionEffectsJsMatcher, 'init.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts scroll guarded by scroll promise feature detection', () => {
    const code = `
      function safeScroll(el) {
        const res = el.scrollIntoView({ behavior: 'smooth' });
        if (!(res instanceof Promise)) {
          setTimeout(() => el.focus(), 500);
        }
      }
    `;
    const matches = matchJsRule(scrollCompletionEffectsJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts setTimeout in mutually exclusive ternary branch', () => {
    const ternaryCode = `
      export const scrollToElement = (parentRef, selectedElement, shouldScrollToTop = false) => {
        shouldScrollToTop
          ? parentRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
          : setTimeout(() => {
              scrollToCenter(parentRef?.current, selectedElement);
            }, 100);
      };
    `;
    assert.equal(
      matchJsRule(scrollCompletionEffectsJsMatcher, 'scroll.util.js', ternaryCode).length,
      0,
    );
  });
});
