import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  customSelectPickerLayoutsJsMatcher
} from './custom-select-picker-layouts.ts';
void test('custom-select-picker-layouts JS matcher', async (t) => {
  await t.test('flags Choices, TomSelect, SlimSelect, and select2 with custom option templates on single-select', () => {
    const code = `
      import Choices from 'choices.js';
      import TomSelect from 'tom-select';
      import SlimSelect from 'slim-select';

      const colorSelect = document.querySelector('#color-picker');
      new Choices(colorSelect, {
        callbackOnCreateTemplates: function(template) {
          return {
            choice: (classNames, data) => template(\`<div class="swatch">\${data.label}</div>\`),
          };
        },
      });

      new TomSelect('#theme-picker', {
        maxItems: 1,
        render: {
          option: (data, escape) => \`<div class="card">\${escape(data.text)}</div>\`,
          item: (data, escape) => \`<div>\${escape(data.text)}</div>\`,
        },
      });

      new SlimSelect({
        select: '#icon-picker',
        data: [
          { text: 'Star', value: 'star', html: '<span class="icon-star"></span> Star' },
        ],
      });

      $('#avatar-select').select2({
        templateResult: (state) => state.text,
        templateSelection: (state) => state.text,
      });
    `;
    const matches = matchJsRule(customSelectPickerLayoutsJsMatcher, 'picker.js', code);
    assert.equal(matches.length, 4);
  });

  await t.test('exempts multi-select, tags: true, ajax, maxItems > 1, or guarded calls', () => {
    const code = `
      import Choices from 'choices.js';
      import TomSelect from 'tom-select';

      new TomSelect('#tag-picker', {
        maxItems: 5,
        render: {
          option: (data) => \`<div>\${data.text}</div>\`,
        },
      });

      $('#remote-search').select2({
        ajax: { url: '/api/items' },
        templateResult: (item) => item.name,
      });

      $('#tags-input').select2({
        tags: true,
        templateResult: (item) => item.text,
      });

      new TomSelect('#create-picker', {
        create: true,
        render: {
          option: (data) => \`<div>\${data.text}</div>\`,
        },
      });

      const multiEl = document.querySelector('select[multiple]');
      new Choices(multiEl, {
        callbackOnCreateTemplates: (t) => ({}),
      });

      new Choices('#plain-single-select', {
        searchEnabled: false,
      });

      if (!CSS.supports('appearance', 'base-select')) {
        new Choices('#fallback-picker', {
          callbackOnCreateTemplates: (t) => ({}),
        });
      }

      $('#searchable-select2').select2({
        minimumInputLength: 2,
        allowClear: true,
        templateResult: (item) => item.text,
      });

      $('#matcher-select2').select2({
        matcher: (params, data) => data,
        minimumResultsForSearch: 10,
        templateResult: (item) => item.text,
      });
    `;
    const matches = matchJsRule(customSelectPickerLayoutsJsMatcher, 'excluded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts shadowed local Choices or TomSelect classes', () => {
    const code = `
      import TomSelect from 'tom-select';

      function localScope() {
        class TomSelect {
          constructor(el, opts) { this.el = el; this.opts = opts; }
        }
        new TomSelect('#el', {
          render: { option: (d) => d.text },
        });
      }
    `;
    const matches = matchJsRule(customSelectPickerLayoutsJsMatcher, 'shadowed.js', code);
    assert.equal(matches.length, 0);
  });
});
