import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  exportHtmlMediaFromCanvasJsMatcher,
  exportHtmlMediaFromCanvasPackageMatcher
} from './export-html-media-from-canvas.ts';
void test('export-html-media-from-canvas dependency matcher', async (t) => {
  await t.test('flags ccapture.js, gifshot, and whammy', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'ccapture.js': '^1.1.0',
          gifshot: '^0.4.5',
          whammy: '^0.0.1',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      exportHtmlMediaFromCanvasPackageMatcher,
    ]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          three: '^0.160.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      exportHtmlMediaFromCanvasPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('export-html-media-from-canvas JS matcher', async (t) => {
  await t.test('flags new CCapture, gifshot.createGIF, and new Whammy.Video', () => {
    const code = `
      import CCapture from 'ccapture.js';
      import gifshot from 'gifshot';

      const capturer = new CCapture({ format: 'webm', framerate: 60 });
      gifshot.createGIF({ images: frames }, (obj) => {});
      const encoder = new Whammy.Video(30);
    `;
    const matches = matchJsRule(exportHtmlMediaFromCanvasJsMatcher, 'recorder.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by MediaRecorder or captureStream check', () => {
    const code = `
      if (typeof MediaRecorder === 'undefined') {
        const encoder = new Whammy.Video(30);
      }
    `;
    const matches = matchJsRule(exportHtmlMediaFromCanvasJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts single screenshot canvas.toDataURL() and local shadowed CCapture', () => {
    const code = `
      const pngUrl = canvas.toDataURL('image/png');
      const { CCapture } = localMocks;
      new CCapture({ format: 'webm' });
    `;
    const matches = matchJsRule(exportHtmlMediaFromCanvasJsMatcher, 'screenshot.js', code);
    assert.equal(matches.length, 0);
  });
});
