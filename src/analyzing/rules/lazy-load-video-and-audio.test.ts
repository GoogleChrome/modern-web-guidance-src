import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  LAZY_LOAD_VIDEO_AND_AUDIO_GUIDE_HASH,
  lazyLoadVideoAndAudioJsMatcher,
  lazyLoadVideoAndAudioJsRule,
  lazyLoadVideoAndAudioRules,
} from './lazy-load-video-and-audio.ts';

void test('lazy-load-video-and-audio: rule metadata', () => {
  assert.equal(LAZY_LOAD_VIDEO_AND_AUDIO_GUIDE_HASH.length, 12);

  assert.equal(
    lazyLoadVideoAndAudioJsRule.id,
    'lazy-load-video-and-audio/js-media-observer',
  );
  assert.equal(
    lazyLoadVideoAndAudioJsRule.guideId,
    'lazy-load-video-and-audio',
  );
  assert.equal(
    lazyLoadVideoAndAudioJsRule.guideHash,
    LAZY_LOAD_VIDEO_AND_AUDIO_GUIDE_HASH,
  );

  assert.equal(lazyLoadVideoAndAudioRules.length, 1);
  assert.ok(lazyLoadVideoAndAudioJsRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(lazyLoadVideoAndAudioJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('lazy-load-video-and-audio JS matcher', async (t) => {
  await t.test('flags IntersectionObserver swapping data-src onto <video> / <source> and calling load()', () => {
    const project = createInMemoryProject();
    const code = `
      const lazyVideos = document.querySelectorAll('video.lazy');
      const videoObserver = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            for (const source of entry.target.querySelectorAll('source[data-src]')) {
              source.src = source.dataset.src;
            }
            entry.target.load();
            observer.unobserve(entry.target);
          }
        }
      });
      lazyVideos.forEach((v) => videoObserver.observe(v));
    `;
    const sourceFile = project.createSourceFile('lazy-video.js', code);
    const matches = lazyLoadVideoAndAudioJsMatcher.matchFile(sourceFile, {
      filePath: 'lazy-video.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('exempts IntersectionObserver guarded by HTMLMediaElement.prototype.loading check', () => {
    const project = createInMemoryProject();
    const code = `
      const supportsLazyMedia = Object.hasOwn(HTMLMediaElement.prototype, 'loading');
      if (!supportsLazyMedia) {
        const mediaObserver = new IntersectionObserver((entries, observer) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const media = entry.target;
            if (media.dataset.src) {
              media.src = media.dataset.src;
            }
            media.load();
            observer.unobserve(media);
          }
        });
      }
    `;
    const sourceFile = project.createSourceFile('guarded-video.js', code);
    const matches = lazyLoadVideoAndAudioJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded-video.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts image-only IntersectionObserver lazy loaders', () => {
    const project = createInMemoryProject();
    const code = `
      const images = document.querySelectorAll('img[data-src]');
      const imgObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.src = entry.target.dataset.src;
          }
        });
      });
    `;
    const sourceFile = project.createSourceFile('lazy-img.js', code);
    const matches = lazyLoadVideoAndAudioJsMatcher.matchFile(sourceFile, {
      filePath: 'lazy-img.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
