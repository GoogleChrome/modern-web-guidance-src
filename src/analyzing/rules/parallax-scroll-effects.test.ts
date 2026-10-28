import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import { parallaxScrollEffectsMatcher } from './parallax-scroll-effects.ts';

void test('parallax-scroll-effects JS matcher', async (t) => {
  await t.test('flags window scroll listener applying vertical translateY / translate3d with a speed factor', () => {
    const code = `
      const heroBg = document.querySelector('.parallax-bg');
      window.addEventListener('scroll', () => {
        const offset = window.scrollY * 0.4;
        heroBg.style.transform = \`translate3d(0, \${offset}px, 0)\`;
      });
    `;
    const matches = matchJsRule(parallaxScrollEffectsMatcher, 'parallax.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags scroll listener delegating vertical parallax math to requestAnimationFrame', () => {
    const code = `
      const layers = document.querySelectorAll('[data-speed]');
      function updateParallax() {
        const top = window.pageYOffset;
        layers.forEach((layer) => {
          const speed = Number(layer.dataset.speed);
          layer.style.transform = \`translateY(\${top * speed}px)\`;
        });
      }
      window.addEventListener('scroll', () => {
        requestAnimationFrame(updateParallax);
      });
    `;
    const matches = matchJsRule(parallaxScrollEffectsMatcher, 'raf-parallax.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts scroll progress bars reading scrollHeight and sticky header class toggles', () => {
    const code = `
      const progressBar = document.querySelector('.reading-progress');
      window.addEventListener('scroll', () => {
        const progress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
        progressBar.style.transform = \`scaleX(\${progress})\`;
      });

      const header = document.querySelector('header');
      window.addEventListener('scroll', () => {
        header.classList.toggle('is-stuck', window.scrollY > 40);
      });
    `;
    const matches = matchJsRule(parallaxScrollEffectsMatcher, 'non-parallax.js', code);
    assert.equal(matches.length, 0);
  });
});
