import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SCROLL_TARGET_ON_LOAD_GUIDE_HASH,
  scrollTargetOnLoadMatcher,
  scrollTargetOnLoadRule,
  scrollTargetOnLoadRules,
} from './scroll-target-on-load.ts';

void test('scroll-target-on-load: rule metadata', () => {
  assert.equal(scrollTargetOnLoadRule.id, 'scroll-target-on-load');
  assert.equal(scrollTargetOnLoadRule.guideId, 'scroll-target-on-load');
  assert.equal(
    scrollTargetOnLoadRule.guideHash,
    SCROLL_TARGET_ON_LOAD_GUIDE_HASH,
  );
  assert.equal(SCROLL_TARGET_ON_LOAD_GUIDE_HASH.length, 12);
  assert.equal(scrollTargetOnLoadRules.length, 1);
  assert.ok(scrollTargetOnLoadRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(scrollTargetOnLoadRule.phase2Rubric.dropWhen.length >= 2);
});

void test('scroll-target-on-load JS matcher', async (t) => {
  await t.test('flags DOMContentLoaded and load listeners reading location.hash and calling scrollIntoView or window.scrollTo', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('scroll-load.js', code);
    const matches = scrollTargetOnLoadMatcher.matchFile(sourceFile, {
      filePath: 'scroll-load.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports("scroll-initial-target", "nearest") or inside click listeners', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = scrollTargetOnLoadMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts nested interactive event listeners inside DOMContentLoaded and load handlers', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('nested-interactive.js', code);
    const matches = scrollTargetOnLoadMatcher.matchFile(sourceFile, {
      filePath: 'nested-interactive.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('flags initial load scroll even when sibling nested event listeners are present', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('mixed-handlers.js', code);
    const matches = scrollTargetOnLoadMatcher.matchFile(sourceFile, {
      filePath: 'mixed-handlers.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });
});
