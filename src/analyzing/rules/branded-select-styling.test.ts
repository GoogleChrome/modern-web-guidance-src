import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import type { DependencyRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  brandedSelectStylingJsRule,
  brandedSelectStylingRule,
  brandedSelectStylingRules,
} from './branded-select-styling.ts';

const depMatcher = brandedSelectStylingRule.matcher as DependencyRuleMatcher;
const jsMatcher = brandedSelectStylingJsRule.matcher as JsRuleMatcher;

void test('branded-select-styling: rule metadata', () => {
  assert.equal(brandedSelectStylingRule.id, 'branded-select-styling');
  assert.equal(brandedSelectStylingJsRule.id, 'branded-select-styling/js');
  assert.equal(brandedSelectStylingRules.length, 0);
});

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
    const project = createInMemoryProject();
    const code = `
      $(document).ready(function() {
        $('#country-select').select2({ placeholder: 'Select a country' });
      });
    `;
    const sourceFile = project.createSourceFile('form.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'form.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /select2/);
  });

  await t.test('flags $(".selectpicker").selectpicker("render") from grocy', () => {
    const project = createInMemoryProject();
    const code = `
      function refreshPickers() {
        $('.selectpicker').selectpicker('render');
      }
    `;
    const sourceFile = project.createSourceFile('pickers.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'pickers.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /selectpicker/);
  });

  await t.test('flags $(...).chosen() call', () => {
    const project = createInMemoryProject();
    const code = `
      $('#dept').chosen({ no_results_text: 'Oops, nothing found!' });
    `;
    const sourceFile = project.createSourceFile('dept.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'dept.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /chosen/);
  });

  await t.test('flags $(...).niceSelect() call', () => {
    const project = createInMemoryProject();
    const code = `
      $('select.custom-style').niceSelect();
    `;
    const sourceFile = project.createSourceFile('select.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'select.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /niceSelect/);
  });
});

void test('branded-select-styling JS: negative / exempt cases', async (t) => {
  await t.test('exempts select2 call guarded by CSS.supports for appearance: base-select', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('appearance: base-select')) {
        $('#select').select2();
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts native select manipulation without custom select plugin calls', () => {
    const project = createInMemoryProject();
    const code = `
      const sel = document.querySelector('select');
      sel.value = 'option2';
      sel.addEventListener('change', (e) => console.log(e.target.value));
    `;
    const sourceFile = project.createSourceFile('native.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'native.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts select2 with liveSearch, tags, or ajax search options', () => {
    const project = createInMemoryProject();
    const code = `
      $('#select-search').select2({
        ajax: { url: '/api/tags' },
        tags: true,
      });
    `;
    const sourceFile = project.createSourceFile('searchable.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'searchable.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
