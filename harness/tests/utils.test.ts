import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { inventoryGuide, scanAllGuides } from '../../lib/guide-validation.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'utils-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('inventoryGuide detects missing files when directory is empty', () => {
  const tempDir = createTempDir();
  try {
    const inv = inventoryGuide(tempDir, new Map());
    assert.strictEqual(inv.hasGuide, false);
    assert.strictEqual(inv.hasDemo, false);
    assert.strictEqual(inv.hasGrader, false);
    assert.strictEqual(inv.hasPrompts, false);
    assert.strictEqual(inv.hasExpectations, false);
  } finally {
    removeTempDir(tempDir);
  }
});

test('inventoryGuide detects guide.md', () => {
  const tempDir = createTempDir();
  try {
    const useCase = path.join(tempDir, 'my-use-case');
    fs.mkdirSync(useCase);
    fs.writeFileSync(path.join(useCase, 'guide.md'), 'content');
    const inv = inventoryGuide(useCase, new Map());
    assert.strictEqual(inv.hasGuide, true);
  } finally {
    removeTempDir(tempDir);
  }
});

test('inventoryGuide detects stub guide.md', () => {
  const tempDir = createTempDir();
  try {
    const useCase = path.join(tempDir, 'my-use-case');
    fs.mkdirSync(useCase);
    fs.writeFileSync(path.join(useCase, 'guide.md'), `---
name: my-use-case
---`);
    const inv = inventoryGuide(useCase, new Map());
    assert.strictEqual(inv.isStub, true);
    assert.strictEqual(inv.hasGuide, false); // No content outside frontmatter
  } finally {
    removeTempDir(tempDir);
  }
});

test('inventoryGuide detects demo.html', () => {
  const tempDir = createTempDir();
  try {
    const useCase = path.join(tempDir, 'my-use-case');
    fs.mkdirSync(useCase);
    fs.writeFileSync(path.join(useCase, 'demo.html'), '<html></html>');
    const inv = inventoryGuide(useCase, new Map());
    assert.strictEqual(inv.hasDemo, true);
  } finally {
    removeTempDir(tempDir);
  }
});

test('inventoryGuide detects grader.ts', () => {
  const tempDir = createTempDir();
  try {
    const useCase = path.join(tempDir, 'my-use-case');
    fs.mkdirSync(useCase);
    fs.writeFileSync(path.join(useCase, 'grader.ts'), 'export {}');
    const inv = inventoryGuide(useCase, new Map());
    assert.strictEqual(inv.hasGrader, true);
  } finally {
    removeTempDir(tempDir);
  }
});

test('inventoryGuide detects prompts.md', () => {
  const tempDir = createTempDir();
  try {
    const useCase = path.join(tempDir, 'my-use-case');
    fs.mkdirSync(useCase);
    fs.writeFileSync(path.join(useCase, 'prompts.md'), 'prompts');
    const inv = inventoryGuide(useCase, new Map());
    assert.strictEqual(inv.hasPrompts, true);
  } finally {
    removeTempDir(tempDir);
  }
});

test('inventoryGuide parses feature IDs from guide.md', () => {
  const tempDir = createTempDir();
  try {
    const useCase = path.join(tempDir, 'my-use-case');
    fs.mkdirSync(useCase);
    fs.writeFileSync(path.join(useCase, 'guide.md'), `---
web-feature-ids:
  - dialog-closedby
  - view-transitions
---
Some content.`);
    const inv = inventoryGuide(useCase, new Map());
    assert.deepStrictEqual(inv.featureIds, ['dialog-closedby', 'view-transitions']);
  } finally {
    removeTempDir(tempDir);
  }
});

test('inventoryGuide detects expectations.md empty state', () => {
  const tempDir = createTempDir();
  try {
    const useCase = path.join(tempDir, 'my-use-case');
    fs.mkdirSync(useCase);
    fs.writeFileSync(path.join(useCase, 'expectations.md'), '');
    const inv = inventoryGuide(useCase, new Map());
    assert.strictEqual(inv.hasExpectations, true);
    assert.strictEqual(inv.expectationsEmpty, true);
  } finally {
    removeTempDir(tempDir);
  }
});

test('scanAllGuides finds actual use cases in repo', () => {
  const guides = scanAllGuides();
  assert.ok(Array.isArray(guides));
  assert.ok(guides.length > 0, 'Repo should have at least one use case directory');
});

test('scanAllGuides ignores .git-like directories (starting with .)', () => {
  const tempDir = createTempDir();
  try {
    const guidesDir = path.join(tempDir, 'guides');
    const categoryDir = path.join(guidesDir, '.git');
    fs.mkdirSync(categoryDir, { recursive: true });
    fs.writeFileSync(path.join(categoryDir, 'guide.md'), 'content');
    
    const guides = scanAllGuides(guidesDir);
    assert.strictEqual(guides.length, 0);
  } finally {
    removeTempDir(tempDir);
  }
});

test('scanAllGuides skips node_modules directories at category level', () => {
  const tempDir = createTempDir();
  try {
    const guidesDir = path.join(tempDir, 'guides');
    const categoryDir = path.join(guidesDir, 'node_modules');
    fs.mkdirSync(categoryDir, { recursive: true });
    fs.writeFileSync(path.join(categoryDir, 'guide.md'), 'content');
    
    const guides = scanAllGuides(guidesDir);
    assert.strictEqual(guides.length, 0);
  } finally {
    removeTempDir(tempDir);
  }
});

test('scanAllGuides works with standard category/guide structure', () => {
  const tempDir = createTempDir();
  try {
    const guidesDir = path.join(tempDir, 'guides');
    const categoryDir = path.join(guidesDir, 'user-experience');
    const guideDir = path.join(categoryDir, 'my-use-case');
    fs.mkdirSync(guideDir, { recursive: true });
    fs.writeFileSync(path.join(guideDir, 'guide.md'), 'content');
    
    const guides = scanAllGuides(guidesDir);
    assert.strictEqual(guides.length, 1);
    assert.ok(guides[0].dir.includes('my-use-case'));
  } finally {
    removeTempDir(tempDir);
  }
});
