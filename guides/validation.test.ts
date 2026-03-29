import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

// Import shared utilities (using relative paths from guides/ worktree)
import { scanAllGuides } from '../harness/lib/utils.ts';
import { validateMacros } from '../serving/mcp-server/lib/macros.ts';
import { validateFeature } from '../serving/mcp-server/data/baseline.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

describe('Guides Validation', () => {
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
      const guidePath = path.join(guide.dir, 'guide.md');
      const demoPath = path.join(guide.dir, 'demo.html');

      const hasGuide = fs.existsSync(guidePath);
      const hasDemo = fs.existsSync(demoPath);

      // 1. File pairing check
      if (hasGuide || guide.isStub) {
        assert.ok(hasDemo, `Missing demo.html for guide ${relativeDir}`);
      }
      if (hasDemo) {
        assert.ok(hasGuide || guide.isStub, `Missing guide.md for demo ${relativeDir}`);
      }

      if (!hasGuide && !guide.isStub) {
        return; // Skip structural checks if guide doesn't exist yet
      }

      // 2. Validate Frontmatter
      const content = fs.readFileSync(guidePath, 'utf8');
      const { data, content: body } = matter(content);

      assert.ok(data.name, `Missing "name" in frontmatter of ${relativeDir}`);
      assert.ok(data.description, `Missing "description" in frontmatter of ${relativeDir}`);

      const featureIds = data['web-feature-ids'];
      assert.ok(featureIds !== undefined, `Missing "web-feature-ids" in frontmatter of ${relativeDir}`);
      assert.ok(Array.isArray(featureIds), `"web-feature-ids" must be an array in ${relativeDir}`);

      // 3. Validate Features
      for (const id of featureIds) {
        const result = validateFeature(id);
        assert.ok(result.isValid, `${result.errorMessage} (${relativeDir})`);
      }

      // 4. Validate Macros
      const macroErrors = validateMacros(body, relativeDir);
      assert.strictEqual(macroErrors.length, 0, `Macro errors in ${relativeDir}:\n${macroErrors.join('\n')}`);
    });
  }
});
