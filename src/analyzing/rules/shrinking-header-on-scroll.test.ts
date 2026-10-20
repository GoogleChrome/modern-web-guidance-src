import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SHRINKING_HEADER_ON_SCROLL_GUIDE_HASH,
  shrinkingHeaderJsMatcher,
  shrinkingHeaderJsRule,
  shrinkingHeaderOnScrollRules,
  shrinkingHeaderPackageMatcher,
  shrinkingHeaderPackageRule,
} from './shrinking-header-on-scroll.ts';

void test('shrinking-header-on-scroll: rule metadata', () => {
  assert.equal(shrinkingHeaderPackageRule.id, 'shrinking-header-on-scroll/package-scroll-timeline');
  assert.equal(shrinkingHeaderPackageRule.guideId, 'shrinking-header-on-scroll');
  assert.equal(shrinkingHeaderPackageRule.guideHash, SHRINKING_HEADER_ON_SCROLL_GUIDE_HASH);
  assert.equal(SHRINKING_HEADER_ON_SCROLL_GUIDE_HASH.length, 12);

  assert.equal(shrinkingHeaderJsRule.id, 'shrinking-header-on-scroll/js-header-scroll');
  assert.equal(shrinkingHeaderJsRule.guideId, 'shrinking-header-on-scroll');
  assert.equal(shrinkingHeaderJsRule.guideHash, SHRINKING_HEADER_ON_SCROLL_GUIDE_HASH);

  assert.equal(shrinkingHeaderOnScrollRules.length, 2);
  assert.ok(shrinkingHeaderPackageRule.phase2Rubric.keepWhen.length > 0);
  assert.ok(shrinkingHeaderPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(shrinkingHeaderJsRule.phase2Rubric.keepWhen.length > 0);
  assert.ok(shrinkingHeaderJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('shrinking-header-on-scroll dependency matcher', async (t) => {
  await t.test('flags headroom.js and scroll-timeline-polyfill in dependencies', () => {
    const pkg = JSON.stringify({
      dependencies: {
        'headroom.js': '^0.12.0',
        'scroll-timeline-polyfill': '^1.0.0',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [shrinkingHeaderPackageMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags react-headroom and vue-headroom', () => {
    const pkg = JSON.stringify({
      dependencies: {
        'react-headroom': '^3.2.1',
        'vue-headroom': '^2.0.0',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [shrinkingHeaderPackageMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify({
      dependencies: {
        express: '^4.18.2',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [shrinkingHeaderPackageMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('shrinking-header-on-scroll JS matcher', async (t) => {
  await t.test('flags new Headroom instance', () => {
    const project = createInMemoryProject();
    const code = `
      const headerElem = document.querySelector('header');
      const headroom = new Headroom(headerElem);
      headroom.init();
    `;
    const sourceFile = project.createSourceFile('headroom-init.js', code);
    const matches = shrinkingHeaderJsMatcher.matchFile(sourceFile, {
      filePath: 'headroom-init.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Headroom/);
  });

  await t.test('flags window scroll listener toggling header-scrolled class', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('scroll', () => {
        const header = document.querySelector('.navbar');
        if (window.scrollY > 100) {
          header.classList.add('header-scrolled');
        } else {
          header.classList.remove('header-scrolled');
        }
      });
    `;
    const sourceFile = project.createSourceFile('scroll-header.js', code);
    const matches = shrinkingHeaderJsMatcher.matchFile(sourceFile, {
      filePath: 'scroll-header.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('flags scroll listener updating header style.height directly', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const newHeight = 200 - Math.min(150, scrollY);
        header.style.height = newHeight + 'px';
      });
    `;
    const sourceFile = project.createSourceFile('resize-header.js', code);
    const matches = shrinkingHeaderJsMatcher.matchFile(sourceFile, {
      filePath: 'resize-header.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by CSS.supports for animation-timeline', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('(animation-timeline: scroll()) and (animation-range: 0% 100%)')) {
        window.addEventListener('scroll', () => {
          const header = document.querySelector('header');
          header.style.height = (200 - window.scrollY) + 'px';
        });
      }
    `;
    const sourceFile = project.createSourceFile('guarded-header.js', code);
    const matches = shrinkingHeaderJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded-header.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts scroll listener that does not target header/nav', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
          backToTopBtn.classList.add('visible');
        }
      });
    `;
    const sourceFile = project.createSourceFile('back-to-top.js', code);
    const matches = shrinkingHeaderJsMatcher.matchFile(sourceFile, {
      filePath: 'back-to-top.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
