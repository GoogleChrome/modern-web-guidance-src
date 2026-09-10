import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractFeatureIds } from '../lib/feature-parser.ts';
import { getTranscludedFeatureIds } from '../serving/lib/macro-parsing.ts';

// Define content file name constants inline to avoid importing from 'lib/guide-validation.ts'
// which would transitively require external packages (like 'gray-matter' and 'marked')
// in the GitHub Actions runner, slowing down the triage job.
export const GUIDE_FILE = 'guide.md';
export const SKILL_FILE = 'SKILL.md';
export const EXPECTATIONS_FILE = 'expectations.md';
export const DEMO_FILE = 'demo.html';

export const SME_CONTENT_FILENAMES = new Set([GUIDE_FILE, DEMO_FILE, EXPECTATIONS_FILE, SKILL_FILE]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_GUIDES_DIR = path.join(path.resolve(__dirname, '..'), 'guides');
const NON_CATEGORY_DIRS = new Set(['lib', 'node_modules', 'modern-web-guidance']);

function isCategoryDirectory(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    // If it contains a guide.md directly (e.g. discipline guide like guides/css/guide.md)
    if (entries.some(e => e.isFile() && e.name === GUIDE_FILE)) {
      return true;
    }
    // If it contains child directories with guide files
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const subDirPath = path.join(dirPath, entry.name);
        const subEntries = fs.readdirSync(subDirPath, { withFileTypes: true });
        if (subEntries.some(e => e.isFile() && (e.name === GUIDE_FILE || e.name === DEMO_FILE || e.name === EXPECTATIONS_FILE))) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

export function getKnownCategories(
  guidesRootDir: string = DEFAULT_GUIDES_DIR,
  atlConfig?: AtlConfig
): Set<string> {
  const categories = new Set<string>([
    'accessibility',
    'built-in-ai',
    'css',
    'forms',
    'html',
    'js',
    'motion',
    'performance',
    'privacy',
    'pwa',
    'security',
    'ui-atoms',
    'ui-behaviors',
    'ui-components',
    'visual-design',
    'webmcp'
  ]);

  if (atlConfig?.default) {
    for (const cat of Object.keys(atlConfig.default)) {
      categories.add(cat.toLowerCase());
    }
  }

  try {
    if (fs.existsSync(guidesRootDir)) {
      const entries = fs.readdirSync(guidesRootDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || NON_CATEGORY_DIRS.has(entry.name)) {
          continue;
        }
        if (isCategoryDirectory(path.join(guidesRootDir, entry.name))) {
          categories.add(entry.name.toLowerCase());
        }
      }
    }
  } catch (err) {
    console.warn(`Could not discover categories from ${guidesRootDir}:`, err);
  }

  return categories;
}

export const KNOWN_CATEGORIES = getKnownCategories();

export function isSmeContentFile(file: string): boolean {
  let normalized = file.replace(/^\.[/\\]/, '');
  if (path.isAbsolute(normalized)) {
    normalized = path.relative(path.resolve(__dirname, '..'), normalized);
  }
  const parts = normalized.split(/[/\\]/);
  if (parts[0] === 'features' && parts.length === 2 && (file.endsWith('.md') || file.endsWith('.json'))) {
    return true;
  }
  if (parts[0] !== 'guides' || parts.length < 3 || parts.some(p => p === '..')) {
    return false;
  }
  const filename = parts[parts.length - 1];
  return SME_CONTENT_FILENAMES.has(filename);
}

const ATL_CONFIG_PATH = path.join(__dirname, 'atls.json');

export interface AtlConfig {
  default: Record<string, string | string[]>;
  web_features: Record<string, string | string[]>;
  web_features_groups: Record<string, string | string[]>;
}

const FEATURE_GROUPS_PATH = path.join(__dirname, 'feature-to-groups.generated.json');
let featureGroups: Record<string, string[]> = {};
try {
  if (fs.existsSync(FEATURE_GROUPS_PATH)) {
    featureGroups = JSON.parse(fs.readFileSync(FEATURE_GROUPS_PATH, 'utf8'));
  }
} catch (err) {
  console.warn(`Could not load feature-to-groups.generated.json:`, err);
}

export function loadAtlConfig(): AtlConfig {
  try {
    const content = fs.readFileSync(ATL_CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to load ATL config from ${ATL_CONFIG_PATH}:`, err);
    process.exit(1);
  }
}

export function normalizeLabel(label: string): string {
  // Normalize labels like "category:performance" or "Performance" to "performance"
  let clean = label.trim().toLowerCase();
  if (clean.startsWith('category:')) {
    clean = clean.slice('category:'.length);
  }
  if (clean.startsWith('guide:')) {
    clean = clean.slice('guide:'.length);
  }
  if (clean.startsWith('guides:')) {
    clean = clean.slice('guides:'.length);
  }
  return clean.trim();
}

export function isContentRelatedIssue(
  labels: string[],
  issueDescription: string,
  atlConfig?: AtlConfig,
  guidesRootDir?: string
): boolean {
  const categories = getKnownCategories(guidesRootDir, atlConfig);
  const contentLabels = new Set(['new-feature', 'new-use-case', 'content', 'gd-dev-content']);
  for (const label of labels) {
    const normalized = normalizeLabel(label);
    if (contentLabels.has(normalized)) return true;
    if (categories.has(normalized)) return true;
    if (atlConfig?.default && atlConfig.default[normalized]) return true;
    if (atlConfig?.web_features && atlConfig.web_features[normalized]) return true;
    if (atlConfig?.web_features_groups && atlConfig.web_features_groups[normalized]) return true;
    if (featureGroups[normalized]) return true;
    if (label.startsWith('category:') || label.startsWith('guide:') || label.startsWith('guides:')) return true;
  }

  // Check description for use case subdir
  if (/Use case subdir:\s*\[guides\/([^/\]]+)/i.test(issueDescription)) {
    return true;
  }

  // Check description for web feature IDs
  if (extractFeatureIds(issueDescription).length > 0) {
    return true;
  }

  return false;
}

export function extractFeatureIdsFromContent(content: string): string[] {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return [];
  const fm = match[1];
  
  const lines = fm.split('\n');
  const featureIds: string[] = [];
  let inWebFeatures = false;
  for (const line of lines) {
    if (line.startsWith('web-feature-ids:')) {
      inWebFeatures = true;
      continue;
    }
    if (inWebFeatures) {
      if (line.trim().startsWith('-')) {
        const fid = line.replace(/^\s*-\s*/, '').trim();
        if (fid) featureIds.push(fid);
      } else if (line.match(/^[a-zA-Z0-9_-]+:/)) {
        inWebFeatures = false;
      }
    }
  }
  return featureIds;
}

export function getFeatureIdsFromGuide(guidePath: string): string[] {
  try {
    if (!fs.existsSync(guidePath)) return [];
    const content = fs.readFileSync(guidePath, 'utf8');
    return extractFeatureIdsFromContent(content);
  } catch (err) {
    console.error(`Error reading feature IDs from ${guidePath}:`, err);
    return [];
  }
}

export function resolveAtl(category: string, featureIds: string[], atlConfig: AtlConfig): string[] {
  const resolved = new Set<string>();

  // Add category default ATL
  const categoryDefault = atlConfig.default[category];
  if (categoryDefault) {
    if (Array.isArray(categoryDefault)) {
      categoryDefault.forEach(a => resolved.add(a));
    } else {
      resolved.add(categoryDefault);
    }
  }

  if (featureIds && featureIds.length > 0) {
    // Check specific feature ID overrides
    for (const fid of featureIds) {
      if (atlConfig.web_features[fid]) {
        const override = atlConfig.web_features[fid];
        if (Array.isArray(override)) {
          override.forEach(a => resolved.add(a));
        } else {
          resolved.add(override);
        }
      }
    }
    // Check feature group overrides
    for (const fid of featureIds) {
      const groups = featureGroups[fid] || [];
      for (const group of groups) {
        if (atlConfig.web_features_groups[group]) {
          const override = atlConfig.web_features_groups[group];
          if (Array.isArray(override)) {
            override.forEach(a => resolved.add(a));
          } else {
            resolved.add(override);
          }
        }
      }
    }
  }

  return Array.from(resolved);
}

export function getAtlsFromDescription(description: string, atlConfig: AtlConfig): string[] {
  if (!description) return [];

  // Extract feature IDs from known patterns (fields, URLs, etc.)
  const featureIds = new Set(extractFeatureIds(description));

  if (featureIds.size === 0) return [];

  if (featureIds.size > 0) {
    console.log(`Matched/extracted feature IDs in description: ${Array.from(featureIds).join(', ')}`);
  }

  const resolvedAtls = new Set<string>();
  for (const fid of featureIds) {
    // 1. Direct match
    if (atlConfig.web_features[fid]) {
      const val = atlConfig.web_features[fid];
      if (Array.isArray(val)) {
        val.forEach(a => resolvedAtls.add(a));
      } else {
        resolvedAtls.add(val);
      }
    }
    // 2. Group match
    const groups = featureGroups[fid] || [];
    for (const group of groups) {
      if (atlConfig.web_features_groups[group]) {
        const val = atlConfig.web_features_groups[group];
        if (Array.isArray(val)) {
          val.forEach(a => resolvedAtls.add(a));
        } else {
          resolvedAtls.add(val);
        }
      }
    }
  }

  return Array.from(resolvedAtls);
}

export const githubApi = {
  getIssueUnassignedLogins(issueNumber: number): string[] {
    const eventsOutput = child_process.execFileSync(
      'gh',
      [
        'api',
        `repos/{owner}/{repo}/issues/${issueNumber}/events`,
        '--paginate',
        '--jq',
        '.[] | select(.event == "unassigned" and (.actor and .actor.type != "Bot" and ((.actor.login // "") | endswith("[bot]") | not))) | .assignee.login'
      ],
      { encoding: 'utf8' }
    );
    return eventsOutput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  getIssueUnlabeledEvents(issueNumber: number): string[] {
    const eventsOutput = child_process.execFileSync(
      'gh',
      [
        'api',
        `repos/{owner}/{repo}/issues/${issueNumber}/events`,
        '--paginate',
        '--jq',
        '.[] | select(.event == "unlabeled" and (.actor and .actor.type != "Bot" and ((.actor.login // "") | endswith("[bot]") | not))) | .label.name'
      ],
      { encoding: 'utf8' }
    );
    return eventsOutput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  getIssueCurrentAssignees(issueNumber: number): string[] {
    const assigneesOutput = child_process.execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--json', 'assignees', '--jq', '.assignees[].login'],
      { encoding: 'utf8' }
    );
    return assigneesOutput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  getIssueLabels(issueNumber: number): string[] {
    const output = child_process.execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--json', 'labels', '--jq', '.labels[].name'],
      { encoding: 'utf8' }
    );
    return output
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  addIssueAssignees(issueNumber: number, assignees: string[]): void {
    if (assignees.length === 0) return;
    child_process.execFileSync(
      'gh',
      ['issue', 'edit', String(issueNumber), '--add-assignee', assignees.join(',')],
      { stdio: 'inherit' }
    );
  },

  addIssueLabels(issueNumber: number, labels: string[]): void {
    if (labels.length === 0) return;
    child_process.execFileSync(
      'gh',
      ['issue', 'edit', String(issueNumber), '--add-label', labels.join(',')],
      { stdio: 'inherit' }
    );
  },

  removeIssueLabels(issueNumber: number, labels: string[]): void {
    if (labels.length === 0) return;
    child_process.execFileSync(
      'gh',
      ['issue', 'edit', String(issueNumber), '--remove-label', labels.join(',')],
      { stdio: 'inherit' }
    );
  },

  getIssueBody(issueNumber: number): string {
    return child_process.execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--json', 'body', '--jq', '.body'],
      { encoding: 'utf8' }
    ).trim();
  },

  getPrFiles(prNumber: number): string[] {
    const output = child_process.execFileSync(
      'gh',
      ['pr', 'view', String(prNumber), '--json', 'files', '--jq', '.files[].path'],
      { encoding: 'utf8' }
    );
    return output.trim().split('\n').map(f => f.trim()).filter(Boolean);
  },

  getPrAuthor(prNumber: number): string {
    return child_process.execFileSync(
      'gh',
      ['pr', 'view', String(prNumber), '--json', 'author', '--jq', '.author.login'],
      { encoding: 'utf8' }
    ).trim();
  },

  getPrLabels(prNumber: number): string[] {
    const output = child_process.execFileSync(
      'gh',
      ['pr', 'view', String(prNumber), '--json', 'labels', '--jq', '.labels[].name'],
      { encoding: 'utf8' }
    );
    return output
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  getPrReviewState(prNumber: number): { reviewRequests: string[]; reviews: string[] } {
    const output = child_process.execFileSync(
      'gh',
      ['pr', 'view', String(prNumber), '--json', 'reviews,reviewRequests'],
      { encoding: 'utf8' }
    );
    const prData = JSON.parse(output);
    const reviewRequests = (prData.reviewRequests || []).map((r: any) => r.login).filter(Boolean);
    const reviews = (prData.reviews || []).map((r: any) => r.author?.login).filter(Boolean);
    return { reviewRequests, reviews };
  },

  addPrReviewers(prNumber: number, reviewers: string[]): void {
    if (reviewers.length === 0) return;
    child_process.execFileSync(
      'gh',
      ['pr', 'edit', String(prNumber), '--add-reviewer', reviewers.join(',')],
      { stdio: 'inherit' }
    );
  },

  addPrLabels(prNumber: number, labels: string[]): void {
    if (labels.length === 0) return;
    child_process.execFileSync(
      'gh',
      ['pr', 'edit', String(prNumber), '--add-label', labels.join(',')],
      { stdio: 'inherit' }
    );
  },

  removePrLabels(prNumber: number, labels: string[]): void {
    if (labels.length === 0) return;
    child_process.execFileSync(
      'gh',
      ['pr', 'edit', String(prNumber), '--remove-label', labels.join(',')],
      { stdio: 'inherit' }
    );
  },

  getPrUnlabeledEvents(prNumber: number): string[] {
    const eventsOutput = child_process.execFileSync(
      'gh',
      [
        'api',
        `repos/{owner}/{repo}/issues/${prNumber}/events`,
        '--paginate',
        '--jq',
        '.[] | select(.event == "unlabeled" and (.actor and .actor.type != "Bot" and ((.actor.login // "") | endswith("[bot]") | not))) | .label.name'
      ],
      { encoding: 'utf8' }
    );
    return eventsOutput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  getPrRemovedReviewers(prNumber: number): string[] {
    const eventsOutput = child_process.execFileSync(
      'gh',
      [
        'api',
        `repos/{owner}/{repo}/issues/${prNumber}/events`,
        '--paginate',
        '--jq',
        '.[] | select(.event == "review_request_removed" and (.actor and .actor.type != "Bot" and ((.actor.login // "") | endswith("[bot]") | not))) | .requested_reviewer.login'
      ],
      { encoding: 'utf8' }
    );
    return eventsOutput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  getPrFileContent(prNumber: number, filePath: string): string | null {
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (normalizedPath.includes('..') || !normalizedPath.startsWith('guides/')) {
      return null;
    }
    const encodedPath = normalizedPath
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    try {
      return child_process.execFileSync(
        'gh',
        [
          'api',
          `repos/{owner}/{repo}/contents/${encodedPath}?ref=refs/pull/${prNumber}/head`,
          '-H',
          'Accept: application/vnd.github.raw+json'
        ],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
    } catch {
      return null;
    }
  },

  getPrIsDraft(prNumber: number): boolean {
    const output = child_process.execFileSync(
      'gh',
      ['pr', 'view', String(prNumber), '--json', 'isDraft', '--jq', '.isDraft'],
      { encoding: 'utf8' }
    ).trim();
    return output === 'true';
  }
};

export interface HandleIssueOptions {
  dryRun?: boolean;
  guidesRootDir?: string;
  currentAssignees?: string[];
}

export function handleIssue(
  issueNumber: number,
  labels: string[],
  issueDescription: string,
  atlConfig: AtlConfig,
  options?: HandleIssueOptions
): string[] {
  const isDryRun = options?.dryRun ?? (process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1');
  console.log(`Triaging issue #${issueNumber} with labels: ${labels.join(', ')}`);
  
  const assignedAtls = new Set<string>();
  
  // 1. Check labels
  for (const label of labels) {
    const normalized = normalizeLabel(label);
    
    if (atlConfig.web_features[normalized]) {
      const atls = Array.isArray(atlConfig.web_features[normalized]) ? atlConfig.web_features[normalized] : [atlConfig.web_features[normalized]];
      atls.forEach(a => assignedAtls.add(a));
    }
    else if (atlConfig.web_features_groups[normalized]) {
      const atls = Array.isArray(atlConfig.web_features_groups[normalized]) ? atlConfig.web_features_groups[normalized] : [atlConfig.web_features_groups[normalized]];
      atls.forEach(a => assignedAtls.add(a));
    }
    else if (atlConfig.default[normalized]) {
      const atls = Array.isArray(atlConfig.default[normalized]) ? atlConfig.default[normalized] : [atlConfig.default[normalized]];
      atls.forEach(a => assignedAtls.add(a));
    }
  }

  // 2. Check issue description for web-feature IDs
  const descriptionAtls = getAtlsFromDescription(issueDescription, atlConfig);
  if (descriptionAtls.length > 0) {
    console.log(`Found ATLs from description: ${descriptionAtls.join(', ')}`);
    descriptionAtls.forEach(a => assignedAtls.add(a));
  }

  // 3. Check issue description for use case category
  const categoryMatch = issueDescription.match(/Use case subdir:\s*\[guides\/([^/\]]+)/i);
  if (categoryMatch) {
    const category = categoryMatch[1].trim().toLowerCase();
    if (atlConfig.default[category]) {
      const atls = Array.isArray(atlConfig.default[category]) ? atlConfig.default[category] : [atlConfig.default[category]];
      console.log(`Found category "${category}" from use case subdir in description. ATL: ${atls.join(', ')}`);
      atls.forEach(a => assignedAtls.add(a));
    }
  }

  // Check current assignees and known ATLs
  const currentAssignees = new Set<string>();
  if (options?.currentAssignees) {
    options.currentAssignees.forEach(l => currentAssignees.add(l.toLowerCase()));
  } else {
    try {
      const assignees = githubApi.getIssueCurrentAssignees(issueNumber);
      assignees.forEach(l => currentAssignees.add(l.toLowerCase()));
    } catch (err) {
      console.warn(`Failed to fetch current assignees for issue #${issueNumber}:`, err);
    }
  }

  const allKnownAtls = new Set<string>();
  Object.values(atlConfig.default).forEach(val => {
    if (Array.isArray(val)) val.forEach(a => allKnownAtls.add(a.toLowerCase()));
    else allKnownAtls.add(val.toLowerCase());
  });
  Object.values(atlConfig.web_features).forEach(val => {
    if (Array.isArray(val)) val.forEach(a => allKnownAtls.add(a.toLowerCase()));
    else allKnownAtls.add(val.toLowerCase());
  });
  Object.values(atlConfig.web_features_groups).forEach(val => {
    if (Array.isArray(val)) val.forEach(a => allKnownAtls.add(a.toLowerCase()));
    else allKnownAtls.add(val.toLowerCase());
  });
  const hasAssignedKnownAtl = Array.from(currentAssignees).some(a => allKnownAtls.has(a));

  const isContent = isContentRelatedIssue(labels, issueDescription, atlConfig, options?.guidesRootDir);
  const foundAtls = new Set(assignedAtls);
  const hasNeedsAtl = labels.some(l => l.toLowerCase() === 'needs-atl');
  const hasAtl = foundAtls.size > 0 || hasAssignedKnownAtl;

  const issueLabelsToAdd: string[] = [];
  const issueLabelsToRemove: string[] = [];

  if (isContent && !hasAtl) {
    if (!hasNeedsAtl) {
      let wasPreviouslyUnlabeled = false;
      try {
        const unlabeled = githubApi.getIssueUnlabeledEvents(issueNumber);
        wasPreviouslyUnlabeled = unlabeled.some(l => l.toLowerCase() === 'needs-atl');
      } catch (err) {
        console.warn(`Failed to fetch event history for issue #${issueNumber}:`, err);
      }

      if (!wasPreviouslyUnlabeled) {
        issueLabelsToAdd.push('needs-atl');
      } else {
        console.log(`Skipping adding 'needs-atl' to issue #${issueNumber} because it was previously removed.`);
      }
    }
  } else if (hasAtl) {
    if (hasNeedsAtl) {
      issueLabelsToRemove.push('needs-atl');
    }
  }

  if (issueLabelsToAdd.length > 0) {
    if (isDryRun) {
      console.log(`[DRY RUN] Would add label(s) to issue #${issueNumber}: ${issueLabelsToAdd.join(', ')}`);
    } else {
      try {
        githubApi.addIssueLabels(issueNumber, issueLabelsToAdd);
        console.log(`Successfully added label(s) to issue #${issueNumber}: ${issueLabelsToAdd.join(', ')}`);
      } catch (err) {
        console.error(`Failed to add labels to issue #${issueNumber}:`, err);
      }
    }
  }

  if (issueLabelsToRemove.length > 0) {
    if (isDryRun) {
      console.log(`[DRY RUN] Would remove label(s) from issue #${issueNumber}: ${issueLabelsToRemove.join(', ')}`);
    } else {
      try {
        githubApi.removeIssueLabels(issueNumber, issueLabelsToRemove);
        console.log(`Successfully removed label(s) from issue #${issueNumber}: ${issueLabelsToRemove.join(', ')}`);
      } catch (err) {
        console.error(`Failed to remove labels from issue #${issueNumber}:`, err);
      }
    }
  }

  if (assignedAtls.size === 0) {
    console.log('No matching ATL signals found for this issue.');
    return [];
  }

  for (const atl of Array.from(assignedAtls)) {
    if (currentAssignees.has(atl.toLowerCase())) {
      console.log(`ATL @${atl} is already assigned to issue #${issueNumber}.`);
      assignedAtls.delete(atl);
    }
  }

  if (assignedAtls.size === 0) {
    console.log('No new ATLs to assign to this issue.');
    return [];
  }

  const unassignedLogins = new Set<string>();
  try {
    const unassigned = githubApi.getIssueUnassignedLogins(issueNumber);
    unassigned.forEach(l => unassignedLogins.add(l.toLowerCase()));
  } catch (err) {
    console.warn(`Failed to fetch event history for issue #${issueNumber}:`, err);
  }

  for (const atl of Array.from(assignedAtls)) {
    const lowerAtl = atl.toLowerCase();
    if (unassignedLogins.has(lowerAtl)) {
      console.log(`Skipping ATL @${atl} for issue #${issueNumber} because they were previously unassigned.`);
      assignedAtls.delete(atl);
    }
  }

  if (assignedAtls.size === 0) {
    console.log('No new ATLs to assign to this issue.');
    return [];
  }

  const assignees = Array.from(assignedAtls);
  if (isDryRun) {
    console.log(`[DRY RUN] Would assign issue #${issueNumber} to: ${assignees.join(',')}`);
  } else {
    console.log(`Assigning issue #${issueNumber} to: ${assignees.join(',')}`);
    try {
      githubApi.addIssueAssignees(issueNumber, assignees);
      console.log('Successfully assigned issue.');
    } catch (err) {
      console.error(`Failed to assign issue #${issueNumber}:`, err);
    }
  }
  return assignees;
}

export interface TranscludedGuide {
  category: string;
  relativePath: string;
  fullPath: string;
}

export function findGuidesTranscludingFeature(
  featureId: string,
  guidesRootDir: string = path.join(path.resolve(__dirname, '..'), 'guides')
): TranscludedGuide[] {
  const matches: TranscludedGuide[] = [];

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name === GUIDE_FILE || entry.name === SKILL_FILE)) {
        const rel = path.relative(guidesRootDir, fullPath);
        const parts = rel.split(path.sep);
        const category = parts[0];
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const transcluded = getTranscludedFeatureIds(content);
          if (transcluded.includes(featureId)) {
            matches.push({
              category,
              relativePath: path.relative(path.resolve(__dirname, '..'), fullPath),
              fullPath
            });
          }
        } catch (err) {
          console.warn(`Could not read guide file ${fullPath}:`, err);
        }
      }
    }
  }

  scanDir(guidesRootDir);
  return matches;
}

