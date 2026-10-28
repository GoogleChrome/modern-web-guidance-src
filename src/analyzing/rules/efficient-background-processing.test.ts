import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  efficientBackgroundProcessingMatcher,
} from './efficient-background-processing.ts';

void test('efficient-background-processing JS matcher', async (t) => {
  await t.test('flags IntersectionObserver callbacks pausing and resuming requestAnimationFrame or setInterval loops', () => {
    const code = `
      let rafId = null;
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            rafId = requestAnimationFrame(renderSimulation);
          } else {
            cancelAnimationFrame(rafId);
          }
        }
      });
    `;
    const matches = matchJsRule(
      efficientBackgroundProcessingMatcher,
      'canvas-loop.js',
      code,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /contentvisibilityautostatechange/);
  });

  await t.test('exempts files already using contentvisibilityautostatechange or classList scroll animations', () => {
    const modernCode = `
      component.addEventListener('contentvisibilityautostatechange', (event) => {
        if (event.skipped) {
          cancelAnimationFrame(rafId);
        } else {
          rafId = requestAnimationFrame(renderSimulation);
        }
      });
    `;
    assert.equal(
      matchJsRule(efficientBackgroundProcessingMatcher, 'modern.js', modernCode).length,
      0,
    );

    const revealCode = `
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        }
      });
    `;
    assert.equal(
      matchJsRule(efficientBackgroundProcessingMatcher, 'reveal.js', revealCode).length,
      0,
    );
  });
});
