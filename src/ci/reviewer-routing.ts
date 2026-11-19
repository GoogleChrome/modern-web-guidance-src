import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../core/categories.ts';
import { extractFeatureIds, stripTmpPrefix } from '../core/feature-parser.ts';
import { getTranscludedFeatureIds } from '../core/macro-parsing.ts';
import { guidesDir, rootDir } from '../core/paths.ts';
import { AWAITING_CLA_LABEL, hasLabel } from './pr-intake.ts';

// Define content file name constants inline to avoid importing from 'src/core/guide-validation.ts'
// which pulls in npm packages ('@11ty/gray-matter', 'marked') unavailable in the bare-Node triage job.
export const GUIDE_FILE = 'guide.md';
export const SKILL_FILE = 'SKILL.md';
export const EXPECTATIONS_FILE = 'expectations.md';
export const DEMO_FILE = 'demo.html';

export const SME_CONTENT_FILENAMES = new Set([GUIDE_FILE, DEMO_FILE, EXPECTATIONS_FILE, SKILL_FILE]);

export const DEFAULT_INFRA_OWNERS = ['paulirish', 'micahjo7', 'lusayaa'] as const;
export const CONFIG_OWNERS = ['paulirish', 'rviscomi', 'micahjo7', 'lusayaa'] as const;
export const PUBLIC_HARNESS_OWNERS = ['paulirish', 'micahjo7', 'TravenReese'] as const;
export const EVAL_OWNERS = ['TravenReese', 'micahjo7', 'lusayaa'] as const;

const NON_CATEGORY_DIRS = new Set(['lib', 'node_modules', 'modern-web-guidance']);
const CONTENT_ISSUE_LABELS = new Set(['new-feature', 'new-use-case', 'content', 'gd-dev-content']);
const ATL_CONFIG_PATH = path.join(rootDir, '.github', 'atls.json');
const FEATURE_GROUPS_PATH = path.join(rootDir, 'src', 'ci', 'feature-to-groups.gen.json');
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const MIN_AUTHOR_BODY_LINES = 10;
const MIN_AUTHOR_BODY_SHARE = 0.3;
const ZERO_SHA_REGEX = /^0+$/;

export interface AtlConfig {
  default: Record<string, string | string[]>;
  web_features: Record<string, string | string[]>;
  web_features_groups: Record<string, string | string[]>;
}

export let featureGroups: Record<string, string[]> = {};
try {
  if (fs.existsSync(FEATURE_GROUPS_PATH)) {
    featureGroups = JSON.parse(fs.readFileSync(FEATURE_GROUPS_PATH, 'utf8'));
  }
} catch (err) {
  console.warn('Could not load feature-to-groups.gen.json:', err);
}

export function loadAtlConfig(): AtlConfig {
  return JSON.parse(fs.readFileSync(ATL_CONFIG_PATH, 'utf8'));
}

export function toAtlList(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? [...val] : [val];
}

export type RepoFileClassification =
  | { kind: 'guide-content'; category: string; guideName: string; filename: string }
  | { kind: 'guide-asset'; category: string; guideName: string }
  | { kind: 'root-skill' }
  | { kind: 'skill-content'; skillName: string }
  | { kind: 'feature-md'; featureId: string }
  | { kind: 'feature-json' }
  | { kind: 'eval' }
  | { kind: 'public-harness' }
  | { kind: 'config' }
  | { kind: 'infra' };

function isEvalPath(file: string): boolean {
  return (
    file === 'guides/test-fixture.ts' ||
    file.startsWith('src/grading/') ||
    /(?:^|\/)targets\//.test(file) ||
    /(?:^|\/)grader\.ts$/.test(file) ||
    /(?:^|\/)tasks\/task\.md$/.test(file)
  );
}

