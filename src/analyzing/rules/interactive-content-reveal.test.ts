import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import { interactiveContentRevealJsMatcher } from './interactive-content-reveal.ts';

void test('interactive-content-reveal: positive brownfield matches', async (t) => {
  await t.test('flags pointermove handler assigning radial-gradient to style.maskImage', () => {
    const code = `
      container.addEventListener('pointermove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        overlay.style.maskImage = \`radial-gradient(circle 120px at \${x}px \${y}px, black 0%, transparent 100%)\`;
      });
    `;
    const matches = matchJsRule(interactiveContentRevealJsMatcher, 'spotlight.ts', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /@property/);
  });

  await t.test('flags mousemove handler calling style.setProperty("-webkit-mask-image", "radial-gradient(...)")', () => {
    const code = `
      card.addEventListener('mousemove', (e) => {
        card.style.setProperty('-webkit-mask-image', \`radial-gradient(circle at \${e.offsetX}px \${e.offsetY}px, #000, transparent)\`);
      });
    `;
    const matches = matchJsRule(interactiveContentRevealJsMatcher, 'reveal.ts', code);
    assert.equal(matches.length, 1);
  });
});

void test('interactive-content-reveal: negative / exempt cases', async (t) => {
  await t.test('exempts modern pointermove handler that only updates --mouse-x and --mouse-y', () => {
    const code = `
      container.addEventListener('pointermove', (e) => {
        container.style.setProperty('--mouse-x', \`\${e.clientX}px\`);
        container.style.setProperty('--mouse-y', \`\${e.clientY}px\`);
      });
    `;
    const matches = matchJsRule(interactiveContentRevealJsMatcher, 'modern-reveal.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts static maskImage assignment without pointermove/mousemove listener', () => {
    const code = `
      overlay.style.maskImage = 'radial-gradient(circle, black 50%, transparent 100%)';
    `;
    const matches = matchJsRule(interactiveContentRevealJsMatcher, 'static-mask.ts', code);
    assert.equal(matches.length, 0);
  });
});
