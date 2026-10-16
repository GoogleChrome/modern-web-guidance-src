import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  customSelectDependencyMatcher,
  customSelectJsMatcher,
} from './custom-select-picker-layouts.ts';

const depMatcher = customSelectDependencyMatcher;
const jsMatcher = customSelectJsMatcher;

void test('custom-select-picker-layouts dependency matcher', async (t) => {
  await t.test('flags choices.js in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'choices.js': '^10.2.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /choices\.js/);
  });

  await t.test('flags tom-select in devDependencies', () => {
    const pkg = JSON.stringify(
      {
        devDependencies: {
          'tom-select': '^2.2.2',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /tom-select/);
  });

  await t.test('flags downshift in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          downshift: '^8.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /downshift/);
  });

  await t.test('flags react-select in dependencies (bestofjs pattern)', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'react-select': '^5.7.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /react-select/);
  });

  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          vue: '^3.3.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('custom-select-picker-layouts JS matcher', async (t) => {
  await t.test('flags new TomSelect (lobsters pattern)', () => {
    const project = createInMemoryProject();
    const code = `
      this.tom = new TomSelect('#story_tags', {
        plugins: ['remove_button'],
        maxItems: 3,
      });
    `;
    const sourceFile = project.createSourceFile('user.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'user.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /TomSelect/);
  });

  await t.test('flags new Choices initialization', () => {
    const project = createInMemoryProject();
    const code = `
      const choices = new Choices(document.querySelector('.js-choice'), {
        searchEnabled: true,
      });
    `;
    const sourceFile = project.createSourceFile('form.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'form.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Choices/);
  });

  await t.test('exempts when guarded by base-select check', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('appearance: base-select')) {
        new Choices('#my-select');
      }
    `;
    const sourceFile = project.createSourceFile('fallback.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'fallback.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated class instantiations', () => {
    const project = createInMemoryProject();
    const code = `
      const instance = new CustomPicker();
    `;
    const sourceFile = project.createSourceFile('picker.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'picker.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
