import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { customListMarkersRule } from './custom-list-markers.ts';

if (customListMarkersRule.matcher.kind !== 'css') {
  throw new Error('Expected CSS matcher');
}
const cssMatcher: CssRuleMatcher = customListMarkersRule.matcher;

void test('custom-list-markers: CSS positive matches', async (t) => {
  await t.test('flags ul { list-style: none } paired with li::before setting bullet content and color', () => {
    const css = `
      ul.feature-list {
        list-style: none;
        padding-left: 0;
      }
      ul.feature-list li::before {
        content: "•";
        color: #2563eb;
        font-weight: bold;
        margin-right: 0.5rem;
      }
    `;
    const matches = scanCss('list.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 6);
    assert.match(matches[0]?.message ?? '', /::marker/);
  });

  await t.test('flags ol { list-style-type: none } paired with li::before counter() and font styling', () => {
    const css = `
      ol.steps {
        list-style-type: none;
      }
      ol.steps li::before {
        counter-increment: step;
        content: counter(step) ". ";
        color: #dc2626;
        font-weight: 700;
      }
    `;
    const matches = scanCss('ordered.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });
});

void test('custom-list-markers: CSS negative / exempt cases', async (t) => {
  await t.test('exempts li::before rules that use layout/box properties unsupported by ::marker', () => {
    const css = `
      ul {
        list-style: none;
      }
      ul li::before {
        content: "•";
        color: white;
        background-color: blue;
        width: 1.5rem;
        height: 1.5rem;
        display: inline-block;
      }
    `;
    const matches = scanCss('badge-marker.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts breadcrumb separator rules (li + li::before { content: "/" })', () => {
    const css = `
      .breadcrumb {
        list-style: none;
      }
      .breadcrumb li + li::before {
        content: "/";
        color: #6b7280;
      }
    `;
    const matches = scanCss('breadcrumb.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets that already use ::marker', () => {
    const css = `
      ul li::marker {
        content: "→ ";
        color: green;
      }
    `;
    const matches = scanCss('modern-marker.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });
});
