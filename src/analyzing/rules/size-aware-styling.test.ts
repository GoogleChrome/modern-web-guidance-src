import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import { sizeAwareStylingRule } from './size-aware-styling.ts';

const matcher = sizeAwareStylingRule.matcher as JsRuleMatcher;

void test('size-aware-styling: positive brownfield matches', async (t) => {
  const project = createInMemoryProject();

  await t.test('flags ResizeObserver toggling responsive CSS classes', () => {
    const code = `
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const isNarrow = entry.contentRect.width < 500;
          entry.target.classList.toggle('is-narrow', isNarrow);
        }
      });
      observer.observe(document.querySelector('.card'));
    `;
    const { matches } = scanJsSource('card-resize.js', code, [matcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /container queries/);
  });

  await t.test('flags real-world asciiflow toolbar.tsx fixture', () => {
    const asciiflowCode = `
      useEffect(() => {
        const el = topBarRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            setTopBarWidth(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
          }
        });
        ro.observe(el);
        return () => ro.disconnect();
      }, []);
    `;
    const { matches } = scanJsSource('toolbar.tsx', asciiflowCode, [matcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });

  await t.test('flags ResizeObserver toggling inline styles based on clientWidth', () => {
    const code = `
      const ro = new ResizeObserver(() => {
        const width = container.clientWidth;
        container.style.flexDirection = width < 600 ? 'column' : 'row';
      });
      ro.observe(container);
    `;
    const { matches } = scanJsSource('flex-resize.js', code, [matcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('size-aware-styling: negative / exempt cases', async (t) => {
  const project = createInMemoryProject();

  await t.test('exempts ResizeObserver used to resize HTML canvas', () => {
    const code = `
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          canvas.width = entry.contentRect.width;
          canvas.height = entry.contentRect.height;
          const ctx = canvas.getContext('2d');
          ctx.render();
        }
      });
      ro.observe(canvas);
    `;
    const { matches } = scanJsSource('canvas-resize.js', code, [matcher], project);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts ResizeObserver used to layout Monaco editor', () => {
    const code = `
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          monacoEditor.layout({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      ro.observe(editorContainer);
    `;
    const { matches } = scanJsSource('monaco-resize.js', code, [matcher], project);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts ResizeObserver used for virtual scroll viewports', () => {
    const code = `
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          virtualizer.setViewportWidth(entry.contentRect.width);
        }
      });
      ro.observe(scrollContainer);
    `;
    const { matches } = scanJsSource('virtual-scroll.js', code, [matcher], project);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts ResizeObserver guarded by container query feature check', () => {
    const code = `
      if (!CSS.supports('container-type', 'inline-size')) {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            entry.target.classList.toggle('small', entry.contentRect.width < 400);
          }
        });
        ro.observe(card);
      }
    `;
    const { matches } = scanJsSource('guarded-cq.js', code, [matcher], project);
    assert.equal(matches.length, 0);
  });
});