export function classifyRepoFile(rawFile: string): RepoFileClassification {
  let file = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
  if (path.isAbsolute(file)) {
    file = path.relative(rootDir, file).replace(/\\/g, '/');
  }
  const parts = file.split('/');
  if (!file || parts.includes('..')) return { kind: 'infra' };

  if (file === 'CODEOWNERS' || file === '.github/atls.json') return { kind: 'config' };
  if (file.startsWith('src/harness/public/')) return { kind: 'public-harness' };
  if (isEvalPath(file)) return { kind: 'eval' };

  if (parts[0] === 'features' && parts.length === 2) {
    if (file.endsWith('.md')) return { kind: 'feature-md', featureId: path.basename(file, '.md') };
    if (file.endsWith('.json')) return { kind: 'feature-json' };
    return { kind: 'infra' };
  }

  if (parts[0] === 'skills-src' && parts.length >= 3) {
    return { kind: 'skill-content', skillName: parts[1].toLowerCase() };
  }

  if (file === `guides/modern-web-guidance/${SKILL_FILE}`) {
    return { kind: 'root-skill' };
  }

  if (parts[0] === 'guides' && parts.length >= 4 && !NON_CATEGORY_DIRS.has(parts[1].toLowerCase())) {
    const filename = parts[parts.length - 1];
    if (SME_CONTENT_FILENAMES.has(filename)) {
      return { kind: 'guide-content', category: parts[1], guideName: parts[2], filename };
    }
    return { kind: 'guide-asset', category: parts[1], guideName: parts[2] };
  }

  return { kind: 'infra' };
}

