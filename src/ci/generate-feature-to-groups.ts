import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOwnedFeatureToGroups } from '../core/baseline.ts';
import { rootDir } from '../core/paths.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ATL_CONFIG_PATH = path.join(rootDir, '.github', 'atls.json');
export const FEATURE_TO_GROUPS_PATH = path.join(rootDir, 'src', 'ci', 'feature-to-groups.gen.json');

/**
 * Builds the feature-to-groups cache that atl-triage.ts reads. The triage
 * workflow runs without installing dependencies, so it can't query
 * web-features directly. The cache depends only on atls.json, web-features,
 * and features/pending-web-features.json.
 */
export function buildFeatureToGroupsJson(): string {
  const atlConfig = JSON.parse(fs.readFileSync(ATL_CONFIG_PATH, 'utf8'));
  const ownedGroups = new Set(Object.keys(atlConfig.web_features_groups));
  return JSON.stringify(getOwnedFeatureToGroups(ownedGroups), null, 2) + '\n';
}

if (process.argv[1] === __filename) {
  const expected = buildFeatureToGroupsJson();
  const current = fs.existsSync(FEATURE_TO_GROUPS_PATH) ? fs.readFileSync(FEATURE_TO_GROUPS_PATH, 'utf8') : '';
  if (process.argv.includes('--check')) {
    if (current !== expected) {
      console.error('src/ci/feature-to-groups.gen.json is out of date. Run: node src/ci/generate-feature-to-groups.ts');
      process.exit(1);
    }
    console.log('src/ci/feature-to-groups.gen.json is up to date.');
  } else {
    fs.writeFileSync(FEATURE_TO_GROUPS_PATH, expected);
    console.log('Updated src/ci/feature-to-groups.gen.json.');
  }
}
