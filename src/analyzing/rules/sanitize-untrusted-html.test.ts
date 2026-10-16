import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  sanitizerDependencyMatcher,
  sanitizerJsMatcher,
} from './sanitize-untrusted-html.ts';

const depMatcher = sanitizerDependencyMatcher;
const jsMatcher = sanitizerJsMatcher;

void test('sanitize-untrusted-html dependency matcher', async (t) => {
  await t.test('flags dompurify in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          dompurify: '^3.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /dompurify/);
  });

  await t.test('flags isomorphic-dompurify in devDependencies', () => {
    const pkg = JSON.stringify(
      {
        devDependencies: {
          'isomorphic-dompurify': '^2.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /isomorphic-dompurify/);
  });

  await t.test('flags sanitize-html in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'sanitize-html': '^2.11.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /sanitize-html/);
  });

  await t.test('flags xss in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          xss: '^1.0.14',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /xss/);
  });

  await t.test('flags insane in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          insane: '^2.6.2',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /insane/);
  });

  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          express: '^4.18.2',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('sanitize-untrusted-html JS matcher', async (t) => {
  await t.test('flags direct el.innerHTML = DOMPurify.sanitize(input)', () => {
    const project = createInMemoryProject();
    const code = `
      const target = document.getElementById('preview');
      target.innerHTML = DOMPurify.sanitize(userInput);
    `;
    const sourceFile = project.createSourceFile('preview.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'preview.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /innerHTML/);
  });

  await t.test('flags local variable assigned to innerHTML (cyberchef pattern)', () => {
    const project = createInMemoryProject();
    const code = `
      const clean = DOMPurify.sanitize(name);
      item.innerHTML = clean;
    `;
    const sourceFile = project.createSourceFile('recipe.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'recipe.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /innerHTML/);
  });

  await t.test('flags el.insertAdjacentHTML with sanitized html', () => {
    const project = createInMemoryProject();
    const code = `
      container.insertAdjacentHTML('beforeend', DOMPurify.sanitize(content));
    `;
    const sourceFile = project.createSourceFile('render.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'render.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /insertAdjacentHTML/);
  });

  await t.test('flags jQuery .html() with sanitizeHtml', () => {
    const project = createInMemoryProject();
    const code = `
      $('#output').html(sanitizeHtml(dirtyHtml));
    `;
    const sourceFile = project.createSourceFile('view.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'view.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /html/);
  });

  await t.test('flags React dangerouslySetInnerHTML with DOMPurify.sanitize', () => {
    const project = createInMemoryProject();
    const code = `
      function PostContent({ html }) {
        return (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
        );
      }
    `;
    const sourceFile = project.createSourceFile('Post.tsx', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'Post.tsx',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /dangerouslySetInnerHTML/);
  });

  await t.test('exempts when guarded by native setHTML feature check', () => {
    const project = createInMemoryProject();
    const code = `
      if ('setHTML' in Element.prototype) {
        el.setHTML(html);
      } else {
        el.innerHTML = DOMPurify.sanitize(html);
      }
    `;
    const sourceFile = project.createSourceFile('fallback.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'fallback.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts safe plain text assignments', () => {
    const project = createInMemoryProject();
    const code = `
      el.innerHTML = '<span>Static Label</span>';
    `;
    const sourceFile = project.createSourceFile('static.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'static.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
