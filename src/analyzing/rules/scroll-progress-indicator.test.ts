import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SCROLL_PROGRESS_INDICATOR_GUIDE_HASH,
  scrollProgressIndicatorMatcher,
  scrollProgressIndicatorRule,
  scrollProgressIndicatorRules,
} from './scroll-progress-indicator.ts';

void test('scroll-progress-indicator: rule metadata', () => {
  assert.equal(scrollProgressIndicatorRule.id, 'scroll-progress-indicator');
  assert.equal(
    scrollProgressIndicatorRule.guideId,
    'scroll-progress-indicator',
  );
  assert.equal(
    scrollProgressIndicatorRule.guideHash,
    SCROLL_PROGRESS_INDICATOR_GUIDE_HASH,
  );
  assert.equal(SCROLL_PROGRESS_INDICATOR_GUIDE_HASH.length, 12);
  assert.equal(scrollProgressIndicatorRules.length, 1);
  assert.ok(scrollProgressIndicatorRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(scrollProgressIndicatorRule.verifierRubric.dropWhen.length >= 2);
});

void test('scroll-progress-indicator JS matcher', async (t) => {
  await t.test('flags scroll listeners updating progress bar style.width, scaleX(), or --scroll-progress', () => {
    const project = createInMemoryProject();
    const code = `
      const progressBar = document.querySelector('#progress');
      window.addEventListener('scroll', () => {
        const el = document.documentElement;
        const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
        progressBar.style.width = pct + '%';
      });

      window.addEventListener('scroll', () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = window.scrollY / scrollable;
        progressBar.style.transform = \`scaleX(\${ratio})\`;
      });

      window.addEventListener('scroll', () => {
        const ratio = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        document.documentElement.style.setProperty('--scroll-progress', String(ratio));
      });
    `;
    const sourceFile = project.createSourceFile('progress.js', code);
    const matches = scrollProgressIndicatorMatcher.matchFile(sourceFile, {
      filePath: 'progress.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports("animation-timeline", "scroll()")', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('animation-timeline', 'scroll()')) {
        const progress = document.querySelector('#progress');
        window.addEventListener('scroll', () => {
          const scrollable = document.documentElement.scrollHeight - window.innerHeight;
          const progressPercentage = window.scrollY / scrollable;
          progress.style.transform = \`scaleX(\${progressPercentage})\`;
        });
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = scrollProgressIndicatorMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('flags progress bar updates using scale3d transform', () => {
    const project = createInMemoryProject();
    const code = `
      const indicator = document.querySelector('.reading-progress');
      window.addEventListener('scroll', () => {
        const docHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const scrolled = window.pageYOffset;
        const ratio = scrolled / (docHeight - viewHeight);
        indicator.style.transform = \`scale3d(\${ratio}, 1, 1)\`;
      });
    `;
    const sourceFile = project.createSourceFile('scale3d.js', code);
    const matches = scrollProgressIndicatorMatcher.matchFile(sourceFile, {
      filePath: 'scale3d.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });
});
