import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { iconsCssMatcher } from './icons.ts';

void test('icons CSS matcher', async (t) => {
  await t.test('flags invert/sepia/saturate/hue-rotate filter chains used to recolor icons', () => {
    const css = `
      .icon-link:hover .link-icon {
        filter: invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%);
      }
      .btn img.icon {
        -webkit-filter: brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(87deg);
      }
    `;
    const matches = scanCss('icons.css', css, [iconsCssMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts simple dark-mode invert(1), zero-saturation filters, photo/video elements, and mask icons', () => {
    const css = `
      .icon-dark {
        filter: invert(1);
      }
      .icon-muted {
        filter: invert(50%) sepia(10%) saturate(0%) hue-rotate(0deg);
      }
      .hero-photo {
        filter: invert(10%) sepia(20%) saturate(200%) hue-rotate(180deg);
      }
      .icon-modern {
        mask: url(icon.svg) no-repeat center / contain;
        background-color: currentColor;
      }
      :host-context(.-theme-with-dark-background) .arrow {
        filter: invert(10%) sepia(46%) saturate(439%) hue-rotate(194deg) brightness(100%) contrast(94%);
      }
    `;
    const matches = scanCss('modern-icons.css', css, [iconsCssMatcher]);
    assert.equal(matches.length, 0);

    const devtoolsCss = `
      .lh-report-icon::before {
        filter: invert(77%) sepia(4%) saturate(1976%) hue-rotate(193deg) brightness(111%) contrast(92%);
      }
    `;
    assert.equal(
      scanCss('themes/macchiato_maroon/devtools.css', devtoolsCss, [iconsCssMatcher]).length,
      0,
    );
  });
});
