import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  scrollytellingJsMatcher,
  scrollytellingPackageMatcher,
} from './scrollytelling.ts';

void test('scrollytelling: positive brownfield matches', async (t) => {
  await t.test('flags scrollama and scrollmagic in package.json', () => {
    const pkgJson = JSON.stringify({
      dependencies: {
        scrollama: '^3.2.0',
        scrollmagic: '^2.0.8',
      },
    });
    const matches = scanPackageJson('package.json', pkgJson, [
      scrollytellingPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags scrollama() initialization', () => {
    const code = `
      import scrollama from 'scrollama';
      const scroller = scrollama();
      scroller.setup({ step: '.step', progress: true });
    `;
    const matches = matchJsRule(scrollytellingJsMatcher, 'story.ts', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Scroll-Driven Animations/);
  });

  await t.test('flags new ScrollMagic.Scene()', () => {
    const code = `
      import ScrollMagic from 'scrollmagic';
      const scene = new ScrollMagic.Scene({ triggerElement: '#step1', duration: 300 });
    `;
    const matches = matchJsRule(scrollytellingJsMatcher, 'magic.ts', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags multi-threshold IntersectionObserver interpolating style.transform via intersectionRatio', () => {
    const code = `
      const animatedSections = document.querySelectorAll('#animated section');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const ratio = entry.intersectionRatio;
          animatedSections[0].style.opacity = String(ratio);
          animatedSections[0].style.transform = \`scale(\${0.5 + ratio * 0.5})\`;
        });
      }, { threshold: Array.from({ length: 101 }, (_, i) => i / 100) });
    `;
    const matches = matchJsRule(scrollytellingJsMatcher, 'observer-story.ts', code);
    assert.equal(matches.length, 1);
  });
});

void test('scrollytelling: negative / exempt cases', async (t) => {
  await t.test('exempts single-threshold IntersectionObserver toggling a class (scroll-entry-exit-effects)', () => {
    const code = `
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      }, { threshold: 0.2 });
    `;
    const matches = matchJsRule(scrollytellingJsMatcher, 'reveal.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts files already using view-timeline or animation-timeline', () => {
    const code = `
      import scrollama from 'scrollama';
      if (!CSS.supports('animation-timeline: scroll()')) {
        scrollama();
      }
    `;
    const matches = matchJsRule(scrollytellingJsMatcher, 'fallback.ts', code);
    assert.equal(matches.length, 0);
  });
});
