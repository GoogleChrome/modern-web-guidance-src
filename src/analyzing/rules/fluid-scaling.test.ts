import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { fluidScalingMatcher } from './fluid-scaling.ts';

void test('fluid-scaling CSS matcher', async (t) => {
  await t.test('flags component selector (.card, .widget, .panel) using vw inside clamp() or calc() for font-size/padding/gap', () => {
    const css = `
      .card-title {
        font-size: clamp(1rem, 0.75rem + 2vw, 1.75rem);
      }
      .card-body {
        padding: clamp(0.75rem, 0.5rem + 1.5vw, 1.5rem);
      }
    `;
    const matches = scanCss('card.css', css, [fluidScalingMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts page-level typography, full-bleed 100vw math, and stylesheets already using cqi/container-type', () => {
    const pageLevelCss = `
      body {
        font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
      }
      .hero-title {
        font-size: clamp(2rem, 1rem + 4vw, 4.5rem);
      }
      .card-bleed {
        padding-left: calc(100vw - 100%);
      }
    `;
    assert.equal(scanCss('layout.css', pageLevelCss, [fluidScalingMatcher]).length, 0);

    const modernCss = `
      .card-wrapper {
        container-type: inline-size;
      }
      .card-title {
        font-size: clamp(1rem, 0.75rem + 3cqi, 1.75rem);
      }
    `;
    assert.equal(scanCss('modern.css', modernCss, [fluidScalingMatcher]).length, 0);
  });
});