export function isSmeContentFile(rawFile: string): boolean {
  const c = classifyRepoFile(rawFile);
  switch (c.kind) {
    case 'guide-content':
    case 'root-skill':
    case 'skill-content':
    case 'feature-md':
    case 'feature-json':
      return true;
    case 'guide-asset':
    case 'eval':
    case 'public-harness':
    case 'config':
    case 'infra':
      return false;
    default: {
      const _exhaustive: never = c;
      throw new Error(`Unhandled file kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function resolveInfraReviewers(files: readonly string[]): string[] {
  const owners = new Set<string>();
  for (const rawFile of files) {
    const c = classifyRepoFile(rawFile);
    switch (c.kind) {
      case 'config':
        CONFIG_OWNERS.forEach(o => owners.add(o));
        break;
      case 'public-harness':
        PUBLIC_HARNESS_OWNERS.forEach(o => owners.add(o));
        break;
      case 'eval':
        EVAL_OWNERS.forEach(o => owners.add(o));
        break;
      case 'infra':
        DEFAULT_INFRA_OWNERS.forEach(o => owners.add(o));
        break;
      case 'guide-content':
      case 'guide-asset':
      case 'root-skill':
      case 'skill-content':
      case 'feature-md':
      case 'feature-json':
        break;
      default: {
        const _exhaustive: never = c;
        throw new Error(`Unhandled file kind: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
  return Array.from(owners);
}

function isCategoryDirectory(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    if (entries.some(e => e.isFile() && e.name === GUIDE_FILE)) return true;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const subEntries = fs.readdirSync(path.join(dirPath, entry.name), { withFileTypes: true });
      if (subEntries.some(e => e.isFile() && (e.name === GUIDE_FILE || e.name === DEMO_FILE || e.name === EXPECTATIONS_FILE))) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export function getKnownCategories(
  guidesRootDir: string = guidesDir,
  atlConfig?: AtlConfig
): Set<string> {
  const categories = new Set<string>(CATEGORIES.map(c => c.slug));
  categories.add('motion'); // Legacy category alias used in issue labels

  if (atlConfig?.default) {
    for (const cat of Object.keys(atlConfig.default)) categories.add(cat.toLowerCase());
  }

  try {
    for (const entry of fs.readdirSync(guidesRootDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || NON_CATEGORY_DIRS.has(entry.name)) continue;
      if (isCategoryDirectory(path.join(guidesRootDir, entry.name))) {
        categories.add(entry.name.toLowerCase());
      }
    }
  } catch {
    // Missing custom guidesRootDir in isolated tests is fine; static categories still apply.
  }

  return categories;
}

export function normalizeLabel(label: string): string {
  const clean = label.trim().toLowerCase().replace(/^(?:category|guides?):\s*/, '').trim();
  return clean === 'extensions' ? 'chrome-extensions' : clean;
}

export function extractCategoryFromIssueBody(issueDescription: string): string | null {
  const match =
    issueDescription.match(/Use case subdir:\s*\[guides\/([^/\]]+)/i) ||
    issueDescription.match(/###\s+Category\s*\r?\n+([^\r\n#]+)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

export function isContentRelatedIssue(
  labels: readonly string[],
  issueDescription: string,
  atlConfig?: AtlConfig,
  guidesRootDir?: string
): boolean {
  const categories = getKnownCategories(guidesRootDir, atlConfig);
  for (const label of labels) {
    const normalized = normalizeLabel(label);
    if (
      CONTENT_ISSUE_LABELS.has(normalized) ||
      categories.has(normalized) ||
      Boolean(atlConfig?.default[normalized]) ||
      Boolean(atlConfig?.web_features[normalized]) ||
      Boolean(atlConfig?.web_features_groups[normalized]) ||
      Boolean(featureGroups[normalized]) ||
      /^(?:category|guides?):/i.test(label)
    ) {
      return true;
    }
  }
  return Boolean(extractCategoryFromIssueBody(issueDescription)) || extractFeatureIds(issueDescription).length > 0;
}

export function extractFeatureIdsFromContent(content: string): string[] {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return [];

  const featureIds: string[] = [];
  let inWebFeatures = false;
  for (const line of match[1].split('\n')) {
    if (line.startsWith('web-feature-ids:')) {
      inWebFeatures = true;
      continue;
    }
    if (inWebFeatures) {
      if (line.trim().startsWith('-')) {
        const fid = line.replace(/^\s*-\s*/, '').trim();
        if (fid) featureIds.push(fid);
      } else if (/^[a-zA-Z0-9_-]+:/.test(line)) {
        inWebFeatures = false;
      }
    }
  }
  return featureIds;
}

export function getFeatureIdsFromGuide(guidePath: string): string[] {
  try {
    return extractFeatureIdsFromContent(fs.readFileSync(guidePath, 'utf8'));
  } catch {
    return [];
  }
}

function getFeatureIdVariants(fid: string): string[] {
  const base = stripTmpPrefix(fid);
  return [fid, base, `tmp-${base}`];
}

export function resolveFeatureDirectAtls(featureIds: readonly string[], atlConfig: AtlConfig): string[] {
  const out = new Set<string>();
  for (const fid of featureIds) {
    for (const variant of getFeatureIdVariants(fid)) {
      toAtlList(atlConfig.web_features[variant]).forEach(a => out.add(a));
    }
  }
  return Array.from(out);
}

export function resolveFeatureGroupAtls(
  featureIds: readonly string[],
  atlConfig: AtlConfig,
  guideCategory?: string
): string[] {
  const out = new Set<string>();
  const guideCatLower = guideCategory?.toLowerCase();
  for (const fid of featureIds) {
    for (const variant of getFeatureIdVariants(fid)) {
      for (const group of featureGroups[variant] || []) {
        // On guide PRs, don't let broad vertical groups (e.g. `css`, `security`) hijack
        // a guide that lives in another category directory (e.g. `performance/`, `accessibility/`).
        if (guideCatLower && group !== guideCatLower && atlConfig.default[group]) continue;
        toAtlList(atlConfig.web_features_groups[group]).forEach(a => out.add(a));
      }
    }
  }
  return Array.from(out);
}

export function getAtlsFromDescription(description: string, atlConfig: AtlConfig): string[] {
  if (!description) return [];
  const featureIds = Array.from(new Set(extractFeatureIds(description)));
  if (featureIds.length === 0) return [];
  return Array.from(
    new Set([
      ...resolveFeatureDirectAtls(featureIds, atlConfig),
      ...resolveFeatureGroupAtls(featureIds, atlConfig)
    ])
  );
}

export interface TranscludedGuide {
  category: string;
  relativePath: string;
  fullPath: string;
}

export function findGuidesTranscludingFeature(
  featureId: string,
  guidesRootDir: string = guidesDir
): TranscludedGuide[] {
  const matches: TranscludedGuide[] = [];
  const targetBaseId = stripTmpPrefix(featureId);

  function scanDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name === GUIDE_FILE || entry.name === SKILL_FILE)) {
        const category = path.relative(guidesRootDir, fullPath).split(path.sep)[0];
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (getTranscludedFeatureIds(content).some(t => stripTmpPrefix(t) === targetBaseId)) {
            matches.push({ category, relativePath: path.relative(rootDir, fullPath), fullPath });
          }
        } catch {
          // Ignore unreadable guide files during scan
        }
      }
    }
  }

  scanDir(guidesRootDir);
  return matches;
}

export interface PrimaryBlameAuthor {
  email: string;
  sha: string;
  bodyLines: number;
  share: number;
}

export function extractNoreplyLogin(email: string): string | null {
  const match = email.trim().toLowerCase().match(/^\d+\+([a-z0-9-]+)@users\.noreply\.github\.com$/);
  return match ? match[1] : null;
}

export function parsePrimaryBlameAuthor(
  guideMarkdown: string,
  blamePorcelain: string
): PrimaryBlameAuthor | null {
  const fmMatch = guideMarkdown.match(FRONTMATTER_RE);
  const fmLines = fmMatch ? fmMatch[0].replace(/\r?\n$/, '').split('\n').length : 0;

  const byEmail = new Map<string, { lines: number; sha: string }>();
  let totalBodyLines = 0;
  let curSha = '';
  let curFinalLine = 0;
  let curMail = '';

  for (const line of blamePorcelain.split('\n')) {
    const header = line.match(/^([0-9a-f]{40}) \d+ (\d+)/);
    if (header) {
      curSha = header[1];
      curFinalLine = Number(header[2]);
      continue;
    }
    if (line.startsWith('author-mail ')) {
      curMail = line.slice('author-mail '.length).trim().replace(/^<|>$/g, '').toLowerCase();
      continue;
    }
    if (line.startsWith('\t')) {
      const content = line.slice(1).trim();
      if (curFinalLine <= fmLines || !content || !curMail || ZERO_SHA_REGEX.test(curSha)) continue;
      totalBodyLines++;
      const existing = byEmail.get(curMail);
      if (existing) existing.lines++;
      else byEmail.set(curMail, { lines: 1, sha: curSha });
    }
  }

  if (totalBodyLines === 0) return null;

  let bestEmail = '';
  let bestEntry: { lines: number; sha: string } | null = null;
  for (const [email, entry] of byEmail) {
    if (!bestEntry || entry.lines > bestEntry.lines) {
      bestEmail = email;
      bestEntry = entry;
    }
  }

  if (!bestEntry) return null;
  const share = bestEntry.lines / totalBodyLines;
  if (bestEntry.lines < MIN_AUTHOR_BODY_LINES || share < MIN_AUTHOR_BODY_SHARE) return null;

  return { email: bestEmail, sha: bestEntry.sha, bodyLines: bestEntry.lines, share };
}

export interface SelectLeadReviewerInput {
  tiers: readonly (readonly string[])[];
  excludedLogins: ReadonlySet<string>;
  alreadyReviewedLogins?: ReadonlySet<string>;
  alreadyRequestedLogins?: ReadonlySet<string>;
  openReviewCounts?: ReadonlyMap<string, number> | (() => ReadonlyMap<string, number>);
  tieSeed?: number;
}

function dedupeEligible(candidates: readonly string[], excludedLogins: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidates) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (excludedLogins.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
  }
  return out;
}

