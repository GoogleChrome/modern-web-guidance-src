import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SCROLL_SNAP_REALTIME_FEEDBACK_GUIDE_HASH,
  scrollSnapRealtimeFeedbackMatcher,
  scrollSnapRealtimeFeedbackRule,
  scrollSnapRealtimeFeedbackRules,
} from './scroll-snap-realtime-feedback.ts';

void test('scroll-snap-realtime-feedback: rule metadata', () => {
  assert.equal(
    scrollSnapRealtimeFeedbackRule.id,
    'scroll-snap-realtime-feedback',
  );
  assert.equal(
    scrollSnapRealtimeFeedbackRule.guideId,
    'scroll-snap-realtime-feedback',
  );
  assert.equal(
    scrollSnapRealtimeFeedbackRule.guideHash,
    SCROLL_SNAP_REALTIME_FEEDBACK_GUIDE_HASH,
  );
  assert.equal(SCROLL_SNAP_REALTIME_FEEDBACK_GUIDE_HASH.length, 12);
  assert.equal(scrollSnapRealtimeFeedbackRules.length, 1);
  assert.ok(scrollSnapRealtimeFeedbackRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(scrollSnapRealtimeFeedbackRule.verifierRubric.dropWhen.length >= 2);
});

void test('scroll-snap-realtime-feedback JS matcher', async (t) => {
  await t.test('flags non-debounced scroll listeners computing Math.round(el.scrollLeft / width) or Math.round(el.scrollTop / height)', () => {
    const project = createInMemoryProject();
    const code = `
      const carousel = document.querySelector('.carousel');
      const dots = document.querySelectorAll('.dot');
      carousel.addEventListener('scroll', () => {
        const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
        dots.forEach((dotItem, indexNum) => dotItem.classList.toggle('active', indexNum === index));
      });
    `;
    const sourceFile = project.createSourceFile('carousel.js', code);
    const matches = scrollSnapRealtimeFeedbackMatcher.matchFile(sourceFile, {
      filePath: 'carousel.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by "onscrollsnapchanging" in window or when debounced with setTimeout', () => {
    const project = createInMemoryProject();
    const code = `
      const carousel = document.querySelector('.carousel');
      if (!('onscrollsnapchanging' in window)) {
        carousel.addEventListener('scroll', () => {
          const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
          updatePendingDot(index);
        });
      }

      let timer;
      carousel.addEventListener('scroll', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
          setActiveDot(index);
        }, 150);
      });

      window.addEventListener('scroll', () => {
        if (Math.abs(document.documentElement.scrollTop - lastScrollTop) > 20) {
          hideFloatingButton();
        }
      });
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = scrollSnapRealtimeFeedbackMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('flags non-debounced scroll listeners computing active slide via Math.abs offset distance minimization', () => {
    const project = createInMemoryProject();
    const code = `
      const slider = document.querySelector('.slider-container');
      const slides = slider.querySelectorAll('.slide');
      slider.addEventListener('scroll', () => {
        const currentScroll = slider.scrollLeft;
        let closestIndex = 0;
        let minDistance = Infinity;
        slides.forEach((slideItem, slideIndex) => {
          const distance = Math.abs(slideItem.offsetLeft - slider.scrollLeft);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = slideIndex;
          }
        });
        updateCarouselDots(closestIndex);
      });
    `;
    const sourceFile = project.createSourceFile('distance-snap.js', code);
    const matches = scrollSnapRealtimeFeedbackMatcher.matchFile(sourceFile, {
      filePath: 'distance-snap.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });
});
