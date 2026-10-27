import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  scrollTargetOnLoadMatcher
} from './scroll-target-on-load.ts';
void test('scroll-target-on-load JS matcher', async (t) => {
  await t.test('flags DOMContentLoaded and load listeners reading location.hash and calling scrollIntoView or window.scrollTo', () => {
    const code = `
      document.addEventListener('DOMContentLoaded', () => {
        if (window.location.hash) {
          const target = document.querySelector(window.location.hash);
          target?.scrollIntoView();
        }
      });

      window.addEventListener('load', () => {
        if (location.hash) {
          const el = document.getElementById(location.hash.slice(1));
          if (el) {
            window.scrollTo(0, el.offsetTop);
          }
        }
      });
    `;
    const matches = matchJsRule(scrollTargetOnLoadMatcher, 'scroll-load.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports("scroll-initial-target", "nearest") or inside click listeners', () => {
    const code = `
      document.addEventListener('DOMContentLoaded', () => {
        if (!CSS.supports('scroll-initial-target', 'nearest')) {
          const feedTarget = document.querySelector('.item.target');
          feedTarget?.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      });

      button.addEventListener('click', () => {
        section.scrollIntoView({ behavior: 'smooth' });
      });

      window.addEventListener('load', () => {
        const el = document.querySelector(location.hash);
        if (el) {
          window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
        }
      });

      document.addEventListener('DOMContentLoaded', () => {
        const el = document.querySelector('#initial');
        el?.scrollIntoView({ behavior: 'smooth' });
      });
    `;
    const matches = matchJsRule(scrollTargetOnLoadMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts nested interactive event listeners inside DOMContentLoaded and load handlers', () => {
    const code = `
      document.addEventListener('DOMContentLoaded', () => {
        const backToTop = document.querySelector('#back-to-top');
        backToTop.addEventListener('click', () => {
          window.scrollTo(0, 0);
        });

        const navLinks = document.querySelectorAll('.nav-anchor');
        navLinks.forEach((anchor) => {
          anchor.addEventListener('click', (event) => {
            const target = document.querySelector(event.target.hash);
            target?.scrollIntoView();
          });
        });
      });

      window.addEventListener('load', () => {
        const jumpButton = document.getElementById('jump-btn');
        jumpButton.onclick = () => {
          window.scrollTo(0, 200);
        };
      });
    `;
    const matches = matchJsRule(scrollTargetOnLoadMatcher, 'nested-interactive.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags initial load scroll even when sibling nested event listeners are present', () => {
    const code = `
      document.addEventListener('DOMContentLoaded', () => {
        if (window.location.hash) {
          const initialTarget = document.querySelector(window.location.hash);
          initialTarget?.scrollIntoView();
        }

        const backToTop = document.querySelector('#back-to-top');
        backToTop.addEventListener('click', () => {
          window.scrollTo(0, 0);
        });
      });
    `;
    const matches = matchJsRule(scrollTargetOnLoadMatcher, 'mixed-handlers.js', code);
    assert.equal(matches.length, 1);
  });
});
