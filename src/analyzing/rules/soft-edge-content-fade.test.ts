import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import {
  softEdgeContentFadeCssMatcher
} from './soft-edge-content-fade.ts';
void test('soft-edge-content-fade: positive matches', async (t) => {
  await t.test('flags -webkit-mask-image: linear-gradient(...) without standard mask-image', () => {
    const css = `
      .scroll-fade {
        overflow-y: auto;
        -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
      }
    `;
    const matches = scanCss('fade.css', css, [softEdgeContentFadeCssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags legacy -webkit-gradient(linear, ...) without standard mask-image', () => {
    const css = `
      .legacy-fade {
        -webkit-mask-image: -webkit-gradient(linear, left top, left bottom, from(rgba(0,0,0,1)), to(rgba(0,0,0,0)));
      }
    `;
    const matches = scanCss('legacy-fade.css', css, [softEdgeContentFadeCssMatcher]);
    assert.equal(matches.length, 1);
  });
});

void test('soft-edge-content-fade: negative / exempt cases', async (t) => {
  await t.test('exempts rules that also declare standard mask-image', () => {
    const css = `
      .modern-fade {
        -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
        mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
      }
    `;
    const matches = scanCss('modern.css', css, [softEdgeContentFadeCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-gradient url(), radial-gradient, and repeating-linear-gradient masks', () => {
    const css = `
      .icon {
        -webkit-mask-image: url("icon.svg");
      }
      .circle-vignette {
        -webkit-mask-image: radial-gradient(circle, black 50%, transparent 100%);
      }
      .stripes {
        -webkit-mask-image: repeating-linear-gradient(45deg, black 0 10px, transparent 10px 20px);
      }
    `;
    const matches = scanCss('icon.css', css, [softEdgeContentFadeCssMatcher]);
    assert.equal(matches.length, 0);
  });
});
