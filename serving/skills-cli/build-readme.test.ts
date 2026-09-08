import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from '../../lib/paths.ts';
import { updateReadmeWithFeaturesAndUseCases, getFeaturesAndUseCases } from './build-readme.ts';

describe('updateReadmeWithFeaturesAndUseCases', () => {
  const testOutputDir = path.join(import.meta.dirname, 'test-readme-output');
  const dummyReadmePath = path.join(testOutputDir, 'README.md');
  const rootReadmePath = path.join(rootDir, 'README.md');

  before(() => {
    fs.mkdirSync(testOutputDir, { recursive: true });
    // Write a mock README with the markers
    fs.writeFileSync(
      dummyReadmePath,
      '# Test README\n\n<!-- INJECT_SKILL_COVERAGE_START -->\n<!-- INJECT_SKILL_COVERAGE_END -->\n\n## Installation'
    );
    // Create package.json to satisfy version parser
    fs.writeFileSync(path.join(testOutputDir, 'package.json'), JSON.stringify({ version: '1.2.3' }));

    // Populate mock built guides to satisfy scanAllGuides output path check
    const mockGuidesDir = path.join(testOutputDir, 'skills/modern-web-guidance/guides');
    fs.mkdirSync(path.join(mockGuidesDir, 'forms'), { recursive: true });
    fs.writeFileSync(path.join(mockGuidesDir, 'forms/autofill-address-form.md'), 'content');
    
    fs.mkdirSync(path.join(mockGuidesDir, 'performance'), { recursive: true });

    fs.mkdirSync(path.join(mockGuidesDir, 'ui-behaviors'), { recursive: true });
    fs.writeFileSync(path.join(mockGuidesDir, 'ui-behaviors/move-dom-element-without-losing-state.md'), 'content');
  });

  after(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  it('injects category-grouped use cases and explorer links into target README without mutating root README', () => {
    const rootReadmeBefore = fs.readFileSync(rootReadmePath, 'utf8');

    const result = updateReadmeWithFeaturesAndUseCases(testOutputDir);

    assert.ok(result.featuresCount > 0, 'Should have processed some web features');
    assert.ok(result.useCasesCount > 0, 'Should have processed some use cases');

    const content = fs.readFileSync(dummyReadmePath, 'utf8');
    assert.ok(content.includes('#### The full list'), 'Should inject correct heading');
    assert.ok(content.includes('<h3>'), 'Should contain category h3 elements');
    assert.match(content, /https:\/\/web-platform-dx\.github\.io\/web-features-explorer\/features\//, 'Should contain explorer feature links');
    assert.match(content, /https:\/\/github\.com\/GoogleChrome\/modern-web-guidance\/blob\/main\/skills\/modern-web-guidance\/guides\//, 'Should link use cases to GitHub blob files');

    assert.ok(content.includes('`&lt;iframe&gt;` loading state'), 'Should escape angle brackets in descriptions');

    // Ensure root README was not modified as a side effect
    const rootReadmeAfter = fs.readFileSync(rootReadmePath, 'utf8');
    assert.strictEqual(rootReadmeAfter, rootReadmeBefore, 'Root README.md must not be modified when running tests or targeting other directories');
  });

  it('supports updating multiple target directories in a single call', () => {
    const secondOutputDir = path.join(import.meta.dirname, 'test-readme-output-2');
    const secondReadmePath = path.join(secondOutputDir, 'README.md');

    try {
      fs.mkdirSync(secondOutputDir, { recursive: true });
      fs.writeFileSync(
        secondReadmePath,
        '# Second README\n\n<!-- INJECT_SKILL_COVERAGE_START -->\n<!-- INJECT_SKILL_COVERAGE_END -->\n'
      );

      const result = updateReadmeWithFeaturesAndUseCases([testOutputDir, secondOutputDir]);
      assert.ok(result.featuresCount > 0);

      const firstContent = fs.readFileSync(dummyReadmePath, 'utf8');
      const secondContent = fs.readFileSync(secondReadmePath, 'utf8');

      assert.ok(firstContent.includes('#### The full list'));
      assert.ok(secondContent.includes('#### The full list'));
    } finally {
      fs.rmSync(secondOutputDir, { recursive: true, force: true });
    }
  });

  it('getFeaturesAndUseCases returns non-empty collections without modifying disk', () => {
    const { allFeatureIds, readyGuides } = getFeaturesAndUseCases();
    assert.ok(allFeatureIds.size > 0);
    assert.ok(readyGuides.length > 0);
  });
});
