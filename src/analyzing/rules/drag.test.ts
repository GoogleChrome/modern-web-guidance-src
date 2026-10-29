import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { scanJsSource, scanPackageJson } from '../scanners/index.ts';
import {
  dragDependencyMatcher,
  dragJsMatcher
} from './drag.ts';

describe('drag rules', () => {
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
    const { matches } = scanJsSource('src/drag.js', code, [dragJsMatcher]);
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
    const { matches } = scanJsSource('src/touch-drag.js', code, [dragJsMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Pointer Events/);
  });

  test('flags package.json dependencies on legacy drag packages', () => {
    const pkg = JSON.stringify({
      dependencies: {
        'react-draggable': '^4.4.6',
        draggabilly: '^3.0.0',
      },
    });
    const matches = scanPackageJson('package.json', pkg, [dragDependencyMatcher]);
    assert.equal(matches.length, 2);
    assert.match(matches[0].message, /react-draggable/);
    assert.match(matches[1].message, /draggabilly/);
  });

  test('exempts dragula, interactjs, peerDependencies-only, and complex multi-dnd manifests', () => {
    const pkgSortable = JSON.stringify({
      dependencies: {
        interactjs: '^1.10.17',
        dragula: '^3.7.3',
      },
      peerDependencies: {
        draggabilly: '^3.0.0',
      },
    });
    assert.equal(scanPackageJson('package.json', pkgSortable, [dragDependencyMatcher]).length, 0);

    const pkgMultiDnd = JSON.stringify({
      dependencies: {
        'react-draggable': '^4.4.6',
        'react-dnd': '^16.0.1',
      },
    });
    assert.equal(scanPackageJson('package.json', pkgMultiDnd, [dragDependencyMatcher]).length, 0);
  });

  test('exempts right-click context menu, click+touchstart, and canvas/resize handlers', () => {
    const code = `
      menu.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
          menu.style.left = e.clientX + 'px';
          menu.style.top = e.clientY + 'px';
        }
      });
      document.addEventListener('mousemove', (e) => {
        console.log(e.clientX);
      });
      splitter.addEventListener('mousedown', (e) => {
        const startX = e.clientX;
        function onResize(moveEvent) {
          splitter.style.left = (moveEvent.clientX - startX) + 'px';
        }
        document.addEventListener('mousemove', onResize);
      });
    `;
    const { matches } = scanJsSource('src/context-menu.js', code, [dragJsMatcher]);
    assert.equal(matches.length, 0);
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
    const { matches } = scanJsSource('src/modern-drag.js', code, [dragJsMatcher]);
    assert.equal(matches.length, 0);
  });

  test('exempts standalone mousedown handler that does not perform drag movement', () => {
    const code = `
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.focus();
      });
    `;
    const { matches } = scanJsSource('src/focus.js', code, [dragJsMatcher]);
    assert.equal(matches.length, 0);
  });

  test('exempts empty/no-op mousedown handler', () => {
    const code = `
      handle.addEventListener('mousedown', () => {});
      panel.addEventListener('touchstart', (e) => {
        // no-op comment
      });
    `;
    const { matches } = scanJsSource('src/noop.js', code, [dragJsMatcher]);
    assert.equal(matches.length, 0);
  });

  test('exempts mousedown handler with only preventDefault even if enclosing scope contains coordinate tracking', () => {
    const code = `
      class WindowManager {
        init() {
          this.header.addEventListener('mousedown', (e) => {
            e.preventDefault();
            return false;
          });
        }

        trackGlobalMouse(e) {
          this.lastX = e.clientX;
          this.lastY = e.clientY;
          this.container.style.left = e.pageX + 'px';
          document.addEventListener('mousemove', (moveEvent) => {
            console.log(moveEvent.clientX);
          });
        }
      }
    `;
    const { matches } = scanJsSource('src/scope-drag.js', code, [dragJsMatcher]);
    assert.equal(matches.length, 0);
  });
});
