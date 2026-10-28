import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import { carouselSlideEffectsMatcher } from './carousel-slide-effects.ts';

void test('carousel-slide-effects JS matcher', async (t) => {
  await t.test('flags carousel scroll listener computing per-slide scale and opacity from getBoundingClientRect()', () => {
    const code = `
      const carousel = document.querySelector('.carousel');
      const slides = carousel.querySelectorAll('.slide');
      carousel.addEventListener('scroll', () => {
        const viewportCenter = carousel.getBoundingClientRect().left + carousel.clientWidth / 2;
        slides.forEach((slide) => {
          const rect = slide.getBoundingClientRect();
          const slideCenter = rect.left + rect.width / 2;
          const dist = Math.min(1, Math.abs(viewportCenter - slideCenter) / (carousel.clientWidth / 2));
          slide.style.transform = \`scale(\${1 - dist * 0.2})\`;
          slide.style.opacity = String(1 - dist * 0.5);
        });
      });
    `;
    const matches = matchJsRule(carouselSlideEffectsMatcher, 'coverflow.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts discrete class toggles on carousel slides and files already using view(inline)', () => {
    const discreteCode = `
      const carousel = document.querySelector('.carousel');
      const slides = carousel.querySelectorAll('.slide');
      carousel.addEventListener('scroll', () => {
        slides.forEach((slide) => {
          const rect = slide.getBoundingClientRect();
          slide.classList.toggle('active', rect.left >= 0);
        });
      });
    `;
    assert.equal(matchJsRule(carouselSlideEffectsMatcher, 'discrete.js', discreteCode).length, 0);

    const modernCode = `
      // Uses animation-timeline: view(inline) in CSS
      const carousel = document.querySelector('.carousel');
    `;
    assert.equal(matchJsRule(carouselSlideEffectsMatcher, 'modern.js', modernCode).length, 0);
  });
});