export function selectLeadReviewer(input: SelectLeadReviewerInput): string | null {
  const reviewed = input.alreadyReviewedLogins ?? new Set<string>();
  const requested = input.alreadyRequestedLogins ?? new Set<string>();
  const tieSeed = input.tieSeed ?? 0;

  if (reviewed.size > 0) {
    for (const tier of input.tiers) {
      const eligible = dedupeEligible(tier, input.excludedLogins);
      const alreadyReviewed = eligible.find(c => reviewed.has(c.toLowerCase()));
      if (alreadyReviewed) return alreadyReviewed;
      if (eligible.some(c => requested.has(c.toLowerCase()))) break;
    }
  }

  for (const tier of input.tiers) {
    const eligible = dedupeEligible(tier, input.excludedLogins);
    if (eligible.length === 0) continue;

    const sticky = eligible.find(c => requested.has(c.toLowerCase()));
    if (sticky) return sticky;
    if (eligible.length === 1) return eligible[0];

    const counts =
      typeof input.openReviewCounts === 'function' ? input.openReviewCounts() : input.openReviewCounts;

    let minLoad = Infinity;
    for (const candidate of eligible) {
      const load = counts?.get(candidate.toLowerCase()) ?? 0;
      if (load < minLoad) minLoad = load;
    }
    const tied = eligible.filter(c => (counts?.get(c.toLowerCase()) ?? 0) === minLoad);
    return tied[Math.abs(tieSeed) % tied.length];
  }

  return null;
}

