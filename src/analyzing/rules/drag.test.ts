import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource, scanPackageJson } from '../scanners/index.ts';
import {
  DRAG_GUIDE_HASH,
  dragDependencyMatcher,
  dragJsMatcher,
  dragJsRule,
  dragPackageRule,
  dragRules,
} from './drag.ts';

describe('drag rules', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(dragPackageRule.id, 'drag/package-drag-drop');
    assert.equal(dragPackageRule.guideId, 'drag');
    assert.equal(dragPackageRule.guideHash, DRAG_GUIDE_HASH);
    assert.equal(dragPackageRule.guideHash.length, 12);
    assert.ok(dragPackageRule.phase2Rubric.keepWhen.length >= 1);
    assert.ok(dragPackageRule.phase2Rubric.dropWhen.length >= 2);

    assert.equal(dragJsRule.id, 'drag/js-mouse-touch-drag');
    assert.equal(dragJsRule.guideId, 'drag');
    assert.equal(dragJsRule.guideHash, DRAG_GUIDE_HASH);
    assert.ok(dragJsRule.phase2Rubric.keepWhen.length >= 1);
    assert.ok(dragJsRule.phase2Rubric.dropWhen.length >= 2);

    assert.equal(dragRules.length, 2);
  });

  test('flags legacy mousedown / mousemove coordinate drag loop', () => {
    const code = `
      function makeDraggable(el, handle) {
        handle.addEventListener('mousedown', (e) => {
          const startX = e.clientX;
          const startY = e.clientY;
          function onMouseMove(moveEvent) {
            el.style.left = (moveEvent.clientX - startX) + 'px';
            el.style.top = (moveEvent.clientY - startY) + 'px';
          }
          function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          }
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      }
    `;
    const { matches } = scanJsSource('src/drag.js', code, [dragJsMatcher], project);
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Pointer Events/);
  });

  test('flags touchstart / touchmove drag loop updating style.transform', () => {
    const code = `
      const panel = document.querySelector('.panel');
      panel.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const pageX = touch.pageX;
      });
      panel.addEventListener('touchmove', (e) => {
        const x = e.touches[0].pageX;
        panel.style.transform = \`translateX(\${x}px)\`;
      });
    `;
    const { matches } = scanJsSource('src/touch-drag.js', code, [dragJsMatcher], project);
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Pointer Events/);
  });

  test('flags package.json dependencies on legacy drag packages', () => {
    const pkg = JSON.stringify({
      dependencies: {
        interactjs: '^1.10.17',
        'react-draggable': '^4.4.6',
      },
      devDependencies: {
        draggabilly: '^3.0.0',
        dragula: '^3.7.3',
      },
    });
    const matches = scanPackageJson('package.json', pkg, [dragDependencyMatcher]);
    assert.equal(matches.length, 4);
    assert.match(matches[0].message, /interactjs/);
  });

  test('exempts modernized code utilizing setPointerCapture', () => {
    const code = `
      handle.addEventListener('pointerdown', (e) => {
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        el.style.left = e.clientX + 'px';
      });
    `;
    const { matches } = scanJsSource('src/modern-drag.js', code, [dragJsMatcher], project);
    assert.equal(matches.length, 0);
  });

  test('exempts standalone mousedown handler that does not perform drag movement', () => {
    const code = `
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.focus();
      });
    `;
    const { matches } = scanJsSource('src/focus.js', code, [dragJsMatcher], project);
    assert.equal(matches.length, 0);
  });
});
