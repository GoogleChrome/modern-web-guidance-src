import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  physicsBasedEasingJsMatcher
} from './physics-based-easing.ts';
void test('physics-based-easing JS matcher', async (t) => {
  await t.test('flags popmotion and react-motion spring({ stiffness, damping }) calls', () => {
    const code = `
      import { spring } from 'popmotion';
      import { spring as motionSpring } from 'react-motion';

      const anim = spring({ from: 0, to: 100, stiffness: 200, damping: 15 });
      const style = { x: motionSpring(10, { stiffness: 120, damping: 17 }) };
      window.popmotion.spring({ stiffness: 300, damping: 20 });
    `;
    const matches = matchJsRule(physicsBasedEasingJsMatcher, 'spring.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports linear() check', () => {
    const code = `
      import { spring } from 'popmotion';
      const supportsLinearEasing = window.CSS && CSS.supports('animation-timing-function', 'linear(0, 1)');
      if (!supportsLinearEasing) {
        spring({ stiffness: 100, damping: 10 });
      }
    `;
    const matches = matchJsRule(physicsBasedEasingJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated functions named spring without physics config or local spring functions', () => {
    const code = `
      spring('season');
      calendar.spring({ month: 'April' });
      function localSim() {
        function spring(opts) { return opts; }
        spring({ stiffness: 100, damping: 10 });
      }
      const { spring: customSpring } = customEngine;
      customSpring({ stiffness: 100, damping: 10 });
    `;
    const matches = matchJsRule(physicsBasedEasingJsMatcher, 'season.js', code);
    assert.equal(matches.length, 0);
  });
});
