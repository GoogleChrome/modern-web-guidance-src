import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH,
  exportHtmlMediaFromCanvasJsMatcher,
  exportHtmlMediaFromCanvasJsRule,
  exportHtmlMediaFromCanvasPackageMatcher,
  exportHtmlMediaFromCanvasPackageRule,
  exportHtmlMediaFromCanvasRules,
} from './export-html-media-from-canvas.ts';

void test('export-html-media-from-canvas: rule metadata', () => {
  assert.equal(
    exportHtmlMediaFromCanvasPackageRule.id,
    'export-html-media-from-canvas/package-canvas-recorder',
  );
  assert.equal(
    exportHtmlMediaFromCanvasPackageRule.guideId,
    'export-html-media-from-canvas',
  );
  assert.equal(
    exportHtmlMediaFromCanvasPackageRule.guideHash,
    EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH,
  );
  assert.equal(EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH.length, 12);

  assert.equal(
    exportHtmlMediaFromCanvasJsRule.id,
    'export-html-media-from-canvas/js-canvas-recorder',
  );
  assert.equal(
    exportHtmlMediaFromCanvasJsRule.guideId,
    'export-html-media-from-canvas',
  );
  assert.equal(
    exportHtmlMediaFromCanvasJsRule.guideHash,
    EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH,
  );

  assert.equal(exportHtmlMediaFromCanvasRules.length, 2);
  assert.ok(exportHtmlMediaFromCanvasPackageRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(exportHtmlMediaFromCanvasPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(exportHtmlMediaFromCanvasJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(exportHtmlMediaFromCanvasJsRule.phase2Rubric.dropWhen.length >= 2);
});

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
    const project = createInMemoryProject();
    const code = `
      import CCapture from 'ccapture.js';
      import gifshot from 'gifshot';

      const capturer = new CCapture({ format: 'webm', framerate: 60 });
      gifshot.createGIF({ images: frames }, (obj) => {});
      const encoder = new Whammy.Video(30);
    `;
    const sourceFile = project.createSourceFile('recorder.js', code);
    const matches = exportHtmlMediaFromCanvasJsMatcher.matchFile(sourceFile, {
      filePath: 'recorder.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by MediaRecorder or captureStream check', () => {
    const project = createInMemoryProject();
    const code = `
      if (typeof MediaRecorder === 'undefined') {
        const encoder = new Whammy.Video(30);
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = exportHtmlMediaFromCanvasJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts single screenshot canvas.toDataURL() and local shadowed CCapture', () => {
    const project = createInMemoryProject();
    const code = `
      const pngUrl = canvas.toDataURL('image/png');
      const { CCapture } = localMocks;
      new CCapture({ format: 'webm' });
    `;
    const sourceFile = project.createSourceFile('screenshot.js', code);
    const matches = exportHtmlMediaFromCanvasJsMatcher.matchFile(sourceFile, {
      filePath: 'screenshot.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
