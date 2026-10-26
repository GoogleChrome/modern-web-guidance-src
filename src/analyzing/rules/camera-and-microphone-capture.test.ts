import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  CAMERA_AND_MICROPHONE_CAPTURE_GUIDE_HASH,
  cameraAndMicrophoneCaptureJsMatcher,
  cameraAndMicrophoneCaptureJsRule,
  cameraAndMicrophoneCaptureRules,
} from './camera-and-microphone-capture.ts';

void test('camera-and-microphone-capture: rule metadata', () => {
  assert.equal(
    cameraAndMicrophoneCaptureJsRule.id,
    'camera-and-microphone-capture/legacy-get-user-media',
  );
  assert.equal(
    cameraAndMicrophoneCaptureJsRule.guideId,
    'camera-and-microphone-capture',
  );
  assert.equal(
    cameraAndMicrophoneCaptureJsRule.guideHash,
    CAMERA_AND_MICROPHONE_CAPTURE_GUIDE_HASH,
  );
  assert.equal(CAMERA_AND_MICROPHONE_CAPTURE_GUIDE_HASH.length, 12);
  assert.equal(cameraAndMicrophoneCaptureRules.length, 1);
  assert.ok(
    cameraAndMicrophoneCaptureJsRule.verifierRubric.keepWhen.length >= 1,
  );
  assert.ok(
    cameraAndMicrophoneCaptureJsRule.verifierRubric.dropWhen.length >= 1,
  );
});

void test('camera-and-microphone-capture JS matcher', async (t) => {
  await t.test('flags standard and vendor-prefixed navigator.getUserMedia callback calls', () => {
    const project = createInMemoryProject();
    const code = `
      function startCamera() {
        navigator.getUserMedia(
          { video: true, audio: true },
          (stream) => { videoElement.srcObject = stream; },
          (err) => { console.error('getUserMedia failed', err); }
        );
      }

      function startWebkit() {
        navigator.webkitGetUserMedia(
          { video: { width: 1280, height: 720 } },
          onStreamSuccess,
          onStreamError
        );
      }

      function startMoz() {
        window.navigator.mozGetUserMedia(
          { audio: true },
          onAudioSuccess,
          onAudioError
        );
      }
    `;
    const sourceFile = project.createSourceFile('camera.js', code);
    const matches = cameraAndMicrophoneCaptureJsMatcher.matchFile(sourceFile, {
      filePath: 'camera.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
    assert.match(matches[0]?.message ?? '', /navigator\.getUserMedia/);
    assert.match(matches[1]?.message ?? '', /navigator\.webkitGetUserMedia/);
    assert.match(matches[2]?.message ?? '', /window\.navigator\.mozGetUserMedia/);
  });

  await t.test('flags bound and aliased getUserMedia invocations', () => {
    const project = createInMemoryProject();
    const code = `
      function captureStream() {
        const legacyGUM = navigator.getUserMedia || navigator.webkitGetUserMedia;
        legacyGUM({ video: true }, onStream, onError);
        navigator.getUserMedia.call(navigator, { audio: true }, onStream, onError);
      }
    `;
    const sourceFile = project.createSourceFile('aliased.js', code);
    const matches = cameraAndMicrophoneCaptureJsMatcher.matchFile(sourceFile, {
      filePath: 'aliased.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('ignores modern navigator.mediaDevices.getUserMedia calls', () => {
    const project = createInMemoryProject();
    const code = `
      async function modernCapture() {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        video.srcObject = stream;
      }
    `;
    const sourceFile = project.createSourceFile('modern.js', code);
    const matches = cameraAndMicrophoneCaptureJsMatcher.matchFile(sourceFile, {
      filePath: 'modern.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('drops legacy getUserMedia when guarded by navigator.mediaDevices check', () => {
    const project = createInMemoryProject();
    const code = `
      function resilientCapture(constraints, onSuccess, onError) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia(constraints)
            .then(onSuccess)
            .catch(onError);
        } else {
          navigator.getUserMedia(constraints, onSuccess, onError);
        }
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = cameraAndMicrophoneCaptureJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0, 'Guarded fallback should not produce findings');
  });

  await t.test('drops legacy calls when implementing navigator.mediaDevices.getUserMedia polyfill shim', () => {
    const project = createInMemoryProject();
    const code = `
      if (navigator.mediaDevices === undefined) {
        navigator.mediaDevices = {};
      }

      if (navigator.mediaDevices.getUserMedia === undefined) {
        navigator.mediaDevices.getUserMedia = function(constraints) {
          const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia;
          if (!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
          }
          return new Promise(function(resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject);
          });
        };
      }
    `;
    const sourceFile = project.createSourceFile('adapter-shim.js', code);
    const matches = cameraAndMicrophoneCaptureJsMatcher.matchFile(sourceFile, {
      filePath: 'adapter-shim.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0, 'Polyfill shim definition should be dropped');
  });
});
