import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import { pullToRevealJsMatcher } from './pull-to-reveal.ts';
import { scrollTargetOnLoadMatcher } from './scroll-target-on-load.ts';

void test('pull-to-reveal: positive brownfield matches', async (t) => {
  await t.test('flags container.scrollTop = searchBar.offsetHeight on load to hide top search bar', () => {
    const code = `
      document.addEventListener('DOMContentLoaded', () => {
        const container = document.querySelector('.scroll-container');
        const searchBar = document.querySelector('.search-bar');
        container.scrollTop = searchBar.offsetHeight;
      });
    `;
    const matches = matchJsRule(pullToRevealJsMatcher, 'reveal.ts', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /scroll-initial-target/);

    // Verify 0 overlap with scroll-target-on-load
    const neighborMatches = matchJsRule(scrollTargetOnLoadMatcher, 'reveal.ts', code);
    assert.equal(neighborMatches.length, 0);
  });

  await t.test('flags container.scrollTo({ top: headerEl.clientHeight }) in component mount', () => {
    const code = `
      export function mountPullToReveal(scroller: HTMLElement, revealHeader: HTMLElement) {
        const headerHeight = revealHeader.clientHeight;
        scroller.scrollTo({ top: headerHeight });
      }
    `;
    const matches = matchJsRule(pullToRevealJsMatcher, 'mount.ts', code);
    assert.equal(matches.length, 1);
  });
});

void test('pull-to-reveal: negative / exempt cases', async (t) => {
  await t.test('exempts files already using scroll-initial-target', () => {
    const code = `
      if (!CSS.supports('scroll-initial-target', 'nearest')) {
        container.scrollTop = searchBar.offsetHeight;
      }
    `;
    const matches = matchJsRule(pullToRevealJsMatcher, 'fallback.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts interactive click/scroll listeners and chat scrollTop = scrollHeight', () => {
    const code = `
      chatContainer.scrollTop = chatContainer.scrollHeight;
      button.addEventListener('click', () => {
        container.scrollTop = searchHeader.offsetHeight;
      });
    `;
    const matches = matchJsRule(pullToRevealJsMatcher, 'chat.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('carves out DOMContentLoaded scrollTo calls owned by scroll-target-on-load', () => {
    const code = `
      window.addEventListener('DOMContentLoaded', () => {
        const header = document.querySelector('.header');
        window.scrollTo(0, header.offsetHeight);
      });
    `;
    const matches = matchJsRule(pullToRevealJsMatcher, 'onload.ts', code);
    assert.equal(matches.length, 0);
  });
});
