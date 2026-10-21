import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import {
  RESPONSIVE_TABLE_GUIDE_HASH,
  responsiveTableCssMatcher,
  responsiveTableCssRule,
  responsiveTableRules,
} from './responsive-table.ts';

void test('responsive-table: rule metadata', () => {
  assert.equal(RESPONSIVE_TABLE_GUIDE_HASH.length, 12);

  assert.equal(responsiveTableCssRule.id, 'responsive-table/css-data-label-table');
  assert.equal(responsiveTableCssRule.guideId, 'responsive-table');
  assert.equal(responsiveTableCssRule.guideHash, RESPONSIVE_TABLE_GUIDE_HASH);

  assert.equal(responsiveTableRules.length, 1);
  assert.ok(responsiveTableCssRule.phase2Rubric.keepWhen.length > 0);
  assert.ok(responsiveTableCssRule.phase2Rubric.dropWhen.length >= 2);
});

void test('responsive-table CSS matcher: positive brownfield matches', async (t) => {
  await t.test('flags td:before with content: attr(data-label)', () => {
    const css = `
      @media only screen and (max-width: 760px) {
        td:before {
          content: attr(data-label);
          font-weight: bold;
        }
      }
    `;
    const matches = scanCss('responsive-table.css', css, [responsiveTableCssMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Container Queries/);
  });

  await t.test('flags td::before with content: attr(data-th)', () => {
    const css = `
      td::before {
        content: attr(data-th) ": ";
        display: inline-block;
      }
    `;
    const matches = scanCss('reveal.css', css, [responsiveTableCssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags .table td:before with content: attr(data-title)', () => {
    const css = `
      .responsive-table td:before {
        content: attr(data-title);
      }
    `;
    const matches = scanCss('table.css', css, [responsiveTableCssMatcher]);
    assert.equal(matches.length, 1);
  });
});

void test('responsive-table CSS matcher: negative / exempt cases', async (t) => {
  await t.test('exempts stylesheets using @container queries', () => {
    const css = `
      @container (width < 600px) {
        td:nth-child(2)::before {
          content: var(--label-2) ": " / var(--label-2);
        }
      }
    `;
    const matches = scanCss('modern-table.css', css, [responsiveTableCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts print style on anchor tag with attr(href)', () => {
    const css = `
      @media print {
        a:after {
          content: " (" attr(href) ")";
        }
      }
    `;
    const matches = scanCss('print.css', css, [responsiveTableCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts general table styling without data-* attribute injection', () => {
    const css = `
      table {
        border-collapse: collapse;
      }
      td {
        padding: 8px;
      }
    `;
    const matches = scanCss('standard-table.css', css, [responsiveTableCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts hover tooltips and calendar day labels', () => {
    const css = `
      td:hover::before {
        content: attr(data-title);
        opacity: 1;
      }
      .calendar td::before {
        content: attr(data-title);
      }
    `;
    const matches = scanCss('tooltip.css', css, [responsiveTableCssMatcher]);
    assert.equal(matches.length, 0);
  });
});