export interface HandlePrOptions {
  dryRun?: boolean;
  isDraft?: boolean;
}

export function handlePR(
  prNumber: number,
  prAuthor: string,
  atlConfig: AtlConfig,
  mockFiles?: string[],
  guidesRootDir: string = path.join(path.resolve(__dirname, '..'), 'guides'),
  labels: string[] = [],
  options?: HandlePrOptions
) {
  const isDryRun = options?.dryRun ?? (process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1');
  console.log(`Triaging PR #${prNumber} by author: @${prAuthor}`);

  let isDraft = options?.isDraft;
  if (isDraft === undefined && !mockFiles) {
    try {
      isDraft = githubApi.getPrIsDraft(prNumber);
    } catch (err) {
      console.warn(`Failed to check if PR #${prNumber} is draft:`, err);
    }
  }

  if (isDraft) {
    console.log(`PR #${prNumber} is in draft mode. Skipping triage until marked ready for review.`);
    return [];
  }
  
  let files: string[] = [];
  if (mockFiles) {
    files = mockFiles;
  } else {
    try {
      files = githubApi.getPrFiles(prNumber);
    } catch (err) {
      console.error(`Failed to fetch files for PR #${prNumber}:`, err);
      return [];
    }
  }

  console.log(`PR modified ${files.length} files.`);
  
  const isContentLabelled = labels.includes('content') || labels.includes('gd-dev-content');
  const matchedAtls = new Set<string>();
  const allResolvedAtls = new Set<string>();
  let hasEvaluatedContent = false;

  const touchesSmeContent = files.some(isSmeContentFile);
  const knownCategories = getKnownCategories(guidesRootDir, atlConfig);

  for (const file of files) {
    const parts = file.split(/[/\\]/);

    // 1. Content files under guides/<category>/<guide-name>/...
    if (parts[0] === 'guides' && parts.length >= 4) {
      const category = parts[1];
      if (NON_CATEGORY_DIRS.has(category.toLowerCase())) {
        continue;
      }
      if (fs.existsSync(path.join(guidesRootDir, category)) && !knownCategories.has(category.toLowerCase())) {
        continue;
      }
      const guideName = parts[2];
      const filename = parts[parts.length - 1];
      if (SME_CONTENT_FILENAMES.has(filename) || isContentLabelled) {
        hasEvaluatedContent = true;
        const relativeGuidePath = `guides/${category}/${guideName}/${GUIDE_FILE}`;
        const guideDir = path.join(guidesRootDir, category, guideName);
        const guidePath = path.join(guideDir, GUIDE_FILE);

        let featureIds: string[] = [];
        let guideContent: string | null = null;

        if (!mockFiles) {
          try {
            guideContent = githubApi.getPrFileContent(prNumber, relativeGuidePath);
          } catch (err) {
            console.warn(`Failed to fetch ${relativeGuidePath} from PR #${prNumber}:`, err);
          }
        }

        if (guideContent) {
          featureIds = extractFeatureIdsFromContent(guideContent);
        } else if (fs.existsSync(guidePath)) {
          featureIds = getFeatureIdsFromGuide(guidePath);
        }

        const atl = resolveAtl(category, featureIds, atlConfig);
        if (atl) {
          const atls = Array.isArray(atl) ? atl : [atl];
          for (const a of atls) {
            console.log(`File "${file}" is a content file in category "${category}" (feature IDs: ${featureIds.join(', ')}). ATL: @${a}`);
            matchedAtls.add(a);
            allResolvedAtls.add(a);
          }
        }
      }
    }

    // 2. Feature definition files (features/<feature-id>.md)
    if (parts[0] === 'features' && file.endsWith('.md')) {
      hasEvaluatedContent = true;
      const featureId = path.basename(file, '.md');

      // Auto-assign feature-level owners
      const featureAtls = resolveAtl('', [featureId], atlConfig);
      for (const a of featureAtls) {
        console.log(`File "${file}" is a feature definition for "${featureId}". Feature ATL: @${a}`);
        matchedAtls.add(a);
        allResolvedAtls.add(a);
      }

      // Look for guides in which that feature is being transcluded, and assign category-level owners
      const transcludedGuides = findGuidesTranscludingFeature(featureId, guidesRootDir);
      for (const guide of transcludedGuides) {
        const category = guide.category;
        if (atlConfig.default[category]) {
          const catAtls = Array.isArray(atlConfig.default[category])
            ? atlConfig.default[category]
            : [atlConfig.default[category]];
          for (const a of catAtls) {
            console.log(`Feature "${featureId}" is transcluded in guide "${guide.relativePath}" (category: "${category}"). Category ATL: @${a}`);
            matchedAtls.add(a);
            allResolvedAtls.add(a);
          }
        }
      }
    }
  }

  const prLabelsToAdd: string[] = [];
  const prLabelsToRemove: string[] = [];
  const hasNeedsAtl = labels.some(l => l.toLowerCase() === 'needs-atl');
  const hasContent = labels.some(l => l.toLowerCase() === 'content');

  let unlabeledLabels: Set<string> | null = null;
  function getUnlabeledLabels(): Set<string> {
    if (!unlabeledLabels) {
      unlabeledLabels = new Set<string>();
      if (!mockFiles) {
        try {
          const unlabeled = githubApi.getPrUnlabeledEvents(prNumber);
          unlabeled.forEach(l => unlabeledLabels!.add(l.toLowerCase()));
        } catch (err) {
          console.warn(`Failed to fetch event history for PR #${prNumber}:`, err);
        }
      }
    }
    return unlabeledLabels;
  }

  if (touchesSmeContent && !hasContent) {
    if (!getUnlabeledLabels().has('content')) {
      prLabelsToAdd.push('content');
    } else {
      console.log(`Skipping adding 'content' to PR #${prNumber} because it was previously removed.`);
    }
  }

  if (hasEvaluatedContent && allResolvedAtls.size === 0) {
    if (!hasNeedsAtl) {
      if (!getUnlabeledLabels().has('needs-atl')) {
        prLabelsToAdd.push('needs-atl');
      } else {
        console.log(`Skipping adding 'needs-atl' to PR #${prNumber} because it was previously removed.`);
      }
    }
  } else if (allResolvedAtls.size > 0) {
    if (hasNeedsAtl) {
      prLabelsToRemove.push('needs-atl');
    }
  }

  // Remove the PR author, already requested/reviewed users, and any reviewers whose review request was previously removed
  const excludeLogins = [prAuthor];

  if (!mockFiles) {
    try {
      const prData = githubApi.getPrReviewState(prNumber);
      excludeLogins.push(...prData.reviewRequests, ...prData.reviews);
    } catch (err) {
      console.error(`Failed to fetch existing review state for PR #${prNumber}:`, err);
    }

    if (matchedAtls.size > 0) {
      try {
        const removedReviewers = githubApi.getPrRemovedReviewers(prNumber);
        excludeLogins.push(...removedReviewers);
      } catch (err) {
        console.warn(`Failed to fetch removed review requests for PR #${prNumber}:`, err);
      }
    }
  }

  for (const login of excludeLogins) {
    const lowerLogin = login.toLowerCase();
    for (const match of matchedAtls) {
      if (match.toLowerCase() === lowerLogin) {
        matchedAtls.delete(match);
      }
    }
  }

  const reviewers = Array.from(matchedAtls);

  if (isDryRun) {
    if (prLabelsToAdd.length > 0) {
      console.log(`[DRY RUN] Would add label(s) to PR #${prNumber}: ${prLabelsToAdd.join(', ')}`);
    }
    if (prLabelsToRemove.length > 0) {
      console.log(`[DRY RUN] Would remove label(s) from PR #${prNumber}: ${prLabelsToRemove.join(', ')}`);
    }
    if (reviewers.length > 0) {
      console.log(`[DRY RUN] Would request review on PR #${prNumber} from: ${reviewers.join(',')}`);
    } else {
      console.log('No ATL review requests needed for this PR.');
    }
    return reviewers;
  }

  if (!mockFiles) {
    if (prLabelsToAdd.length > 0) {
      try {
        githubApi.addPrLabels(prNumber, prLabelsToAdd);
        console.log(`Successfully added label(s) to PR #${prNumber}: ${prLabelsToAdd.join(', ')}`);
      } catch (err) {
        console.error(`Failed to add labels to PR #${prNumber}:`, err);
      }
    }

    if (prLabelsToRemove.length > 0) {
      try {
        githubApi.removePrLabels(prNumber, prLabelsToRemove);
        console.log(`Successfully removed label(s) from PR #${prNumber}: ${prLabelsToRemove.join(', ')}`);
      } catch (err) {
        console.error(`Failed to remove labels from PR #${prNumber}:`, err);
      }
    }
  }

  if (matchedAtls.size === 0) {
    console.log('No ATL review requests needed for this PR.');
    return [];
  }

  console.log(`Requesting review on PR #${prNumber} from: ${reviewers.join(',')}`);
  if (!mockFiles) {
    try {
      githubApi.addPrReviewers(prNumber, reviewers);
      console.log('Successfully requested reviews.');
    } catch (err) {
      console.error(`Failed to request reviews for PR #${prNumber}:`, err);
    }
  }
  return reviewers;
}

export function main() {
  const atlConfig = loadAtlConfig();
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';

  if (eventPath && fs.existsSync(eventPath)) {
    console.log(`Processing GitHub Actions event from ${eventPath}`);
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

    // Check if it's an issue event
    if (event.issue) {
      const issueNumber = event.issue.number;
      const labels = (event.issue.labels || []).map((l: any) => l.name);
      const issueDescription = event.issue.body || '';
      handleIssue(issueNumber, labels, issueDescription, atlConfig, { dryRun: isDryRun });
    } 
    // Check if it's a pull request event
    else if (event.pull_request) {
      const prNumber = event.pull_request.number;
      const prAuthor = event.pull_request.user.login;
      const prLabels = (event.pull_request.labels || []).map((l: any) => l.name);
      const isDraft = Boolean(event.pull_request.draft);
      handlePR(prNumber, prAuthor, atlConfig, undefined, undefined, prLabels, { dryRun: isDryRun, isDraft });
    } 
    else {
      console.log('Event is neither an issue nor a pull request event. Skipping.');
    }
  } else {
    // CLI manual fallback for local testing
    const rawArgs = process.argv.slice(2);
    const args = rawArgs.filter(arg => arg !== '--dry-run');

    if (args.length < 2) {
      console.log('Usage for manual testing:');
      console.log('  node guides/atl-triage.ts issue <number> [label1] [label2] ... [--dry-run]');
      console.log('  node guides/atl-triage.ts pr <number> [author] [label1] [label2] ... [--dry-run]');
      process.exit(1);
    }

    const type = args[0];
    const number = parseInt(args[1], 10);

    if (isNaN(number)) {
      console.error('Invalid issue/PR number');
      process.exit(1);
    }

    if (type === 'issue') {
      let labels = args.slice(2);
      if (labels.length === 0) {
        try {
          labels = githubApi.getIssueLabels(number);
        } catch (err) {
          console.warn(`Failed to fetch labels for issue #${number}:`, err);
        }
      }
      let issueDescription = '';
      try {
        issueDescription = githubApi.getIssueBody(number);
      } catch (err) {
        console.warn(`Failed to fetch issue body for issue #${number}:`, err);
      }
      handleIssue(number, labels, issueDescription, atlConfig, { dryRun: isDryRun });
    } else if (type === 'pr') {
      let author = args[2] || '';
      let labels = args.slice(3);
      if (!author) {
        try {
          author = githubApi.getPrAuthor(number);
        } catch (err) {
          console.warn(`Failed to fetch author for PR #${number}:`, err);
        }
      }
      if (labels.length === 0) {
        try {
          labels = githubApi.getPrLabels(number);
        } catch (err) {
          console.warn(`Failed to fetch labels for PR #${number}:`, err);
        }
      }
      handlePR(number, author, atlConfig, undefined, undefined, labels, { dryRun: isDryRun });
    } else {
      console.error(`Unknown type: ${type}`);
      process.exit(1);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
