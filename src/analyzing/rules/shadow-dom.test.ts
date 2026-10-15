import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher, JsRuleMatcher } from '../schema.ts';
import { shadowDomJsRule, shadowDomRule } from './shadow-dom.ts';

const domMatcher = shadowDomRule.matcher as DomRuleMatcher;
const jsMatcher = shadowDomJsRule.matcher as JsRuleMatcher;

void test('shadow-dom DOM: positive brownfield matches', async (t) => {
  await t.test('flags <script type="text/template"> in HTML', () => {
    const html = `
      <script type="text/template" id="item-template">
        <li class="todo-item">
          <label><%= title %></label>
        </li>
      </script>
    `;
    const matches = scanHtml('index.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /text\/template/);
  });

  await t.test('flags <script type="text/x-template"> in HTML', () => {
    const html = `
      <script type="text/x-template" id="modal-template">
        <div class="modal"><h3>Modal Content</h3></div>
      </script>
    `;
    const matches = scanHtml('modal.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /text\/x-template/);
  });

  await t.test('flags <script type="text/html"> in HTML', () => {
    const html = `
      <script type="text/html" id="user-row">
        <tr><td>User</td></tr>
      </script>
    `;
    const matches = scanHtml('users.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /text\/html/);
  });
});

void test('shadow-dom DOM: negative / exempt cases', async (t) => {
  await t.test('exempts <script type="application/ld+json">', () => {
    const html = `
      <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "Organization" }
      </script>
    `;
    const matches = scanHtml('seo.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard native <template> element', () => {
    const html = `
      <template id="card-template">
        <div class="card">
          <slot name="header"></slot>
        </div>
      </template>
    `;
    const matches = scanHtml('card.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard JavaScript script tags', () => {
    const html = `
      <script type="module" src="app.js"></script>
      <script>console.log("hello");</script>
    `;
    const matches = scanHtml('app.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('shadow-dom JS: positive brownfield matches', async (t) => {
  await t.test('flags this.shadowRoot.innerHTML assignment following attachShadow', () => {
    const project = createInMemoryProject();
    const code = `
      class UserCard extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.innerHTML = '<div class="user-card"><slot></slot></div>';
        }
      }
      customElements.define('user-card', UserCard);
    `;
    const sourceFile = project.createSourceFile('UserCard.ts', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'UserCard.ts',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /attachShadow/);
  });

  await t.test('flags shadow.innerHTML assignment with local shadow root variable', () => {
    const project = createInMemoryProject();
    const code = `
      function initWidget(container) {
        const shadow = container.attachShadow({ mode: 'open' });
        shadow.innerHTML = \`<style>:host { display: block; }</style><slot></slot>\`;
      }
    `;
    const sourceFile = project.createSourceFile('widget.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'widget.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });
});

void test('shadow-dom JS: negative / exempt cases', async (t) => {
  await t.test('exempts template cloneNode pattern recommended by guide', () => {
    const project = createInMemoryProject();
    const code = `
      const template = document.createElement('template');
      template.innerHTML = '<div class="card"><slot></slot></div>';

      class MyCard extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.append(template.content.cloneNode(true));
        }
      }
    `;
    const sourceFile = project.createSourceFile('MyCard.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'MyCard.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts innerHTML assignment on normal DOM elements unrelated to shadow root', () => {
    const project = createInMemoryProject();
    const code = `
      function renderMessage(el, text) {
        el.innerHTML = '<p>' + text + '</p>';
      }
    `;
    const sourceFile = project.createSourceFile('render.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'render.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
