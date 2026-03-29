import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';

// Import shared utilities
import { scanAllGuides, processGuideInventory } from '../lib/guide-validation.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

describe('Guides Validation (Single Source of Truth)', () => {
  const guides = scanAllGuides();

  if (guides.length === 0) {
    test('No guides found', () => {
      assert.fail('No guides found in the workspace');
    });
    return;
  }

  for (const guide of guides) {
    const relativeDir = path.relative(REPO_ROOT, guide.dir);

    it(`validates ${relativeDir}`, () => {
      const result = processGuideInventory([guide]);
      
      if (result.hasError) {
        assert.fail(`Validation errors found in ${relativeDir}:\n${result.errors.join('\n')}`);
      }
    });
  }
});
