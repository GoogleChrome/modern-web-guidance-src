import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import type { DependencyRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  brandedSelectStylingJsRule,
  brandedSelectStylingRule
} from './branded-select-styling.ts';

const depMatcher = brandedSelectStylingRule.matcher as DependencyRuleMatcher;
const jsMatcher = brandedSelectStylingJsRule.matcher as JsRuleMatcher;
void test('branded-select-styling dependency: positive brownfield matches', async (t) => {
  await t.test('flags select2 in dependencies', () => {
    const pkg = JSON.stringify(
      {
        name: 'my-app',
        dependencies: {
          select2: '^4.1.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /select2/);
  });

  await t.test('flags bootstrap-select in peerDependencies', () => {
    const pkg = JSON.stringify(
      {
        name: 'grocy',
        peerDependencies: {
          'bootstrap-select': '^1.13.18',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /bootstrap-select/);
  });

  await t.test('flags chosen-js in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'chosen-js': '^1.8.7',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /chosen-js/);
  });
});

void test('branded-select-styling dependency: negative / exempt cases', async (t) => {
  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          react: '^18.0.0',
          lodash: '^4.17.21',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('branded-select-styling JS: positive brownfield matches', async (t) => {
  await t.test('flags $(...).select2() call', () => {
    const code = `
      $(document).ready(function() {
        $('#country-select').select2({ placeholder: 'Select a country' });
      });
    `;
    const matches = matchJsRule(jsMatcher, 'form.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /select2/);
  });

  await t.test('flags $(".selectpicker").selectpicker("render") from grocy', () => {
    const code = `
      function refreshPickers() {
        $('.selectpicker').selectpicker('render');
      }
    `;
    const matches = matchJsRule(jsMatcher, 'pickers.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /selectpicker/);
  });

  await t.test('flags $(...).chosen() call', () => {
    const code = `
      $('#dept').chosen({ no_results_text: 'Oops, nothing found!' });
    `;
    const matches = matchJsRule(jsMatcher, 'dept.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /chosen/);
  });

  await t.test('flags $(...).niceSelect() call', () => {
    const code = `
      $('select.custom-style').niceSelect();
    `;
    const matches = matchJsRule(jsMatcher, 'select.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /niceSelect/);
  });

  await t.test('flags Backbone this.$el.find(...).chosen() and this.$(...).chosen() calls', () => {
    const code = `
      var MetadataView = Backbone.View.extend({
        render: function() {
          this.$el.find('.chzn-select').chosen().change(this.updateModel);
          this.$('select.branch-select').chosen();
        }
      });
    `;
    const matches = matchJsRule(jsMatcher, 'metadata.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [4, 5],
    );
  });
});

void test('branded-select-styling JS: negative / exempt cases', async (t) => {
  await t.test('exempts non-jQuery .chosen() method calls', () => {
    const code = `
      this.chosen();
      this.model.chosen();
      picker.getItem($index).chosen();
    `;
    const matches = matchJsRule(jsMatcher, 'non-jquery.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts select2 call guarded by CSS.supports for appearance: base-select', () => {
    const code = `
      if (!CSS.supports('appearance: base-select')) {
        $('#select').select2();
      }
    `;
    const matches = matchJsRule(jsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts native select manipulation without custom select plugin calls', () => {
    const code = `
      const sel = document.querySelector('select');
      sel.value = 'option2';
      sel.addEventListener('change', (e) => console.log(e.target.value));
    `;
    const matches = matchJsRule(jsMatcher, 'native.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts select2 with liveSearch, tags, or ajax search options', () => {
    const code = `
      $('#select-search').select2({
        ajax: { url: '/api/tags' },
        tags: true,
      });
    `;
    const matches = matchJsRule(jsMatcher, 'searchable.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags chosen combobox initialization', () => {
    const code = `
      $('.chzn-select').chosen({ disable_search_threshold: 10 });
    `;
    const matches = matchJsRule(jsMatcher, 'chosen.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /chosen/);
  });
});
