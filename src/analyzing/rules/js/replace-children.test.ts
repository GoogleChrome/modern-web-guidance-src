import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  assertAntiSpongeSelectivity,
  assertValidFastTokenSpecs,
} from '../index.test.ts';
import { computeGuideHash } from '../../scanners/index.ts';
import { matchJsRule } from '../../scanners/js-scanner.ts';
import {
  JS_REPLACE_CHILDREN_GUIDE_HASH,
  jsReplaceChildrenMatcher,
  jsReplaceChildrenRule,
} from './replace-children.ts';
import {
  jsReplaceChildrenInnerHtmlMatcher,
  jsReplaceChildrenInnerHtmlRule,
} from './replace-children-innerhtml.ts';

const replaceChildrenRules = [jsReplaceChildrenRule, jsReplaceChildrenInnerHtmlRule];

void test('js/replace-children: positive tidy-up child-clearing loops', async (t) => {
  await t.test('flags while (el.firstChild) el.removeChild(el.firstChild) with or without block', () => {
    const code = `
      function clearPanel(el, box) {
        while (el.firstChild) el.removeChild(el.firstChild);
        while (box.firstChild !== null) {
          box.removeChild(box.firstChild);
        }
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'panel.js', code);
    assert.deepStrictEqual(
      matches.map((m) => m.line),
      [3, 4],
    );
    assert.ok(matches.every((m) => !/skips/i.test(m.message)));
  });

  await t.test('flags while (el.lastChild) and assignment-in-condition loops', () => {
    const code = `
      function clearLists(list, parent) {
        let child;
        while ((child = list.firstChild)) {
          list.removeChild(child);
        }
        while ((child = parent.lastChild) !== null) child.remove();
        while (parent.lastChild) parent.removeChild(parent.lastChild);
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'lists.js', code);
    assert.deepStrictEqual(
      matches.map((m) => m.line),
      [4, 7, 8],
    );
  });

  await t.test('flags while (el.hasChildNodes()) and while (el.childNodes.length) variants', () => {
    const code = `
      function clearVariants(a, b, c, d, e) {
        while (a.hasChildNodes()) a.removeChild(a.firstChild);
        while (b.childNodes.length >= 1) b.removeChild(b.lastChild);
        while (c.childNodes.length) c.removeChild(c.firstChild);
        while (d.childNodes.length > 0) d.childNodes[0].remove();
        while (e.childNodes.length !== 0) e.removeChild(e.childNodes[e.childNodes.length - 1]);
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'variants.js', code);
    assert.deepStrictEqual(
      matches.map((m) => m.line),
      [3, 4, 5, 6, 7],
    );
  });

  await t.test('flags child.remove(), uninitialized for, backward childNodes loops, and snapshot .childNodes loops as tidy-ups', () => {
    const code = `
      class View {
        #container;
        clearAll(el: HTMLElement, list: HTMLElement, tpl: HTMLTemplateElement, rowTemplate: HTMLTableRowElement) {
          while (el.firstChild) el.firstChild.remove();
          while (this.#container.lastChild) this.#container.lastChild?.remove();
          for (; el.hasChildNodes(); ) el.removeChild(el.firstChild);
          for (let i = el.childNodes.length - 1; i >= 0; i--) {
            el.removeChild(el.childNodes[i]);
          }
          for (const child of [...this.#container.childNodes]) {
            this.#container.removeChild(child);
          }
          for (const item of Array.from(list.childNodes)) {
            item.remove();
          }
          Array.from(el.childNodes).forEach((c) => c.remove());
          [...el.childNodes].forEach(function (c) {
            el.removeChild(c);
          });
          [].slice.call(list.childNodes).forEach((c) => list.removeChild(c));
          while (tpl.content.firstChild) tpl.content.removeChild(tpl.content.firstChild);
          while (rowTemplate.firstChild) rowTemplate.removeChild(rowTemplate.firstChild);
        }
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'view.ts', code);
    assert.deepStrictEqual(
      matches.map((m) => m.line),
      [5, 6, 7, 8, 11, 14, 17, 18, 21, 22, 23],
    );
    for (const m of matches) {
      assert.ok(!/skips/i.test(m.message), `unexpected skipping warning on tidy-up line ${m.line}`);
    }
  });
});

void test('js/replace-children: live-collection loops that skip every other child', () => {
  const code = `
    function buggyClears(el, list, box) {
      for (let i = 0; i < el.children.length; i++) {
        el.removeChild(el.children[i]);
      }
      for (let i = 0; i < box.childNodes.length; i++) {
        box.childNodes[i].remove();
      }
      for (const child of list.children) {
        child.remove();
      }
      for (const node of el.childNodes) {
        el.removeChild(node);
      }
      box.childNodes.forEach((node) => node.remove());
      [].forEach.call(list.children, (child) => list.removeChild(child));
    }
  `;
  const matches = matchJsRule(jsReplaceChildrenMatcher, 'buggy.js', code);
  assert.deepStrictEqual(
    matches.map((m) => m.line),
    [3, 6, 9, 12, 15, 16],
  );
  for (const m of matches) {
    const lines = m.message.split('\n');
    assert.ok(lines.length >= 2, `expected multi-line message on line ${m.line}`);
    assert.match(lines[0] ?? '', /skips every other child/i);
    assert.match(m.message, /replaceChildren\(\)/);
  }
});

void test('js/replace-children: negative / exempt cases', async (t) => {
  await t.test('exempts loops that move, collect, or reparent nodes', () => {
    const code = `
      function moveChildren(el, frag, childNodes, parent, target) {
        let net;
        while (el.firstChild) frag.appendChild(el.removeChild(el.firstChild));
        while (el.lastChild) childNodes.push(el.removeChild(el.lastChild));
        while (parent.firstChild) {
          if (parent.firstChild.chosen) net = parent.firstChild;
          parent.removeChild(parent.firstChild);
        }
        for (const child of el.children) {
          el.removeChild(child);
          target.appendChild(child);
        }
        return net;
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'move.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts loops with per-node teardown or side effects in the loop body', () => {
    const code = `
      function teardownChildren(el, gl) {
        while (el.firstChild) {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
          el.removeChild(el.firstChild);
        }
        while (el.firstChild) {
          el.firstChild.onclick = null;
          el.firstChild.remove();
        }
        for (const child of el.children) {
          unregisterWidget(child);
          child.remove();
        }
        while (el.firstChild) (cleanup(el.firstChild), el.removeChild(el.firstChild));
        while (el.firstChild) el.removeChild(trackRemoval(el.firstChild));
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'teardown.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts conditional, partial, bounded, sentinel, == true, swapped-operand, and mismatched loops', () => {
    const code = `
      function partialClear(el, g, queue, target, lines, newNumLines) {
        while (lines > newNumLines && el.firstChild) el.removeChild(el.firstChild);
        while (el.childNodes.length > 25) el.removeChild(el.firstChild);
        while (el.childNodes.length > 1) el.removeChild(el.lastChild);
        while (el.children.length > -foo) el.removeChild(el.children[0]);
        while (el.childNodes.length > -foo) el.removeChild(el.firstChild);
        for (let i = el.childNodes.length - 1; i >= -foo; i--) el.removeChild(el.childNodes[i]);
        while (el.childNodes.length == true) el.removeChild(el.firstChild);
        while (el.childNodes.length === true) el.firstChild.remove();
        while (0 < el.childNodes.length) el.removeChild(el.firstChild);
        while (g.firstChild != g.lastChild) g.removeChild(g.firstChild);
        for (let i = el.childNodes.length - 1; i >= 1; i--) el.removeChild(el.childNodes[i]);
        for (let i = 1; i < el.children.length; i++) el.removeChild(el.children[i]);
        for (let i = 0; i < el.children.length - 1; i++) el.children[i].remove();
        for (let i = 0; i < el.children.length; i += 2) el.children[i].remove();
        [].slice.call(el.children, 1).forEach((c) => c.remove());
        [].slice.call(el.childNodes, 1).forEach((c) => c.remove());
        let len = el.children.length;
        while (len--) el.children[len].parentNode.removeChild(el.children[len]);
        while (queue.firstChild) target.removeChild(target.firstChild);
        el.childNodes.forEach((c) => {
          if (c.localName === 'title') c.remove();
        });
        for (const c of el.children) {
          if (c.classList.contains('stale')) c.remove();
        }
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'partial.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts custom non-DOM collection patterns and <template> hosts', () => {
    const code = `
      class SceneGroup {
        destroyChildren(children, node, parent, template, typedTpl: HTMLTemplateElement) {
          let i = this.children.length - 1;
          while (i >= 0) {
            this.children[i].remove();
            i--;
          }
          this.display.parent.children.remove(this);
          children.forEach((child) => {
            node.removeChild(child);
            parent.addChild(child);
          });
          while (template.firstChild) {
            template.removeChild(template.firstChild);
          }
          while (typedTpl.firstChild) {
            typedTpl.firstChild.remove();
          }
        }
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'scene.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts element-only removal loops including .children snapshots that preserve Text and Comment nodes', () => {
    const code = `
      function clearElementSiblingsOnly(el, list) {
        while (el.firstElementChild) el.firstElementChild.remove();
        while (el.lastElementChild) el.removeChild(el.lastElementChild);
        while (el.children.length > 0) {
          el.removeChild(el.children[0]);
        }
        for (let i = el.children.length - 1; i >= 0; i--) {
          el.removeChild(el.children[i]);
        }
        for (const item of Array.from(list.children)) {
          item.remove();
        }
        for (const item of [...el.children]) {
          el.removeChild(item);
        }
        Array.from(el.children).forEach((c) => c.remove());
        [...el.children].forEach((c) => c.remove());
        [].slice.call(list.children).forEach((c) => list.removeChild(c));
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'elements-only.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts innerHTML = "", modern replaceChildren(), feature-guarded fallbacks, and polyfills', () => {
    const code = `
      function modernAndGuarded(el, replacement) {
        el.innerHTML = '';
        el.replaceChildren();
        el.replaceChildren(replacement);

        if (!el.replaceChildren) {
          while (el.firstChild) el.removeChild(el.firstChild);
        }

        if (typeof Element.prototype.replaceChildren !== 'function') {
          while (el.lastChild) el.lastChild.remove();
        }

        if ('replaceChildren' in el) {
          el.replaceChildren();
        } else {
          for (const child of el.children) child.remove();
        }

        Element.prototype.replaceChildren = function polyfill() {
          while (this.firstChild) this.removeChild(this.firstChild);
        };
      }

      function earlyReturnGuarded(el) {
        if (typeof el.replaceChildren === 'function') {
          el.replaceChildren();
          return;
        }
        while (el.firstChild) el.removeChild(el.firstChild);
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });
});

void test('js/replace-children-innerhtml: positive standalone empty innerHTML clears', async (t) => {
  await t.test('flags empty string, empty template literal, null, and .content clears on DOM receivers', () => {
    const code = `
      class PanelView {
        shadowRoot!: ShadowRoot;
        clearAll(el: HTMLElement, svgContainer: HTMLElement, rows: HTMLElement[], tpl: HTMLTemplateElement, card: HTMLElement) {
          el.innerHTML = '';
          el.innerHTML = "";
          el.innerHTML = \`\`;
          document.getElementById('rec-list')!.innerHTML = null;
          this.shadowRoot.innerHTML = null;
          document.body.innerHTML = '';
          svgContainer.querySelector<SVGSVGElement>('svg')!.innerHTML = \`\`;
          rows[0]!.innerHTML = '';
          tpl.content.innerHTML = '';
          (tpl as HTMLTemplateElement).content.innerHTML = '';
          const frag = tpl.content;
          frag.innerHTML = '';
          tpl.content.cloneNode(true);
          card.innerHTML = '';
        }
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenInnerHtmlMatcher, 'clear.ts', code);
    assert.deepStrictEqual(
      matches.map((m) => m.line),
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18],
    );
  });

  await t.test('flags template-named variables when typed as non-template DOM or initialized via createElement(<other tag>)', () => {
    const code = `
      class CardComponent {
        private template!: HTMLElement;
        private rowTemplate = document.createElement('tr');
        constructor(private itemTpl: HTMLDivElement) {}
        reset(tplParam: HTMLElement, typedRowTpl: HTMLTableRowElement) {
          this.template.innerHTML = '';
          this.rowTemplate.innerHTML = '';
          this.itemTpl.innerHTML = '';
          tplParam.innerHTML = '';
          typedRowTpl.innerHTML = '';
          const localRowTemplate = document.createElement('tr');
          localRowTemplate.innerHTML = '';
          const queriedTemplate = document.querySelector('div.template');
          queriedTemplate!.innerHTML = '';
        }
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenInnerHtmlMatcher, 'typed-non-template.ts', code);
    assert.deepStrictEqual(
      matches.map((m) => m.line),
      [7, 8, 9, 10, 11, 13, 15],
    );
  });

  await t.test('flags clear before appends, async/yield suspension, control flow, or reads of innerHTML/outerHTML/textContent', () => {
    const code = `
      async function updateViews(box, items, fetchMarkup, templateContainer, templateList) {
        box.innerHTML = '';
        for (const item of items) {
          box.appendChild(document.createElement('li'));
        }

        templateContainer.innerHTML = '';
        const fresh = await fetchMarkup();
        templateContainer.innerHTML = fresh;

        box.innerHTML = '';
        box.innerHTML = await fetchMarkup();

        templateList.innerHTML = '';
        if (!items.length) return;
        templateList.innerHTML = '<li>done</li>';

        box.innerHTML = '';
        const prevText = box.textContent;
        box.innerHTML = \`<div>\${prevText}</div>\`;

        box.innerHTML = '';
        box.innerHTML += \`<span>\${box.innerHTML}</span>\`;

        box && (box.innerHTML = '');
      }

      function* genClear(el) {
        el.innerHTML = '';
        yield;
        el.innerHTML = '<span>next</span>';
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenInnerHtmlMatcher, 'async-clear.js', code);
    assert.deepStrictEqual(
      matches.map((m) => m.line),
      [3, 8, 12, 15, 19, 23, 26, 30],
    );
  });
});

void test('js/replace-children-innerhtml: negative / exempt cases', async (t) => {
  await t.test('exempts structural and untyped <template> element receivers', () => {
    const code = `
      function templateClears(template, tpl, rowTemplate, typedTpl: HTMLTemplateElement, genericEl: HTMLElement) {
        template.innerHTML = '';
        tpl.innerHTML = "";
        rowTemplate.innerHTML = \`\`;
        typedTpl.innerHTML = '';
        (genericEl as HTMLTemplateElement).innerHTML = '';
        (<HTMLTemplateElement>genericEl).innerHTML = '';

        const created = document.createElement('template');
        created.innerHTML = '';

        const host = document.createElement('template');
        host.innerHTML = '';

        const queried = document.querySelector('template#item');
        queried!.innerHTML = '';

        const typedQuery = document.querySelector<HTMLTemplateElement>('.custom-host');
        typedQuery!.innerHTML = '';

        const inferredTpl = document.getElementById('custom-card');
        inferredTpl!.innerHTML = '';
      }

      class TemplateComponent {
        private template!: HTMLTemplateElement;
        private tpl = document.createElement('template');
        reset() {
          this.template.innerHTML = '';
          this.tpl.innerHTML = '';
        }
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenInnerHtmlMatcher, 'templates.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts redundant empty innerHTML assignments before another innerHTML write (including with el.id / el.dataset reads)', () => {
    const code = `
      class Renderer {
        blurContent!: HTMLElement;
        redraw(clone: HTMLElement, w: HTMLElement[], element: HTMLElement, box: HTMLElement, text: string, i: number) {
          this.blurContent.innerHTML = '';
          this.blurContent.innerHTML = clone.innerHTML;

          w[0].innerHTML = "";
          w[0].innerHTML = '<div id="glowscript" class="glowscript"></div>';

          element.innerHTML = "";
          const highlightString = String(i) + text;
          element.innerHTML += highlightString;

          element.innerHTML = '';
          const itemKey = \`\${element.id}:\${element.dataset.role}\`;
          element.innerHTML += \`<span>\${itemKey}</span>\`;

          element.innerHTML = '';
          const itemId = element.id;
          const itemRole = element.dataset.role;
          element.innerHTML += \`<span>\${itemId}:\${itemRole}</span>\`;

          box.innerHTML = '';
          box.innerHTML += \`<div id="\${box.id}">\${box.dataset.value}</div>\`;
        }
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenInnerHtmlMatcher, 'redundant.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts chained assignments and expression-value contexts', () => {
    const code = `
      function valueContexts(a, b, el) {
        a.innerHTML = b.innerHTML = '';
        el.innerHTML = el.value = '';
        const assigned = (el.innerHTML = '');
        const concise = () => (el.innerHTML = '');
        consume(el.innerHTML = '');
        if (assigned) return concise();
        return (el.innerHTML = '');
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenInnerHtmlMatcher, 'chained.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts lookalikes, undefined, non-empty innerHTML writes, and guarded code', () => {
    const code = `
      function lookalikesAndGuarded(el, replacement) {
        el.innerHTML = undefined;
        el.innerHTML += '';
        el.innerHTML = '<span>content</span>';
        el.textContent = '';
        el.outerHTML = '';
        el.replaceChildren();
        el.replaceChildren(replacement);

        if ('replaceChildren' in el) {
          el.replaceChildren();
        } else {
          el.innerHTML = '';
        }

        if (typeof el.replaceChildren === 'function') {
          el.replaceChildren();
          return;
        }
        el.innerHTML = '';

        Element.prototype.replaceChildren = function polyfill() {
          this.innerHTML = '';
        };
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenInnerHtmlMatcher, 'lookalikes.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts bare global document receivers while still flagging document.body', () => {
    const code = `
      function clearDocumentAndBody() {
        document.innerHTML = '';
        window.document.innerHTML = '';
        globalThis.document.innerHTML = null;
        document.body.innerHTML = '';
      }
    `;
    const matches = matchJsRule(jsReplaceChildrenInnerHtmlMatcher, 'document-innerhtml.js', code);
    assert.deepStrictEqual(
      matches.map((m) => m.line),
      [6],
    );
  });
});

void test('js/replace-children module satisfies fastTokens, anti-sponge selectivity, guideHash, and general rubric invariants', () => {
  const guidePath = resolve(import.meta.dirname, '../../../../guides/js/js/guide.md');
  const expectedHash = computeGuideHash(readFileSync(guidePath, 'utf8'));
  assert.strictEqual(JS_REPLACE_CHILDREN_GUIDE_HASH, expectedHash);
  assert.strictEqual(replaceChildrenRules.length, 2);
  for (const rule of replaceChildrenRules) {
    assert.strictEqual(rule.guideHash, expectedHash);
    const rubricText = [...rule.verifierRubric.keepWhen, ...rule.verifierRubric.dropWhen].join('\n');
    for (const banned of ['output/static/main', 'webpack_require', 'oldIE', 'ExplorerCanvas', 'VML', 'DomApi']) {
      assert.ok(!rubricText.includes(banned), `unexpected card-fitted phrase ${banned} in ${rule.id}`);
    }
  }
  assert.ok(jsReplaceChildrenRule.verifierRubric.dropWhen.some((d) => /non-DOM/i.test(d) && /mock|plain JavaScript object/i.test(d)));
  assert.ok(jsReplaceChildrenInnerHtmlRule.verifierRubric.dropWhen.some((d) => /non-DOM/i.test(d) && /mock/i.test(d) && /plain JavaScript object/i.test(d)));
  assertValidFastTokenSpecs(replaceChildrenRules);
  assertAntiSpongeSelectivity(replaceChildrenRules);
});
