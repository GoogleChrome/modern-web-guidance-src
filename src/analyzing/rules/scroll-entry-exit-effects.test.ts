import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  scrollEntryExitEffectsJsMatcher,
  scrollEntryExitEffectsPackageMatcher
} from './scroll-entry-exit-effects.ts';
void test('scroll-entry-exit-effects dependency matcher', async (t) => {
  await t.test('flags aos, scrollreveal, sal.js, and wowjs', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          aos: '^2.3.4',
          scrollreveal: '^4.0.9',
          'sal.js': '^0.8.5',
          wowjs: '^1.1.3',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      scrollEntryExitEffectsPackageMatcher,
    ]);
    assert.equal(matches.length, 4);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          react: '^18.2.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      scrollEntryExitEffectsPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('scroll-entry-exit-effects JS matcher', async (t) => {
  await t.test('flags AOS.init, ScrollReveal().reveal, and new WOW().init', () => {
    const code = `
      AOS.init({ duration: 800 });
      ScrollReveal().reveal('.card', { delay: 200 });
      const sr = ScrollReveal({ distance: '40px' });
      sr.reveal('.hero-tile');
      new WOW().init();
    `;
    const matches = matchJsRule(scrollEntryExitEffectsJsMatcher, 'reveal.js', code);
    assert.equal(matches.length, 4);
  });

  await t.test('flags imported AOS, ScrollReveal, and WOW', () => {
    const code = `
      import AOS from 'aos';
      import ScrollReveal from 'scrollreveal';
      import { WOW } from 'wowjs';
      AOS.init();
      ScrollReveal().reveal('.item');
      new WOW().init();
    `;
    const matches = matchJsRule(scrollEntryExitEffectsJsMatcher, 'imported-reveal.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports("animation-timeline", "view()")', () => {
    const code = `
      if (!CSS.supports('animation-timeline', 'view()')) {
        AOS.init();
        ScrollReveal().reveal('.card');
        new WOW().init();
      }
    `;
    const matches = matchJsRule(scrollEntryExitEffectsJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated init() or reveal() calls', () => {
    const code = `
      app.init();
      secretPanel.reveal();
    `;
    const matches = matchJsRule(scrollEntryExitEffectsJsMatcher, 'unrelated.js', code);
    assert.equal(matches.length, 0);
  });
});
