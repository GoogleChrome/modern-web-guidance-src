import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import {
  CUSTOM_TEXT_DECORATIONS_GUIDE_HASH,
  customTextDecorationsCssMatcher,
  customTextDecorationsRule,
  customTextDecorationsRules,
} from './custom-text-decorations.ts';

void test('custom-text-decorations: rule metadata', () => {
  assert.equal(customTextDecorationsRule.id, 'custom-text-decorations');
  assert.equal(customTextDecorationsRule.guideId, 'custom-text-decorations');
  assert.equal(
    customTextDecorationsRule.guideHash,
    CUSTOM_TEXT_DECORATIONS_GUIDE_HASH,
  );
  assert.equal(CUSTOM_TEXT_DECORATIONS_GUIDE_HASH.length, 12);
  assert.equal(customTextDecorationsRules.length, 1);
  assert.ok(customTextDecorationsRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(customTextDecorationsRule.verifierRubric.dropWhen.length >= 2);
});

void test('custom-text-decorations: positive brownfield matches', async (t) => {
  await t.test('flags a link styled with border-bottom, padding-bottom, and text-decoration: none', () => {
    const css = `
      a.custom-link {
        text-decoration: none;
        border-bottom: 1px solid currentColor;
        padding-bottom: 2px;
      }
    `;
    const matches = scanCss('links.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /border-bottom/);
  });

  await t.test('flags .underline class on inline text with border-bottom and text-decoration: none', () => {
    const css = `
      .underline {
        text-decoration: none;
        border-bottom: 2px dashed #0070f3;
      }
    `;
    const matches = scanCss('typography.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags p a link hover underline with border-bottom', () => {
    const css = `
      p a:hover {
        text-decoration: none;
        border-bottom: 1px dotted #333;
        padding-bottom: 1px;
      }
    `;
    const matches = scanCss('article.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('custom-text-decorations: negative / exempt cases', async (t) => {
  await t.test('exempts block container cards and panels with border-bottom', () => {
    const css = `
      .card-header {
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 1rem;
      }
      .panel {
        display: block;
        border-bottom: 1px solid #ccc;
      }
    `;
    const matches = scanCss('layout.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts active tab navigation indicators', () => {
    const css = `
      .tab-item.active {
        border-bottom: 2px solid #2563eb;
      }
    `;
    const matches = scanCss('tabs.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules already using text-underline-offset or text-decoration-thickness', () => {
    const css = `
      a.modern {
        text-decoration: underline;
        text-underline-offset: 0.2em;
        text-decoration-thickness: 1px;
      }
    `;
    const matches = scanCss('modern.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts inline spans with padding and border-bottom that do not declare text-decoration: none', () => {
    const css = `
      span.tag {
        padding: 4px;
        border-bottom: 1px solid #ccc;
      }
    `;
    const matches = scanCss('tags.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts elements with multiple borders (box outline, not text underline)', () => {
    const css = `
      .box {
        border-top: 1px solid #ccc;
        border-bottom: 1px solid #ccc;
      }
    `;
    const matches = scanCss('box.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts elements with box-shadow, border-radius, or dimensions', () => {
    const css = `
      a.card-action {
        text-decoration: none;
        border-bottom: 2px solid blue;
        padding-bottom: 2px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      a.rounded-link {
        text-decoration: none;
        border-bottom: 2px solid blue;
        padding-bottom: 2px;
        border-radius: 4px;
      }
      a.sized-link {
        text-decoration: none;
        border-bottom: 2px solid blue;
        padding-bottom: 2px;
        width: 120px;
      }
    `;
    const matches = scanCss('boxes.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts button-like links and badges with border-bottom', () => {
    const css = `
      a.btn {
        text-decoration: none;
        border-bottom: 2px solid #333;
        padding-bottom: 2px;
      }
      a.badge {
        text-decoration: none;
        border-bottom: 1px solid #666;
        padding-bottom: 1px;
      }
    `;
    const matches = scanCss('buttons.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('flags link with border-bottom and text-decoration: none even without padding-bottom', () => {
    const css = `
      a.simple {
        text-decoration: none;
        border-bottom: 1px solid #ddd;
      }
    `;
    const matches = scanCss('simple.css', css, [customTextDecorationsCssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});
