import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { fluidScalingMatcher } from './fluid-scaling.ts';

void test('fluid-scaling CSS matcher', async (t) => {
  await t.test('flags typography/component selector stepping font-size across >= 3 @media breakpoints', () => {
    const css = `
      .card-title {
        font-size: 14px;
      }
      @media (min-width: 480px) {
        .card-title {
          font-size: 28px;
        }
      }
      @media (min-width: 768px) {
        .card-title {
          font-size: 56px;
        }
      }
      @media (min-width: 1024px) {
        .card-title {
          font-size: 84px;
        }
      }
    `;
    const matches = scanCss('card.css', css, [fluidScalingMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('does not flag clamp() with vw (the guide fallback), < 3 breakpoints, or layout rules', () => {
    const clampFallbackCss = `
      .component-title {
        font-size: clamp(1rem, 5vw, 2.5rem);
      }
    `;
    assert.equal(scanCss('fallback.css', clampFallbackCss, [fluidScalingMatcher]).length, 0);

    const twoBreakpointsCss = `
      @media (min-width: 768px) {
        .card-title { font-size: 1.5rem; }
      }
      @media (min-width: 1024px) {
        .card-title { font-size: 2rem; }
      }
    `;
    assert.equal(scanCss('two.css', twoBreakpointsCss, [fluidScalingMatcher]).length, 0);

    const layoutMediaCss = `
      @media (min-width: 480px) {
        .card-title { font-size: 1.25rem; display: flex; }
      }
      @media (min-width: 768px) {
        .card-title { font-size: 1.5rem; display: flex; }
      }
      @media (min-width: 1024px) {
        .card-title { font-size: 2rem; display: flex; }
      }
    `;
    assert.equal(scanCss('layout.css', layoutMediaCss, [fluidScalingMatcher]).length, 0);
  });
});
