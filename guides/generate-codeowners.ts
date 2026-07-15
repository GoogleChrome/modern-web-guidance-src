import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const ATL_CONFIG_PATH = path.join(__dirname, 'atls.json');
const CODEOWNERS_PATH = path.join(REPO_ROOT, 'CODEOWNERS');

interface AtlConfig {
  [category: string]: string | string[];
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

export function generateAtlBlock(config: AtlConfig): string {
  const categories = Object.keys(config).sort();
  const lines: string[] = [];

  lines.push('# @atls-start');
  lines.push('# Content reviewers for guide content mapped by category (automatically generated from guides/atls.json)');

  for (const category of categories) {
    const value = config[category];
    const atls = Array.isArray(value) ? value : [value];
    const formattedAtls = atls.map(atl => `@${atl}`).join(' ');

    lines.push(`guides/${category}/*/ ${formattedAtls}`);
    lines.push(`guides/${category}/SKILL.md ${formattedAtls}`);
    lines.push(''); // Empty line after each category for spacing
  }

  // Remove the trailing empty line from the last category before ending the block
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.push('# @atls-end');
  return lines.join('\n');
}

export function updateCodeowners(checkOnly = false): boolean {
  const config = loadAtlConfig();
  const generatedBlock = generateAtlBlock(config);

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
