import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import lazyLoadVideoAndAudioRules, {
  lazyLoadVideoAndAudioJsMatcher,
  lazyLoadVideoAndAudioJsRule,
  lazyLoadVideoAndAudioPackageMatcher,
  lazyLoadVideoAndAudioPackageRule,
} from './lazy-load-video-and-audio.ts';

void test('lazy-load-video-and-audio: default rules export', () => {
  assert.deepEqual(lazyLoadVideoAndAudioRules, [
    lazyLoadVideoAndAudioJsRule,
    lazyLoadVideoAndAudioPackageRule,
  ]);
});

void test('lazy-load-video-and-audio dependency matcher', async (t) => {
  await t.test('flags vanilla-lazyload and lozad', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'vanilla-lazyload': '^17.8.4',
          lozad: '^1.16.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      lazyLoadVideoAndAudioPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'hls.js': '^1.4.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      lazyLoadVideoAndAudioPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('lazy-load-video-and-audio JS matcher', async (t) => {
  await t.test('flags IntersectionObserver swapping data-src onto <video> / <source> and calling load()', () => {
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
    const matches = matchJsRule(lazyLoadVideoAndAudioJsMatcher, 'lazy-video.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts IntersectionObserver guarded by HTMLMediaElement.prototype.loading check', () => {
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
    const matches = matchJsRule(lazyLoadVideoAndAudioJsMatcher, 'guarded-video.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts image-only IntersectionObserver lazy loaders', () => {
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
    const matches = matchJsRule(lazyLoadVideoAndAudioJsMatcher, 'lazy-img.js', code);
    assert.equal(matches.length, 0);
  });
});
