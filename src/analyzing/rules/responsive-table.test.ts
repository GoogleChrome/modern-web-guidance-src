import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import {
  responsiveTableCssMatcher,
  responsiveTablePackageMatcher
} from './responsive-table.ts';
void test('responsive-table dependency matcher', async (t) => {
  await t.test('flags tablesaw in dependencies', () => {
    const pkg = JSON.stringify({
      dependencies: {
        tablesaw: '^3.1.2',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [responsiveTablePackageMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /tablesaw/);
  });

  await t.test('flags footable, basictable, and jquery-basictable', () => {
    const pkg = JSON.stringify({
      dependencies: {
        footable: '^3.1.6',
        basictable: '^1.0.0',
        'jquery-basictable': '^1.0.2',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [responsiveTablePackageMatcher]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify({
      dependencies: {
        lodash: '^4.17.21',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [responsiveTablePackageMatcher]);
    assert.equal(matches.length, 0);
  });
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
