import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH,
  customSelectPickerLayoutsJsMatcher,
  customSelectPickerLayoutsJsRule,
  customSelectPickerLayoutsRules,
} from './custom-select-picker-layouts.ts';

void test('custom-select-picker-layouts: rule metadata', () => {
  assert.equal(CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH.length, 12);

  assert.equal(
    customSelectPickerLayoutsJsRule.id,
    'custom-select-picker-layouts/js-custom-select',
  );
  assert.equal(
    customSelectPickerLayoutsJsRule.guideId,
    'custom-select-picker-layouts',
  );
  assert.equal(
    customSelectPickerLayoutsJsRule.guideHash,
    CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH,
  );

  assert.equal(customSelectPickerLayoutsRules.length, 1);
  assert.ok(customSelectPickerLayoutsJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(customSelectPickerLayoutsJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('custom-select-picker-layouts JS matcher', async (t) => {
  await t.test('flags Choices, TomSelect, SlimSelect, and select2 with custom option templates on single-select', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('picker.js', code);
    const matches = customSelectPickerLayoutsJsMatcher.matchFile(sourceFile, {
      filePath: 'picker.js',
      fileContent: code,
    });
    assert.equal(matches.length, 4);
  });

  await t.test('exempts multi-select, tags: true, ajax, maxItems > 1, or guarded calls', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('excluded.js', code);
    const matches = customSelectPickerLayoutsJsMatcher.matchFile(sourceFile, {
      filePath: 'excluded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts shadowed local Choices or TomSelect classes', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('shadowed.js', code);
    const matches = customSelectPickerLayoutsJsMatcher.matchFile(sourceFile, {
      filePath: 'shadowed.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
