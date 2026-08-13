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
export const DEMO_FILE = 'demo.html';
export const EXPECTATIONS_FILE = 'expectations.md';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ATL_CONFIG_PATH = path.join(__dirname, 'atls.json');

interface AtlConfig {
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

function loadAtlConfig(): AtlConfig {
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

function getFeatureIdsFromGuide(guidePath: string): string[] {
  try {
    if (!fs.existsSync(guidePath)) return [];
    const content = fs.readFileSync(guidePath, 'utf8');
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

  // 1. Extract feature IDs from known patterns (fields, URLs, etc.)
  const featureIds = new Set(extractFeatureIds(description));

  // 2. Scan the description for any known feature IDs (keyword match) as a fallback
  const candidates = Array.from(
    new Set([
      ...Object.keys(atlConfig.web_features),
      ...Object.keys(featureGroups)
    ])
  ).sort((a, b) => b.length - a.length);

  if (candidates.length > 0) {
    const escapedCandidates = candidates.map(fid => fid.replace(new RegExp('[-/\\\\^$*+?.()|[\\]{}]', 'g'), '\\$&'));
    const regex = new RegExp(`(?<![a-zA-Z0-9_-])(${escapedCandidates.join('|')})(?![a-zA-Z0-9_-])`, 'g');

    let match;
    while ((match = regex.exec(description)) !== null) {
      featureIds.add(match[1]);
    }
  }

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
    const eventsOutput = child_process.execSync(
      `gh api repos/{owner}/{repo}/issues/${issueNumber}/events --paginate --jq '.[] | select(.event == "unassigned") | .assignee.login'`,
      { encoding: 'utf8' }
    );
    return eventsOutput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  getIssueCurrentAssignees(issueNumber: number): string[] {
    const assigneesOutput = child_process.execSync(
      `gh issue view ${issueNumber} --json assignees --jq ".assignees[].login"`,
      { encoding: 'utf8' }
    );
    return assigneesOutput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  },

  addIssueAssignees(issueNumber: number, assignees: string[]): void {
    child_process.execSync(`gh issue edit ${issueNumber} --add-assignee "${assignees.join(',')}"`, { stdio: 'inherit' });
  },

  getIssueBody(issueNumber: number): string {
    return child_process.execSync(`gh issue view ${issueNumber} --json body --jq ".body"`, { encoding: 'utf8' }).trim();
  },

  getPrFiles(prNumber: number): string[] {
    const output = child_process.execSync(`gh pr view ${prNumber} --json files --jq ".files[].path"`, { encoding: 'utf8' });
    return output.trim().split('\n').map(f => f.trim()).filter(Boolean);
  },

  getPrReviewState(prNumber: number): { reviewRequests: string[]; reviews: string[] } {
    const output = child_process.execSync(`gh pr view ${prNumber} --json reviews,reviewRequests`, { encoding: 'utf8' });
    const prData = JSON.parse(output);
    const reviewRequests = (prData.reviewRequests || []).map((r: any) => r.login).filter(Boolean);
    const reviews = (prData.reviews || []).map((r: any) => r.author?.login).filter(Boolean);
    return { reviewRequests, reviews };
  },

  addPrReviewers(prNumber: number, reviewers: string[]): void {
    child_process.execSync(`gh pr edit ${prNumber} --add-reviewer "${reviewers.join(',')}"`, { stdio: 'inherit' });
  }
};

export function handleIssue(
  issueNumber: number,
  labels: string[],
  issueDescription: string,
  atlConfig: AtlConfig
) {
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

  if (assignedAtls.size === 0) {
    console.log('No matching ATL signals found for this issue.');
    return [];
  }

  // Check if any candidate ATLs have ever been unassigned or are already assigned to this issue
  const unassignedLogins = new Set<string>();
  const currentAssignees = new Set<string>();

  try {
    const unassigned = githubApi.getIssueUnassignedLogins(issueNumber);
    unassigned.forEach(l => unassignedLogins.add(l.toLowerCase()));
  } catch (err) {
    console.warn(`Failed to fetch event history for issue #${issueNumber}:`, err);
  }

  try {
    const assignees = githubApi.getIssueCurrentAssignees(issueNumber);
    assignees.forEach(l => currentAssignees.add(l.toLowerCase()));
  } catch (err) {
    console.warn(`Failed to fetch current assignees for issue #${issueNumber}:`, err);
  }

  for (const atl of Array.from(assignedAtls)) {
    const lowerAtl = atl.toLowerCase();
    if (unassignedLogins.has(lowerAtl)) {
      console.log(`Skipping ATL @${atl} for issue #${issueNumber} because they were previously unassigned.`);
      assignedAtls.delete(atl);
    } else if (currentAssignees.has(lowerAtl)) {
      console.log(`ATL @${atl} is already assigned to issue #${issueNumber}.`);
      assignedAtls.delete(atl);
    }
  }

  if (assignedAtls.size === 0) {
    console.log('No new ATLs to assign to this issue.');
    return [];
  }

  const assignees = Array.from(assignedAtls);
  console.log(`Assigning issue #${issueNumber} to: ${assignees.join(',')}`);
  try {
    githubApi.addIssueAssignees(issueNumber, assignees);
    console.log('Successfully assigned issue.');
  } catch (err) {
    console.error(`Failed to assign issue #${issueNumber}:`, err);
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

export function handlePR(
  prNumber: number,
  prAuthor: string,
  atlConfig: AtlConfig,
  mockFiles?: string[],
  guidesRootDir: string = path.join(path.resolve(__dirname, '..'), 'guides')
) {
  console.log(`Triaging PR #${prNumber} by author: @${prAuthor}`);
  
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
  
  const contentFilenames = new Set([GUIDE_FILE, DEMO_FILE, EXPECTATIONS_FILE, SKILL_FILE]);
  const matchedAtls = new Set<string>();

  const REPO_ROOT = path.resolve(__dirname, '..');

  for (const file of files) {
    const parts = file.split(/[/\\]/);

    // 1. Content files under guides/<category>/...
    if (parts[0] === 'guides' && parts.length >= 2) {
      const category = parts[1];
      const filename = parts[parts.length - 1];

      if (contentFilenames.has(filename)) {
        const absolutePath = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
        const dir = path.dirname(absolutePath);
        const guidePath = path.join(dir, GUIDE_FILE);
        const featureIds = getFeatureIdsFromGuide(guidePath);
        const atl = resolveAtl(category, featureIds, atlConfig);
        if (atl) {
          const atls = Array.isArray(atl) ? atl : [atl];
          for (const a of atls) {
            console.log(`File "${file}" is a content file in category "${category}" (feature IDs: ${featureIds.join(', ')}). ATL: @${a}`);
            matchedAtls.add(a);
          }
        }
      }
    }

    // 2. Feature definition files (features/<feature-id>.md)
    if (parts[0] === 'features' && file.endsWith('.md')) {
      const featureId = path.basename(file, '.md');

      // Auto-assign feature-level owners
      const featureAtls = resolveAtl('', [featureId], atlConfig);
      for (const a of featureAtls) {
        console.log(`File "${file}" is a feature definition for "${featureId}". Feature ATL: @${a}`);
        matchedAtls.add(a);
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
          }
        }
      }
    }
  }

  // Remove the PR author and any already requested/reviewed users to avoid redundant requests
  const excludeLogins = [prAuthor];

  if (!mockFiles) {
    try {
      const prData = githubApi.getPrReviewState(prNumber);
      excludeLogins.push(...prData.reviewRequests, ...prData.reviews);
    } catch (err) {
      console.error(`Failed to fetch existing review state for PR #${prNumber}:`, err);
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

  if (matchedAtls.size === 0) {
    console.log('No ATL review requests needed for this PR.');
    return [];
  }

  const reviewers = Array.from(matchedAtls);
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

  if (eventPath && fs.existsSync(eventPath)) {
    console.log(`Processing GitHub Actions event from ${eventPath}`);
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

    // Check if it's an issue event
    if (event.issue) {
      const issueNumber = event.issue.number;
      const labels = (event.issue.labels || []).map((l: any) => l.name);
      const issueDescription = event.issue.body || '';
      handleIssue(issueNumber, labels, issueDescription, atlConfig);
    } 
    // Check if it's a pull request event
    else if (event.pull_request) {
      const prNumber = event.pull_request.number;
      const prAuthor = event.pull_request.user.login;
      handlePR(prNumber, prAuthor, atlConfig);
    } 
    else {
      console.log('Event is neither an issue nor a pull request event. Skipping.');
    }
  } else {
    // CLI manual fallback for local testing
    const args = process.argv.slice(2);
    if (args.length < 2) {
      console.log('Usage for manual testing:');
      console.log('  node guides/atl-triage.ts issue <number> <label1> <label2> ...');
      console.log('  node guides/atl-triage.ts pr <number> <author>');
      process.exit(1);
    }

    const type = args[0];
    const number = parseInt(args[1], 10);

    if (isNaN(number)) {
      console.error('Invalid issue/PR number');
      process.exit(1);
    }

    if (type === 'issue') {
      const labels = args.slice(2);
      let issueDescription = '';
      try {
        issueDescription = githubApi.getIssueBody(number);
      } catch (err) {
        console.warn(`Failed to fetch issue body for issue #${number}:`, err);
      }
      handleIssue(number, labels, issueDescription, atlConfig);
    } else if (type === 'pr') {
      const author = args[2] || '';
      handlePR(number, author, atlConfig);
    } else {
      console.error(`Unknown type: ${type}`);
      process.exit(1);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