const PREVIEW_START = '<!-- mwg-demo-preview:start -->';
const PREVIEW_END = '<!-- mwg-demo-preview:end -->';
const PREVIEW_BLOB_BASE = 'https://mwg-demos.web.app/GoogleChrome/modern-web-guidance-src/blob';

export function upsertDemoPreviewInBody(headRef: string, currentBody: string, files: readonly string[]): string {
  const links = files
    .filter(f => /^guides\/[^/.][^/]*\/[^/.][^/]*\/demo(?:-.+)?\.html$/.test(f))
    .sort()
    .map(f => `[\`${f.replace(/^guides\/|\/demo\.html$/g, '')}\`](${PREVIEW_BLOB_BASE}/${headRef}/${f})`);

  if (!links.length && !currentBody.includes(PREVIEW_START)) return currentBody;

  const list = links.length === 1 ? links[0] : links.map(l => `\n- ${l}`).join('');
  const section = links.length ? `${PREVIEW_START}\n---\n🎨 **Demo preview:** ${list}\n${PREVIEW_END}` : '';
  const stripped = currentBody.replace(/\s*<!-- mwg-demo-preview:start -->[\s\S]*?<!-- mwg-demo-preview:end -->/g, '').trimEnd();
  return [stripped, section].filter(Boolean).join('\n\n');
}

export interface PrRoutingInput {
  prNumber: number;
  author: string;
  labels: readonly string[];
  files: readonly string[];
  atlConfig: AtlConfig;
  guidesRootDir?: string;
  reviewRequests?: readonly string[];
  reviews?: readonly string[];
  removedReviewers?: ReadonlySet<string>;
  unlabeledLabels?: ReadonlySet<string>;
  openReviewCounts?: ReadonlyMap<string, number> | (() => ReadonlyMap<string, number>);
  readPrGuideContent?: (relGuidePath: string) => string | null;
  readGuidePrimaryAuthor?: (guideAbsPath: string) => string | null;
}

export interface PrRoutingPlan {
  contentReviewers: string[];
  infraReviewers: string[];
  allResolvedReviewers: string[];
  reviewersToRequest: string[];
  labelsToAdd: string[];
  labelsToRemove: string[];
  leadChoices: Array<{ target: string; lead: string }>;
}

