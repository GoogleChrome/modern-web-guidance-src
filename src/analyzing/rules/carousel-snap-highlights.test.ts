import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import { carouselSnapHighlightsMatcher } from './carousel-snap-highlights.ts';

void test('carousel-snap-highlights JS matcher', async (t) => {
  await t.test('flags IntersectionObserver toggling active/is-snapped classes on carousel slides', () => {
    const code = `
      function initCarousel(carousel) {
        const slides = carousel.querySelectorAll('.slide');
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle('is-snapped', entry.isIntersecting);
          });
        }, { root: carousel, threshold: 0.6 });
        slides.forEach((s) => observer.observe(s));
      }
    `;
    const matches = matchJsRule(carouselSnapHighlightsMatcher, 'carousel.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags scroll listener comparing slide getBoundingClientRect() to toggle active class on carousel items', () => {
    const code = `
      const slider = document.querySelector('.carousel-track');
      const slides = slider.querySelectorAll('.carousel-slide');
      slider.addEventListener('scroll', () => {
        const center = slider.getBoundingClientRect().left + slider.clientWidth / 2;
        slides.forEach((slide) => {
          const rect = slide.getBoundingClientRect();
          const isCentered = rect.left <= center && rect.right >= center;
          slide.classList.toggle('active', isCentered);
        });
      });
    `;
    const matches = matchJsRule(carouselSnapHighlightsMatcher, 'slider.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts document scrollspy and one-shot reveal IntersectionObservers', () => {
    const code = `
      function initScrollspy() {
        const navbarLinks = document.querySelectorAll('.navbar a');
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              navbarLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + entry.target.id));
            }
          });
        });
      }

      function initCarouselReveal(carousel) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('fade-in');
              observer.unobserve(entry.target);
            }
          });
        });
      }
    `;
    const matches = matchJsRule(carouselSnapHighlightsMatcher, 'other-observers.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts Math.round(scrollLeft / clientWidth) owned by scroll-snap-state-sync', () => {
    const code = `
      const carousel = document.querySelector('.carousel');
      const dots = document.querySelectorAll('.dot');
      carousel.addEventListener('scrollend', () => {
        const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      });
    `;
    const matches = matchJsRule(carouselSnapHighlightsMatcher, 'snap-sync.js', code);
    assert.equal(matches.length, 0);
  });
});
