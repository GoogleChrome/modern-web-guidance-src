import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  STATE_AWARE_STICKY_HEADERS_GUIDE_HASH,
  stateAwareStickyHeadersMatcher,
  stateAwareStickyHeadersRule,
  stateAwareStickyHeadersRules,
} from './state-aware-sticky-headers.ts';

void test('state-aware-sticky-headers: rule metadata', () => {
  assert.equal(stateAwareStickyHeadersRule.id, 'state-aware-sticky-headers');
  assert.equal(
    stateAwareStickyHeadersRule.guideId,
    'state-aware-sticky-headers',
  );
  assert.equal(
    stateAwareStickyHeadersRule.guideHash,
    STATE_AWARE_STICKY_HEADERS_GUIDE_HASH,
  );
  assert.equal(STATE_AWARE_STICKY_HEADERS_GUIDE_HASH.length, 12);
  assert.equal(stateAwareStickyHeadersRules.length, 1);
  assert.ok(stateAwareStickyHeadersRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(stateAwareStickyHeadersRule.verifierRubric.dropWhen.length >= 2);
});

void test('state-aware-sticky-headers JS matcher', async (t) => {
  await t.test('flags IntersectionObserver with threshold: [1] / intersectionRatio < 1 toggling .is-stuck', () => {
    const project = createInMemoryProject();
    const code = `
      const header = document.querySelector('.sticky-header');
      const observer = new IntersectionObserver(
        ([e]) => {
          e.target.classList.toggle('is-stuck', e.intersectionRatio < 1);
        },
        { threshold: [1] }
      );
      observer.observe(header);
    `;
    const sourceFile = project.createSourceFile('sticky.js', code);
    const matches = stateAwareStickyHeadersMatcher.matchFile(sourceFile, {
      filePath: 'sticky.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('flags scroll listener toggling .is-pinned / .sticky-active on sticky header', () => {
    const project = createInMemoryProject();
    const code = `
      const stickyHeader = document.querySelector('header.sticky');
      window.addEventListener('scroll', () => {
        if (stickyHeader.getBoundingClientRect().top <= 0) {
          stickyHeader.classList.add('is-pinned');
        } else {
          stickyHeader.classList.remove('is-pinned');
        }
      });
    `;
    const sourceFile = project.createSourceFile('scroll-sticky.js', code);
    const matches = stateAwareStickyHeadersMatcher.matchFile(sourceFile, {
      filePath: 'scroll-sticky.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by CSS.supports("container-type", "scroll-state")', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('container-type', 'scroll-state')) {
        const observer = new IntersectionObserver(
          ([e]) => {
            e.target.classList.toggle('is-stuck', e.intersectionRatio < 1);
          },
          { threshold: [1] }
        );
        observer.observe(document.querySelector('.sticky-header'));
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = stateAwareStickyHeadersMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts directional hide-on-scroll-down / show-on-scroll-up headers', () => {
    const project = createInMemoryProject();
    const code = `
      let lastScroll = 0;
      const header = document.querySelector('header');
      window.addEventListener('scroll', () => {
        const current = window.scrollY;
        header.classList.toggle('header-hidden', current > lastScroll);
        lastScroll = current;
      });
    `;
    const sourceFile = project.createSourceFile('headroom.js', code);
    const matches = stateAwareStickyHeadersMatcher.matchFile(sourceFile, {
      filePath: 'headroom.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts arbitrary positive pixel scroll thresholds like scrollY > 100 or scrollTop > 200', () => {
    const project = createInMemoryProject();
    const code = `
      const header = document.querySelector('header.sticky');
      window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
          header.classList.add('is-sticky');
        } else {
          header.classList.remove('is-sticky');
        }
      });
      container.addEventListener('scroll', () => {
        header.classList.toggle('stuck', container.scrollTop > 200);
      });
    `;
    const sourceFile = project.createSourceFile('pixel-threshold.js', code);
    const matches = stateAwareStickyHeadersMatcher.matchFile(sourceFile, {
      filePath: 'pixel-threshold.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('flags IntersectionObserver with isIntersecting === false and getBoundingClientRect().y <= 0 docking checks', () => {
    const project = createInMemoryProject();
    const code = `
      const sentinel = document.querySelector('.sentinel');
      const header = document.querySelector('.site-header');
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting === false) {
          header.classList.add('header-stuck');
        } else {
          header.classList.remove('header-stuck');
        }
      });
      observer.observe(sentinel);

      window.addEventListener('scroll', () => {
        const rect = header.getBoundingClientRect();
        header.classList.toggle('is-pinned', rect.y <= 0);
      });
    `;
    const sourceFile = project.createSourceFile('sentinel-y.js', code);
    const matches = stateAwareStickyHeadersMatcher.matchFile(sourceFile, {
      filePath: 'sentinel-y.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });
});
