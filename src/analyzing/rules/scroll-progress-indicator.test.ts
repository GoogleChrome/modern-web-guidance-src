import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  scrollProgressIndicatorMatcher
} from './scroll-progress-indicator.ts';
void test('scroll-progress-indicator JS matcher', async (t) => {
  await t.test('flags scroll listeners updating progress bar style.width, scaleX(), or --scroll-progress', () => {
    const code = `
      const progressBar = document.querySelector('#progress');
      window.addEventListener('scroll', () => {
        const el = document.documentElement;
        const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
        progressBar.style.width = pct + '%';
      });

      window.addEventListener('scroll', () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = window.scrollY / scrollable;
        progressBar.style.transform = \`scaleX(\${ratio})\`;
      });

      window.addEventListener('scroll', () => {
        const ratio = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        document.documentElement.style.setProperty('--scroll-progress', String(ratio));
      });
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'progress.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports("animation-timeline", "scroll()")', () => {
    const code = `
      if (!CSS.supports('animation-timeline', 'scroll()')) {
        const progress = document.querySelector('#progress');
        window.addEventListener('scroll', () => {
          const scrollable = document.documentElement.scrollHeight - window.innerHeight;
          const progressPercentage = window.scrollY / scrollable;
          progress.style.transform = \`scaleX(\${progressPercentage})\`;
        });
      }
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags progress bar updates using scale3d transform', () => {
    const code = `
      const indicator = document.querySelector('.reading-progress');
      window.addEventListener('scroll', () => {
        const docHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const scrolled = window.pageYOffset;
        const ratio = scrolled / (docHeight - viewHeight);
        indicator.style.transform = \`scale3d(\${ratio}, 1, 1)\`;
      });
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'scale3d.js', code);
    assert.equal(matches.length, 1);
  });
});
