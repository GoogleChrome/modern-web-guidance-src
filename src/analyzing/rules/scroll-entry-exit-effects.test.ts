import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SCROLL_ENTRY_EXIT_EFFECTS_GUIDE_HASH,
  scrollEntryExitEffectsJsMatcher,
  scrollEntryExitEffectsJsRule,
  scrollEntryExitEffectsPackageMatcher,
  scrollEntryExitEffectsPackageRule,
  scrollEntryExitEffectsRules,
} from './scroll-entry-exit-effects.ts';

void test('scroll-entry-exit-effects: rule metadata', () => {
  assert.equal(
    scrollEntryExitEffectsPackageRule.id,
    'scroll-entry-exit-effects/package-scroll-reveal',
  );
  assert.equal(
    scrollEntryExitEffectsPackageRule.guideId,
    'scroll-entry-exit-effects',
  );
  assert.equal(
    scrollEntryExitEffectsPackageRule.guideHash,
    SCROLL_ENTRY_EXIT_EFFECTS_GUIDE_HASH,
  );
  assert.equal(SCROLL_ENTRY_EXIT_EFFECTS_GUIDE_HASH.length, 12);

  assert.equal(
    scrollEntryExitEffectsJsRule.id,
    'scroll-entry-exit-effects/js-scroll-reveal',
  );
  assert.equal(
    scrollEntryExitEffectsJsRule.guideId,
    'scroll-entry-exit-effects',
  );
  assert.equal(
    scrollEntryExitEffectsJsRule.guideHash,
    SCROLL_ENTRY_EXIT_EFFECTS_GUIDE_HASH,
  );

  assert.equal(scrollEntryExitEffectsRules.length, 2);
  assert.ok(scrollEntryExitEffectsPackageRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(scrollEntryExitEffectsPackageRule.verifierRubric.dropWhen.length >= 2);
  assert.ok(scrollEntryExitEffectsJsRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(scrollEntryExitEffectsJsRule.verifierRubric.dropWhen.length >= 2);
});

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
    const project = createInMemoryProject();
    const code = `
      AOS.init({ duration: 800 });
      ScrollReveal().reveal('.card', { delay: 200 });
      const sr = ScrollReveal({ distance: '40px' });
      sr.reveal('.hero-tile');
      new WOW().init();
    `;
    const sourceFile = project.createSourceFile('reveal.js', code);
    const matches = scrollEntryExitEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'reveal.js',
      fileContent: code,
    });
    assert.equal(matches.length, 4);
  });

  await t.test('flags imported AOS, ScrollReveal, and WOW', () => {
    const project = createInMemoryProject();
    const code = `
      import AOS from 'aos';
      import ScrollReveal from 'scrollreveal';
      import { WOW } from 'wowjs';
      AOS.init();
      ScrollReveal().reveal('.item');
      new WOW().init();
    `;
    const sourceFile = project.createSourceFile('imported-reveal.js', code);
    const matches = scrollEntryExitEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'imported-reveal.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports("animation-timeline", "view()")', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('animation-timeline', 'view()')) {
        AOS.init();
        ScrollReveal().reveal('.card');
        new WOW().init();
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = scrollEntryExitEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated init() or reveal() calls', () => {
    const project = createInMemoryProject();
    const code = `
      app.init();
      secretPanel.reveal();
    `;
    const sourceFile = project.createSourceFile('unrelated.js', code);
    const matches = scrollEntryExitEffectsJsMatcher.matchFile(sourceFile, {
      filePath: 'unrelated.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
