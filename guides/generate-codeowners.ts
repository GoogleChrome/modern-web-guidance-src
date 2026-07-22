import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const ATL_CONFIG_PATH = path.join(__dirname, 'atls.json');
const CODEOWNERS_PATH = path.join(REPO_ROOT, 'CODEOWNERS');

import { scanAllGuides } from '../lib/guide-validation.ts';
import { getFeatureGroups } from '../serving/lib/baseline.ts';

interface AtlConfig {
  default: Record<string, string | string[]>;
  web_features: Record<string, string | string[]>;
  web_features_groups: Record<string, string | string[]>;
}

function loadAtlConfig(): AtlConfig {
  try {
    const content = fs.readFileSync(ATL_CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to load ATL config from ${ATL_CONFIG_PATH}:`, err);
    process.exit(1);
  }
}

function getFormattedAtls(value: any): string | null {
  if (!value || value === 'TBD') return null;
  const atls = Array.isArray(value) ? value : [value];
  const filtered = atls.filter(atl => atl && atl !== 'TBD');
  if (filtered.length === 0) return null;
  return filtered.map(atl => `@${atl}`).join(' ');
}

export function generateAtlBlock(config: AtlConfig): string {
  const lines: string[] = [];

  lines.push('# @atls-start');
  lines.push('# Content reviewers for guide content mapped by category (automatically generated from guides/atls.json)');

  // 1. Generate category fallback rules
  const categories = Object.keys(config.default).sort();
  for (const category of categories) {
    const formattedAtls = getFormattedAtls(config.default[category]);
    if (!formattedAtls) continue;

    lines.push(`guides/${category}/*/ ${formattedAtls}`);
  }

  lines.push('');
  lines.push('# Specific guide overrides resolved dynamically');

  interface OverrideRule {
    category: string;
    name: string;
    reason: string;
    ruleLine: string;
  }

  const allGuides = scanAllGuides();
  const overrideRules: OverrideRule[] = [];

  for (const g of allGuides) {
    let resolvedValue = config.default[g.category];
    let ownershipReason = '';

    if (g.featureIds && g.featureIds.length > 0) {
      let foundOverride = false;
      // Check specific features first
      for (const fid of g.featureIds) {
        if (config.web_features[fid]) {
          resolvedValue = config.web_features[fid];
          ownershipReason = `feature "${fid}"`;
          foundOverride = true;
          break;
        }
      }
      // Check feature groups next
      if (!foundOverride) {
        for (const fid of g.featureIds) {
          const groups = getFeatureGroups(fid);
          for (const group of groups) {
            if (config.web_features_groups[group]) {
              resolvedValue = config.web_features_groups[group];
              ownershipReason = `group "${group}"`;
              foundOverride = true;
              break;
            }
          }
          if (foundOverride) break;
        }
      }
    }

    const defaultFormatted = getFormattedAtls(config.default[g.category]);
    const formattedAtls = getFormattedAtls(resolvedValue);
    if (!formattedAtls || formattedAtls === defaultFormatted) continue;

    overrideRules.push({
      category: g.category,
      name: g.name,
      reason: ownershipReason,
      ruleLine: `guides/${g.category}/${g.name}/ ${formattedAtls}`
    });
  }

  // Sort: category first, then reason, then name
  overrideRules.sort((a, b) => {
    const catComp = a.category.localeCompare(b.category);
    if (catComp !== 0) return catComp;

    const reasonComp = a.reason.localeCompare(b.reason);
    if (reasonComp !== 0) return reasonComp;

    return a.name.localeCompare(b.name);
  });

  // Print rules with non-repeating comments
  let lastReason = '';
  let lastCategory = '';
  for (const rule of overrideRules) {
    // Reset comment grouping when transitioning to a new category
    if (rule.category !== lastCategory) {
      lastReason = '';
      lastCategory = rule.category;
    }

    if (rule.reason && rule.reason !== lastReason) {
      lines.push(`# Owned via ${rule.reason}`);
      lastReason = rule.reason;
    }
    lines.push(rule.ruleLine);
  }

  lines.push('# @atls-end');
  return lines.join('\n');
}

function getExpectedFeatureToGroups(): Record<string, string[]> {
  const allGuides = scanAllGuides();
  const featureToGroups: Record<string, string[]> = {};
  for (const g of allGuides) {
    if (g.featureIds) {
      for (const fid of g.featureIds) {
        featureToGroups[fid] = getFeatureGroups(fid);
      }
    }
  }
  // Sort keys and values for deterministic JSON output
  const sorted: Record<string, string[]> = {};
  for (const key of Object.keys(featureToGroups).sort()) {
    sorted[key] = featureToGroups[key].sort();
  }
  return sorted;
}

export function updateCodeowners(checkOnly = false): boolean {
  const config = loadAtlConfig();
  const generatedBlock = generateAtlBlock(config);

  const expectedFeatureToGroups = getExpectedFeatureToGroups();
  const featureToGroupsPath = path.join(__dirname, 'feature-to-groups.generated.json');
  let currentFeatureToGroupsContent = '';
  try {
    currentFeatureToGroupsContent = fs.readFileSync(featureToGroupsPath, 'utf8');
  } catch {}

  const expectedFeatureToGroupsContent = JSON.stringify(expectedFeatureToGroups, null, 2);

  if (currentFeatureToGroupsContent !== expectedFeatureToGroupsContent) {
    if (checkOnly) {
      console.error('Error: guides/feature-to-groups.generated.json is out of date.');
      console.error('Please run: node guides/generate-codeowners.ts');
      return false;
    }
    try {
      fs.writeFileSync(featureToGroupsPath, expectedFeatureToGroupsContent, 'utf8');
      console.log('Successfully updated guides/feature-to-groups.generated.json.');
    } catch (err) {
      console.error('Failed to write feature-to-groups.generated.json:', err);
      process.exit(1);
    }
  }

  let codeownersContent = '';
  try {
    codeownersContent = fs.readFileSync(CODEOWNERS_PATH, 'utf8');
  } catch (err) {
    console.error(`Failed to read CODEOWNERS from ${CODEOWNERS_PATH}:`, err);
    process.exit(1);
  }

  const startMarker = '# @atls-start';
  const endMarker = '# @atls-end';

  const startIndex = codeownersContent.indexOf(startMarker);
  const endIndex = codeownersContent.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    console.error('Error: Could not find valid @atls-start and @atls-end markers in CODEOWNERS.');
    process.exit(1);
  }

  const before = codeownersContent.slice(0, startIndex);
  const after = codeownersContent.slice(endIndex + endMarker.length);
  const expectedContent = before + generatedBlock + after;

  if (codeownersContent === expectedContent) {
    console.log('CODEOWNERS is already up to date with guides/atls.json.');
    return true;
  }

  if (checkOnly) {
    console.error('Error: CODEOWNERS is out of date with guides/atls.json.');
    console.error('Please run: node guides/generate-codeowners.ts');
    return false;
  }

  try {
    fs.writeFileSync(CODEOWNERS_PATH, expectedContent, 'utf8');
    console.log('Successfully updated CODEOWNERS with category ATLs.');
    return true;
  } catch (err) {
    console.error('Failed to write to CODEOWNERS:', err);
    process.exit(1);
  }
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const success = updateCodeowners(checkOnly);
  if (!success) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