export function planPrRouting(input: PrRoutingInput): PrRoutingPlan {
  const guidesRoot = input.guidesRootDir ?? guidesDir;
  const knownCategories = getKnownCategories(guidesRoot, input.atlConfig);
  const reviewRequests = input.reviewRequests ?? [];
  const reviews = input.reviews ?? [];
  const removedLower = input.removedReviewers ?? new Set<string>();
  const unlabeledLower = input.unlabeledLabels ?? new Set<string>();

  const excludedForSelection = new Set<string>([input.author.toLowerCase(), ...removedLower]);
  const alreadyReviewedLogins = new Set<string>(reviews.map(r => r.toLowerCase()));
  const alreadyRequestedLogins = new Set<string>(reviewRequests.map(r => r.toLowerCase()));

  const contentLeads = new Set<string>();
  const leadChoices: Array<{ target: string; lead: string }> = [];
  let hasEvaluatedContent = false;
  let hasAnyConfiguredOwner = false;

  const pickLead = (target: string, tiers: string[][], hasStaticConfigOwner: boolean): void => {
    const lead = selectLeadReviewer({
      tiers,
      excludedLogins: excludedForSelection,
      alreadyReviewedLogins,
      alreadyRequestedLogins,
      openReviewCounts: input.openReviewCounts,
      tieSeed: input.prNumber
    });
    if (lead || hasStaticConfigOwner) hasAnyConfiguredOwner = true;
    if (lead) {
      contentLeads.add(lead);
      leadChoices.push({ target, lead });
    }
  };

  const seenGuides = new Set<string>();
  const seenSkills = new Set<string>();
  const seenFeatures = new Set<string>();

  for (const file of input.files) {
    const c = classifyRepoFile(file);
    if (c.kind === 'guide-content') {
      if (fs.existsSync(path.join(guidesRoot, c.category)) && !knownCategories.has(c.category.toLowerCase())) {
        continue;
      }
      hasEvaluatedContent = true;
      const guideKey = `${c.category}/${c.guideName}`.toLowerCase();
      if (seenGuides.has(guideKey)) continue;
      seenGuides.add(guideKey);

      const relGuidePath = `guides/${c.category}/${c.guideName}/${GUIDE_FILE}`;
      const guideAbsPath = path.join(guidesRoot, c.category, c.guideName, GUIDE_FILE);
      const prGuideContent = input.readPrGuideContent?.(relGuidePath) ?? null;
      const featureIds = prGuideContent
        ? extractFeatureIdsFromContent(prGuideContent)
        : getFeatureIdsFromGuide(guideAbsPath);

      const primaryAuthor = input.readGuidePrimaryAuthor?.(guideAbsPath) ?? null;
      const configTiers = [
        resolveFeatureDirectAtls(featureIds, input.atlConfig),
        resolveFeatureGroupAtls(featureIds, input.atlConfig, c.category),
        toAtlList(input.atlConfig.default[c.category])
      ];
      pickLead(
        `Guide "${c.category}/${c.guideName}" (feature IDs: ${featureIds.join(', ') || 'none'})`,
        [primaryAuthor ? [primaryAuthor] : [], ...configTiers],
        configTiers.some(t => t.length > 0)
      );
    } else if (c.kind === 'skill-content') {
      hasEvaluatedContent = true;
      if (seenSkills.has(c.skillName)) continue;
      seenSkills.add(c.skillName);

      const skillOwners = toAtlList(input.atlConfig.default[c.skillName]);
      pickLead(`Standalone skill "${c.skillName}"`, [skillOwners], skillOwners.length > 0);
    } else if (c.kind === 'feature-md') {
      hasEvaluatedContent = true;
      const key = c.featureId.toLowerCase();
      if (seenFeatures.has(key)) continue;
      seenFeatures.add(key);

      const transcludedCatAtls = findGuidesTranscludingFeature(c.featureId, guidesRoot).flatMap(g =>
        toAtlList(input.atlConfig.default[g.category])
      );
      const tiers = [
        resolveFeatureDirectAtls([c.featureId], input.atlConfig),
        resolveFeatureGroupAtls([c.featureId], input.atlConfig),
        transcludedCatAtls
      ];
      pickLead(`Feature "${c.featureId}"`, tiers, tiers.some(t => t.length > 0));
    }
  }

  const touchesSmeContent = input.files.some(isSmeContentFile);
  const labelsToAdd: string[] = [];
  const labelsToRemove: string[] = [];

  if (hasLabel(input.labels, AWAITING_CLA_LABEL)) {
    labelsToRemove.push(AWAITING_CLA_LABEL);
  }
  if (touchesSmeContent && !hasLabel(input.labels, 'content') && !unlabeledLower.has('content')) {
    labelsToAdd.push('content');
  }
  if (hasEvaluatedContent && !hasAnyConfiguredOwner) {
    if (!hasLabel(input.labels, 'needs-atl') && !unlabeledLower.has('needs-atl')) {
      labelsToAdd.push('needs-atl');
    }
  } else if (hasLabel(input.labels, 'needs-atl')) {
    labelsToRemove.push('needs-atl');
  }

  const contentReviewers = Array.from(contentLeads);
  const infraReviewers = resolveInfraReviewers(input.files);
  const allResolvedSet = new Set<string>([...contentReviewers, ...infraReviewers]);
  const skipRequestLower = new Set<string>([
    input.author.toLowerCase(),
    ...alreadyRequestedLogins,
    ...alreadyReviewedLogins,
    ...removedLower
  ]);
  const reviewersToRequest = Array.from(allResolvedSet).filter(
    r => !skipRequestLower.has(r.toLowerCase())
  );

  return {
    contentReviewers,
    infraReviewers,
    allResolvedReviewers: Array.from(allResolvedSet),
    reviewersToRequest,
    labelsToAdd,
    labelsToRemove,
    leadChoices
  };
}

