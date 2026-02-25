import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { features } from 'web-features';

const guidesDir = path.resolve(import.meta.dirname, '..');

function getMdFiles(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes('/test')) {
        getMdFiles(filePath, fileList);
      }
    } else if (filePath.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

test('all web-feature-ids in guides are valid', async (t) => {
  const mdFiles = getMdFiles(guidesDir);
  const validFeatures = new Set(Object.keys(features));

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    if (!content.startsWith('---')) continue;
    
    const parts = content.split('---');
    if (parts.length < 3) continue;

    const frontmatter = parts[1];
    let parsed: any;
    try {
      parsed = yaml.load(frontmatter);
    } catch (e) {
      assert.fail(`Could not parse YAML in ${path.relative(guidesDir, file)}: ${e}`);
    }

    if (parsed && typeof parsed === 'object' && parsed['web-feature-ids']) {
      const featureIds = Array.isArray(parsed['web-feature-ids']) 
        ? parsed['web-feature-ids'] 
        : [parsed['web-feature-ids']];

      for (const id of featureIds) {
        await t.test(`File ${path.relative(guidesDir, file)} has valid feature ID: ${id}`, () => {
          assert.ok(validFeatures.has(id), `Invalid web-feature-id '${id}' found in ${path.relative(guidesDir, file)}`);
        });
      }
    }
  }
});
