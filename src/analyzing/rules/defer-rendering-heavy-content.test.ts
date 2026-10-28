import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  deferRenderingHeavyContentMatcher,
} from './defer-rendering-heavy-content.ts';

void test('defer-rendering-heavy-content JS matcher', async (t) => {
  await t.test('flags IntersectionObserver callbacks mounting static off-screen template/DOM content', () => {
    const code = `
      const observer = new IntersectionObserver((entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const tpl = entry.target.querySelector('template');
            entry.target.appendChild(tpl.content.cloneNode(true));
            obs.unobserve(entry.target);
          }
        }
      });
    `;
    const matches = matchJsRule(
      deferRenderingHeavyContentMatcher,
      'deferred-sections.js',
      code,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /content-visibility: auto/);
  });

  await t.test('exempts network fetch pagination, media/image src lazy loading, and scroll-reveal class toggles', () => {
    const code = `
      const imgObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.src = entry.target.dataset.src;
          }
        }
      });

      const revealObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        }
      });
    `;
    const matches = matchJsRule(deferRenderingHeavyContentMatcher, 'other-io.js', code);
    assert.equal(matches.length, 0);
  });
});
