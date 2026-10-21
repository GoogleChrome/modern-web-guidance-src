import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH,
  customSelectPickerLayoutsJsMatcher,
  customSelectPickerLayoutsJsRule,
  customSelectPickerLayoutsPackageMatcher,
  customSelectPickerLayoutsPackageRule,
  customSelectPickerLayoutsRules,
} from './custom-select-picker-layouts.ts';

void test('custom-select-picker-layouts: rule metadata', () => {
  assert.equal(
    customSelectPickerLayoutsPackageRule.id,
    'custom-select-picker-layouts/package-custom-select',
  );
  assert.equal(
    customSelectPickerLayoutsPackageRule.guideId,
    'custom-select-picker-layouts',
  );
  assert.equal(
    customSelectPickerLayoutsPackageRule.guideHash,
    CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH,
  );
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

  assert.equal(customSelectPickerLayoutsRules.length, 2);
  assert.ok(customSelectPickerLayoutsPackageRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(customSelectPickerLayoutsPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(customSelectPickerLayoutsJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(customSelectPickerLayoutsJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('custom-select-picker-layouts dependency matcher', async (t) => {
  await t.test('flags choices.js, tom-select, select2, and slim-select', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'choices.js': '^10.2.0',
          'tom-select': '^2.3.1',
          select2: '^4.1.0-rc.0',
          'slim-select': '^2.8.2',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      customSelectPickerLayoutsPackageMatcher,
    ]);
    assert.equal(matches.length, 4);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          react: '^18.2.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      customSelectPickerLayoutsPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
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

      if (!CSS.supports('appearance', 'base-select')) {
        new Choices('#fallback-picker', {
          callbackOnCreateTemplates: (t) => ({}),
        });
      }
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
