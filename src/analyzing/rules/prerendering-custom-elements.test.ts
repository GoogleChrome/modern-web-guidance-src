import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import { prerenderingCustomElementsMatcher } from './prerendering-custom-elements.ts';

void test('prerendering-custom-elements DOM matcher', async (t) => {
  await t.test('flags <template shadowroot="open|closed"> without shadowrootmode', () => {
    const html = `
      <my-card>
        <template shadowroot="open">
          <style>.card { padding: 1rem; }</style>
          <div class="card"><slot></slot></div>
        </template>
      </my-card>
      <my-secret>
        <template shadowroot="closed">
          <slot></slot>
        </template>
      </my-secret>
    `;
    const matches = scanHtml('index.html', html, [prerenderingCustomElementsMatcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 3);
    assert.equal(matches[1]?.line, 9);
  });

  await t.test('flags JSX <template shadowroot="open">', () => {
    const code = `
      export function CardSSR() {
        return (
          <my-card>
            <template shadowroot="open">
              <slot />
            </template>
          </my-card>
        );
      }
    `;
    const matches = withVirtualSourceFile('CardSSR.tsx', code, (sourceFile) =>
      scanJsx('CardSSR.tsx', sourceFile, [prerenderingCustomElementsMatcher]),
    );
    assert.equal(matches.length, 1);
  });

  await t.test('exempts <template shadowrootmode="open"> and dual-attribute fallback templates', () => {
    const html = `
      <my-card>
        <template shadowrootmode="open">
          <slot></slot>
        </template>
      </my-card>
      <my-compat>
        <template shadowroot="open" shadowrootmode="open">
          <slot></slot>
        </template>
      </my-compat>
      <template id="row-tpl"><tr><td>Cell</td></tr></template>
    `;
    const matches = scanHtml('modern.html', html, [prerenderingCustomElementsMatcher]);
    assert.equal(matches.length, 0);
  });
});