export interface IssueTriageInput {
  labels: readonly string[];
  description: string;
  atlConfig: AtlConfig;
  guidesRootDir?: string;
  currentAssignees?: readonly string[];
  unassignedLoginsLower?: ReadonlySet<string>;
  unlabeledLower?: ReadonlySet<string>;
}

export interface IssueTriagePlan {
  matchedAtls: string[];
  assigneesToAdd: string[];
  labelsToAdd: string[];
  labelsToRemove: string[];
}

export function planIssueTriage(input: IssueTriageInput): IssueTriagePlan {
  const matched = new Set<string>();

  for (const label of input.labels) {
    const key = normalizeLabel(label);
    const hit =
      input.atlConfig.web_features[key] ??
      input.atlConfig.web_features_groups[key] ??
      input.atlConfig.default[key];
    toAtlList(hit).forEach(a => matched.add(a));
  }

  getAtlsFromDescription(input.description, input.atlConfig).forEach(a => matched.add(a));

  const bodyCategory = extractCategoryFromIssueBody(input.description);
  if (bodyCategory) {
    toAtlList(input.atlConfig.default[bodyCategory]).forEach(a => matched.add(a));
  }

  const currentLower = new Set((input.currentAssignees ?? []).map(a => a.toLowerCase()));
  const unassignedLower = input.unassignedLoginsLower ?? new Set<string>();
  const unlabeledLower = input.unlabeledLower ?? new Set<string>();

  const allKnownAtlsLower = new Set(
    [input.atlConfig.default, input.atlConfig.web_features, input.atlConfig.web_features_groups]
      .flatMap(Object.values)
      .flatMap(toAtlList)
      .map(a => a.toLowerCase())
  );
  const hasAssignedKnownAtl = Array.from(currentLower).some(a => allKnownAtlsLower.has(a));
  const isContent = isContentRelatedIssue(input.labels, input.description, input.atlConfig, input.guidesRootDir);
  const hasAtl = matched.size > 0 || hasAssignedKnownAtl;

  const labelsToAdd: string[] = [];
  const labelsToRemove: string[] = [];
  if (isContent && !hasAtl) {
    if (!hasLabel(input.labels, 'needs-atl') && !unlabeledLower.has('needs-atl')) {
      labelsToAdd.push('needs-atl');
    }
  } else if (hasLabel(input.labels, 'needs-atl')) {
    labelsToRemove.push('needs-atl');
  }

  const assigneesToAdd = Array.from(matched).filter(a => {
    const lower = a.toLowerCase();
    return !currentLower.has(lower) && !unassignedLower.has(lower);
  });

  return {
    matchedAtls: Array.from(matched),
    assigneesToAdd,
    labelsToAdd,
    labelsToRemove
  };
}
