import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { stylingWebComponentsRule } from './styling-web-components.ts';

const cssMatcher = stylingWebComponentsRule.matcher as CssRuleMatcher;

void test('styling-web-components: positive brownfield matches', async (suiteContext) => {
  await suiteContext.test('flags selector with :host-context(.dark-theme)', () => {
    const css = `
      :host-context(.dark-theme) .card {
        background: #111;
        color: #eee;
      }
    `;
    const matches = scanCss('card.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /:host-context\(\)/);
  });

  await suiteContext.test('flags selector with :host-context([dir="rtl"])', () => {
    const css = `
      :host-context([dir="rtl"]) .icon {
        transform: scaleX(-1);
      }
    `;
    const matches = scanCss('icon.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /:host-context\(\)/);
  });

  await suiteContext.test('flags selector with :host-context(body.high-contrast)', () => {
    const css = `
      :host-context(body.high-contrast) .button {
        outline: 2px solid yellow;
      }
    `;
    const matches = scanCss('button.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /:host-context\(\)/);
  });

  await suiteContext.test('flags compound selector with :host-context', () => {
    const css = `
      :host-context([theme="solarized"]):host {
        --base: #002b36;
      }
    `;
    const matches = scanCss('theme.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /:host-context\(\)/);
  });

  await suiteContext.test('flags multiple :host-context selectors in single stylesheet', () => {
    const css = `
      :host-context(.dark) .title { color: white; }
      :host-context([dir="rtl"]) .arrow { margin-left: 0; }
    `;
    const matches = scanCss('legacy.css', css, [cssMatcher]);
    assert.equal(matches.length, 2);
  });

  await suiteContext.test('flags comma-separated selector containing :host-context branch', () => {
    const css = `
      .badge, :host-context(.dark) .badge {
        color: #fff;
      }
    `;
    const matches = scanCss('badge.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
  });
});

void test('styling-web-components: negative / exempt cases', async (suiteContext) => {
  await suiteContext.test('exempts standard :host selector', () => {
    const css = `
      :host {
        display: block;
        background: var(--card-bg, white);
      }
    `;
    const matches = scanCss('card.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts standard :host(...) conditional selector', () => {
    const css = `
      :host([disabled]) {
        opacity: 0.5;
        pointer-events: none;
      }
    `;
    const matches = scanCss('button.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts standard ::part(...) selector', () => {
    const css = `
      my-card::part(submit) {
        background: navy;
        color: white;
      }
    `;
    const matches = scanCss('consumer.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts standard ::slotted(...) selector', () => {
    const css = `
      ::slotted(p) {
        margin: 0;
      }
    `;
    const matches = scanCss('slot.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts container query inside component', () => {
    const css = `
      @container (min-width: 30rem) {
        .card { grid-template-columns: 1fr 2fr; }
      }
    `;
    const matches = scanCss('container.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts test and fixture files', () => {
    const css = `
      :host-context(.dark) .card { color: white; }
    `;
    const matches = scanCss('test/fixtures/legacy.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts vendor, polyfill, and minified paths', () => {
    const css = `
      :host-context(.dark) .card { color: white; }
    `;
    assert.equal(scanCss('vendor/theme.css', css, [cssMatcher]).length, 0);
    assert.equal(scanCss('polyfills/host-context.css', css, [cssMatcher]).length, 0);
    assert.equal(scanCss('dist/bundle.min.css', css, [cssMatcher]).length, 0);
  });

  await suiteContext.test('exempts descendant :host-context where Shadow DOM host is not root', () => {
    const css = `
      .sidebar :host-context(.dark) .title {
        color: white;
      }
    `;
    const matches = scanCss('my-element.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts rules guarded by @supports', () => {
    const css = `
      @supports selector(:host-context(.dark)) {
        :host-context(.dark) .card { color: white; }
      }
    `;
    const matches = scanCss('my-card.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });
});
