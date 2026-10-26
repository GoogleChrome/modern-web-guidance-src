import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  COPY_BUTTON_GUIDE_HASH,
  copyButtonJsMatcher,
  copyButtonJsRule,
  copyButtonPackageMatcher,
  copyButtonPackageRule,
  copyButtonRules,
} from './copy-button.ts';

void test('copy-button: rule metadata', () => {
  assert.equal(copyButtonJsRule.id, 'copy-button/exec-command');
  assert.equal(copyButtonJsRule.guideId, 'copy-button');
  assert.equal(copyButtonJsRule.guideHash, COPY_BUTTON_GUIDE_HASH);
  assert.equal(COPY_BUTTON_GUIDE_HASH.length, 12);

  assert.equal(copyButtonPackageRule.id, 'copy-button/package-clipboard');
  assert.equal(copyButtonPackageRule.guideId, 'copy-button');
  assert.equal(copyButtonPackageRule.guideHash, COPY_BUTTON_GUIDE_HASH);

  assert.equal(copyButtonRules.length, 2);
  assert.ok(copyButtonJsRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(copyButtonJsRule.verifierRubric.dropWhen.length >= 1);
});

void test('copy-button JS matcher: document.execCommand("copy")', async (t) => {
  await t.test('flags document.execCommand("copy") and execCommand("copy")', () => {
    const project = createInMemoryProject();
    const code = `
      function copyText(val) {
        const input = document.createElement('textarea');
        input.value = val;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      function copyAlternative() {
        execCommand('copy');
      }
    `;
    const sourceFile = project.createSourceFile('copy.js', code);
    const matches = copyButtonJsMatcher.matchFile(sourceFile, {
      filePath: 'copy.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /navigator\.clipboard\.writeText/);
    assert.equal(matches[0]?.line, 7);
    assert.equal(matches[1]?.line, 12);
  });

  await t.test('ignores non-copy execCommand commands like bold, italic, paste', () => {
    const project = createInMemoryProject();
    const code = `
      function formatDoc() {
        document.execCommand('bold');
        document.execCommand('italic');
        document.execCommand('fontSize', false, '3');
      }
    `;
    const sourceFile = project.createSourceFile('editor.js', code);
    const matches = copyButtonJsMatcher.matchFile(sourceFile, {
      filePath: 'editor.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('drops execCommand("copy") when guarded by navigator.clipboard check (unsupported-browser fallback)', () => {
    const project = createInMemoryProject();
    const code = `
      async function copySmart(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      }
    `;
    const sourceFile = project.createSourceFile('smartCopy.js', code);
    const matches = copyButtonJsMatcher.matchFile(sourceFile, {
      filePath: 'smartCopy.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0, 'Guarded fallback should not produce findings');
  });

  await t.test('drops execCommand("copy") when guarded by "clipboard" in navigator', () => {
    const project = createInMemoryProject();
    const code = `
      function copyWithIn(text) {
        if ('clipboard' in navigator) {
          navigator.clipboard.writeText(text);
        } else {
          document.execCommand('copy');
        }
      }
    `;
    const sourceFile = project.createSourceFile('copyIn.js', code);
    const matches = copyButtonJsMatcher.matchFile(sourceFile, {
      filePath: 'copyIn.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0, 'In-operator guarded fallback should not produce findings');
  });

  await t.test('flags new ClipboardJS and new Clipboard from "clipboard" package', () => {
    const project = createInMemoryProject();
    const code = `
      import Clipboard from 'clipboard';

      const btn1 = new ClipboardJS('.btn-copy-1');
      const btn2 = new Clipboard('.btn-copy-2');
      const unrelated = new UnrelatedClass('.something');
    `;
    const sourceFile = project.createSourceFile('clipboardBtn.ts', code);
    const matches = copyButtonJsMatcher.matchFile(sourceFile, {
      filePath: 'clipboardBtn.ts',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /ClipboardJS/);
    assert.match(matches[1]?.message ?? '', /Clipboard from "clipboard"/);
  });

  await t.test('ignores files named clipboard.js / clipboard.min.js (library implementation itself)', () => {
    const project = createInMemoryProject();
    const code = `
      function copyAction() {
        document.execCommand('copy');
      }
    `;
    const sourceFile = project.createSourceFile('dist/clipboard.min.js', code);
    const matches = copyButtonJsMatcher.matchFile(sourceFile, {
      filePath: 'dist/clipboard.min.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0, 'Library implementation file should be exempt');
  });
});

void test('copy-button package matcher', () => {
  const result = copyButtonPackageMatcher.matchPackage?.('clipboard', '^2.0.8', {
    filePath: 'package.json',
    packageJson: { dependencies: { clipboard: '^2.0.8' } },
  });
  assert.ok(result);
  assert.match(result.message, /navigator\.clipboard\.writeText/);
});
