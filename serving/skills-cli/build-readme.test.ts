import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { updateReadmeWithFeaturesAndUseCases } from './build-readme.ts';

describe('updateReadmeWithFeaturesAndUseCases', () => {
  const testOutputDir = path.join(import.meta.dirname, 'test-readme-output');
  const dummyReadmePath = path.join(testOutputDir, 'README.md');

  before(() => {
    fs.mkdirSync(testOutputDir, { recursive: true });
    // Write a mock README with the placeholder
    fs.writeFileSync(dummyReadmePath, '# Test README\n\n<!-- INJECT_SKILL_COVERAGE -->\n\n## Installation');
    // Create package.json to satisfy version parser
    fs.writeFileSync(path.join(testOutputDir, 'package.json'), JSON.stringify({ version: '1.2.3' }));

    // Populate mock built guides to satisfy scanAllGuides output path check
    const mockGuidesDir = path.join(testOutputDir, 'skills/modern-web-guidance/guides');
    fs.mkdirSync(path.join(mockGuidesDir, 'forms'), { recursive: true });
    fs.writeFileSync(path.join(mockGuidesDir, 'forms/autofill-address-form.md'), 'content');
    
    fs.mkdirSync(path.join(mockGuidesDir, 'performance'), { recursive: true });

    fs.mkdirSync(path.join(mockGuidesDir, 'user-experience'), { recursive: true });
    fs.writeFileSync(path.join(mockGuidesDir, 'user-experience/move-dom-element-without-losing-state.md'), 'content');
  });

  after(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  it('injects category-grouped use cases and explorer links into README', () => {
    const result = updateReadmeWithFeaturesAndUseCases(testOutputDir);

    assert.ok(result.featuresCount > 0, 'Should have processed some web features');
    assert.ok(result.useCasesCount > 0, 'Should have processed some use cases');

    const content = fs.readFileSync(dummyReadmePath, 'utf8');
    assert.ok(content.includes('#### The full list'), 'Should inject correct heading');
    assert.ok(content.includes('<h3>'), 'Should contain category h3 elements');
    assert.match(content, /https:\/\/web-platform-dx\.github\.io\/web-features-explorer\/features\//, 'Should contain explorer feature links');
    assert.match(content, /https:\/\/github\.com\/GoogleChrome\/modern-web-guidance\/blob\/main\/skills\/modern-web-guidance\/guides\//, 'Should link use cases to GitHub blob files');

    assert.ok(content.includes('&lt;iframe&gt; loading state'), 'Should escape angle brackets in descriptions');
  });
});
