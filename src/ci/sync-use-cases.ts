
import path from 'path';
import { Octokit } from '@octokit/rest';
import { fileURLToPath } from 'url';
import { ProjectStatus, processGuideInventory, scanAllGuides, type GuideInventory } from '../core/guide-validation.ts';
import { extractFeatureIds, stripTmpPrefix } from '../core/feature-parser.ts';
import { parseBooleanEnv } from '../core/env.ts';

// --- Types ---


export interface IssueContent {
  issueTitle: string;
  issueBody: string;
  priorityLabel: string | null;
  milestoneNumber: number | null;
}

export interface FeatureIssueData {
  number: number;
  priorityLabel: string | null;
  milestoneNumber: number | null;
  state: string;
  body: string;
}

export interface UseCaseEntry {
  name: string;
  issueNumber: number;
  complete: boolean;
}

export interface FeatureToSync {
  featureId: string;
  issueNumber: number;
  closeReason: 'completed' | null;
  targetStatus: ProjectStatus | null;
}

interface ProjectDetails {
  projectId: string;
  statusFieldId: string;
  statusOptions: any[];
  issueStatusMap: Map<number, string>;
}

export const NEEDS_INVESTIGATION_STATUS = 'Needs investigation';
export const MAX_NEW_ISSUES_PER_RUN = 15;

export interface FetchPaginationOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  expectNonEmpty?: boolean;
}

interface GitHubData {
  featureIssues: any[];
  featureToIssueMap: Map<string, FeatureIssueData>;
  allUseCases: any[];
  nameToIssueMap: Map<string, any>;
  subdirToIssueMap: Map<string, any>;
  projectDetails: ProjectDetails | null;
}


// --- Constants ---

import { rootDir } from '../core/paths.ts';

const REPO_ROOT = rootDir;
try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  // Ignore if missing
}

const PRIORITY_LABEL_REGEX = /^P\d+$/;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PROJECT_GITHUB_TOKEN = process.env.PROJECT_GITHUB_TOKEN || GITHUB_TOKEN;
const ORG = 'GoogleChrome';
const REPO = 'modern-web-guidance-src';
const PROJECT_NUMBER = 30;
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
const hasWriteFlag = process.argv.includes('--write') || process.argv.includes('--live');
const isDryRunEnv = parseBooleanEnv(process.env.DRY_RUN, true);
const IS_DRY_RUN = hasWriteFlag ? false : isDryRunEnv;

if (isMain && IS_DRY_RUN) {
  console.log('🏃 Dry run mode enabled. No changes will be made to GitHub.');
}

if (isMain && !GITHUB_TOKEN && !IS_DRY_RUN) {
  console.error('Error: GITHUB_TOKEN environment variable is required.');
  process.exit(1);
}

const octokit: any = new Octokit({ auth: GITHUB_TOKEN });
const projectOctokit: any = new Octokit({ auth: PROJECT_GITHUB_TOKEN });

// --- Pure helpers ---

/**
 * Computes the desired label set for a use case issue.
 * Ensures `new-use-case` is always present and adds a priority label if
 * one is available and the issue doesn't already have one.
 */
export function getDesiredLabels(currentLabels: string[], priorityLabel: string | null): string[] {
  const desired = [...new Set([...currentLabels, 'new-use-case'])];
  if (priorityLabel && !currentLabels.some(l => PRIORITY_LABEL_REGEX.test(l))) {
    desired.push(priorityLabel);
  }
  return desired;
}

/**
 * Builds the GitHub issue title, body, and priority label for a use case.
 */
export function buildIssueContent(
  name: string,
  description: string,
  featureIds: string[],
  relativeSubdir: string,
  featureToIssueMap: Map<string, FeatureIssueData>,
  inv: GuideInventory,
  existingMilestoneNumber: number | null | undefined = undefined
): IssueContent {
  const relatedLinks: string[] = [];
  let priorityLabel: string | null = null;
  let milestoneNumber: number | null = null;

  for (const id of featureIds) {
    const featureData = featureToIssueMap.get(stripTmpPrefix(id));
    if (featureData) {
      relatedLinks.push(`#${featureData.number}`);
      const sameMilestone =
        existingMilestoneNumber == null ||
        existingMilestoneNumber === featureData.milestoneNumber;
      if (!priorityLabel && featureData.priorityLabel && sameMilestone) {
        priorityLabel = featureData.priorityLabel;
      }
      if (!milestoneNumber && featureData.milestoneNumber && sameMilestone) {
        milestoneNumber = featureData.milestoneNumber;
      }
    }
  }

  const relatedFeaturesStr = relatedLinks.length > 0 ? `\n\nRelated features: ${relatedLinks.join(' ')}` : '';
  const subdirUrl = `https://github.com/${ORG}/${REPO}/tree/main/${relativeSubdir}`;
  const linkedFeatures = featureIds.map(id => {
    const cleanId = stripTmpPrefix(id);
    return `[${cleanId}](https://webstatus.dev/features/${cleanId})`;
  }).join(', ');

  const checklist = buildRequiredFilesChecklist(inv);
  const checklistSection = `\n\n${REQUIRED_FILES_START}\n**Required files:**\n${checklist}\n${REQUIRED_FILES_END}`;

  return {
    issueTitle: `Create guide for the ${name} use case`,
    issueBody: `${description}\n\nAffected web-feature IDs: ${linkedFeatures}\n\nUse case subdir: [${relativeSubdir}](${subdirUrl})${relatedFeaturesStr}${checklistSection}`,
    priorityLabel,
    milestoneNumber,
  };
}

/**
 * Builds a map from feature ID to issue number and priority label.
 */
export function buildFeatureToIssueMap(issues: any[]): Map<string, FeatureIssueData> {
  const map = new Map<string, FeatureIssueData>();
  for (const issue of issues) {
    const fids = extractFeatureIds(issue.body ?? '');
    for (const fid of fids) {
      const priorityLabel = issue.labels
        .map((l: any) => (typeof l === 'string' ? l : l.name))
        .find((l: string) => PRIORITY_LABEL_REGEX.test(l)) || null;
      const milestoneNumber = issue.milestone ? issue.milestone.number : null;
      const key = stripTmpPrefix(fid);
      const existing = map.get(key);
      if (!existing || (existing.state === 'closed' && issue.state === 'open')) {
        map.set(key, { number: issue.number, priorityLabel, milestoneNumber, state: issue.state, body: issue.body ?? '' });
      }
    }
  }
  return map;
}

export const USE_CASES_START = '<!-- use-cases-start: automatically updated by sync-use-cases.ts, do not edit -->';
export const USE_CASES_END = '<!-- use-cases-end -->';

export const REQUIRED_FILES_START = '<!-- required-files-start: automatically updated by sync-use-cases.ts, do not edit -->';
export const REQUIRED_FILES_END = '<!-- required-files-end -->';

export function buildRequiredFilesChecklist(inv: GuideInventory): string {
  const isGuidanceComplete = inv.hasGuide && !inv.draft;
  let guidanceLabel = 'Use case guidance (guide.md)';
  if (inv.hasGuide && inv.draft) {
    guidanceLabel += ` *(draft: ${inv.draft})*`;
  }
  const items = [
    `- [${(inv.isStub || inv.hasGuide) ? 'x' : ' '}] Use case metadata (guide.md frontmatter)`,
    `- [${inv.hasDemo ? 'x' : ' '}] demo.html`,
    `- [${isGuidanceComplete ? 'x' : ' '}] ${guidanceLabel}`,
    `- [${(inv.hasExpectations && !inv.expectationsEmpty) ? 'x' : ' '}] expectations.md`,
  ];
  return items.join('\n');
}

/**
 * Inserts or replaces the use case checklist section in a feature issue body.
 * Skips entries without an issue number (e.g. during dry runs before creation).
 */
export function buildUseCaseChecklist(useCases: UseCaseEntry[]): string {
  return useCases
    .filter(uc => uc.issueNumber > 0)
    .map(uc => `- [${uc.complete ? 'x' : ' '}] #${uc.issueNumber}`)
    .join('\n');
}

export function updateFeatureIssueBody(currentBody: string, useCases: UseCaseEntry[]): string {
  const checklist = buildUseCaseChecklist(useCases);
  const section = `${USE_CASES_START}\n**Use cases:**\n${checklist}\n${USE_CASES_END}`;

  const startIdx = currentBody.indexOf(USE_CASES_START);
  const endIdx = currentBody.indexOf(USE_CASES_END);
  if (startIdx !== -1 && endIdx !== -1) {
    const before = currentBody.slice(0, startIdx).trimEnd();
    const after = currentBody.slice(endIdx + USE_CASES_END.length).trimStart();
    return `${before}\n\n${section}${after ? `\n\n${after}` : ''}`;
  }
  return `${currentBody.trimEnd()}\n\n${section}`;
}

/**
 * Returns the list of open feature issues that need state or project status updates.
 * Once a `new-feature` issue is closed, it is never auto-reopened.
 */
export function getFeaturesNeedingSync(
  featureToIssueMap: Map<string, FeatureIssueData>,
  featuresWithActiveUseCases: Set<string>,
  featuresWithAnyUseCases: Set<string>
): FeatureToSync[] {
  const hasFeature = (set: Set<string>, id: string) => {
    const base = stripTmpPrefix(id);
    return set.has(base) || set.has(`tmp-${base}`);
  };
  const result: FeatureToSync[] = [];
  for (const [featureId, featureData] of featureToIssueMap) {
    if (featureData.state === 'closed') continue;

    const hasActiveUseCases = hasFeature(featuresWithActiveUseCases, featureId);
    const hasCompletedUseCases = !hasActiveUseCases && hasFeature(featuresWithAnyUseCases, featureId);

    if (hasActiveUseCases) {
      result.push({
        featureId,
        issueNumber: featureData.number,
        closeReason: null,
        targetStatus: ProjectStatus.NeedsUseCases,
      });
    } else if (hasCompletedUseCases) {
      result.push({
        featureId,
        issueNumber: featureData.number,
        closeReason: 'completed',
        targetStatus: null,
      });
    } else if (!hasFeature(featuresWithAnyUseCases, featureId)) {
      result.push({
        featureId,
        issueNumber: featureData.number,
        closeReason: null,
        targetStatus: ProjectStatus.NeedsUseCases,
      });
    }
  }
  return result;
}

/**
 * Reconciles items on Project #30 that GitHub Project's built-in auto-add workflow
 * defaulted to Status="Needs use cases" when opened:
 * - `new-feature` issues and closed `new-use-case` issues are left alone.
 * - Open `new-use-case` issues move to `"Needs guidance"`.
 * - All other issues (e.g. bug/feedback issues against existing guides like #2100)
 *   move to `"Needs investigation"`.
 */
export function reconcileNeedsUseCasesProjectStatus(
  issueStatusMap: Map<number, string>,
  featureIssues: Iterable<{ number: number }>,
  useCaseIssues: Iterable<{ number: number; state?: string }>,
): Map<number, string> {
  const featureNums = new Set(Array.from(featureIssues, f => f.number));
  const useCaseStateByNum = new Map(Array.from(useCaseIssues, u => [u.number, u.state ?? 'open']));
  const updates = new Map<number, string>();
  for (const [issueNumber, currentStatus] of issueStatusMap) {
    if (currentStatus.toLowerCase() !== ProjectStatus.NeedsUseCases.toLowerCase()) continue;
    if (featureNums.has(issueNumber) || useCaseStateByNum.get(issueNumber) === 'closed') continue;
    updates.set(
      issueNumber,
      useCaseStateByNum.has(issueNumber) ? ProjectStatus.NeedsGuidance : NEEDS_INVESTIGATION_STATUS
    );
  }
  return updates;
}

function shouldPreferIssue<T extends { number?: number }>(existing: T | undefined, candidate: T): boolean {
  if (!existing) return true;
  if (
    typeof existing.number === 'number' &&
    typeof candidate.number === 'number' &&
    existing.number !== candidate.number
  ) {
    return candidate.number < existing.number;
  }
  return true;
}

/**
 * Builds maps from use case name and subdirectory to their existing GitHub issues.
 * When duplicate issues match the same use case or subdirectory, always prefers
 * the oldest canonical issue (lowest issue number).
 */
export function buildUseCaseMaps<T extends { number?: number; title: string; body?: string | null }>(
  issues: T[]
): { nameToIssueMap: Map<string, T>; subdirToIssueMap: Map<string, T> } {
  const nameToIssueMap = new Map<string, T>();
  const subdirToIssueMap = new Map<string, T>();
  for (const issue of issues) {
    const titleMatch = issue.title.match(/Create guide(?: and evals)? for the (.+) use case/i);
    if (titleMatch) {
      const nameKey = titleMatch[1].trim();
      if (shouldPreferIssue(nameToIssueMap.get(nameKey), issue)) {
        nameToIssueMap.set(nameKey, issue);
      }
    }
    const bodyMatch = issue.body?.match(/Use case subdir: \[([^\]]+)\]/);
    if (bodyMatch) {
      const subdirKey = bodyMatch[1].trim();
      if (shouldPreferIssue(subdirToIssueMap.get(subdirKey), issue)) {
        subdirToIssueMap.set(subdirKey, issue);
      }
    }
    const templateCategoryMatch = issue.body?.match(/###\s+Category\s*\r?\n+([^\r\n#]+)/i);
    const templateSlugMatch = issue.body?.match(/###\s+Use case slug\s*\r?\n+([^\r\n#]+)/i);
    if (templateCategoryMatch && templateSlugMatch) {
      const category = templateCategoryMatch[1].trim().toLowerCase();
      const slug = templateSlugMatch[1].trim().toLowerCase();
      if (category && slug) {
        if (shouldPreferIssue(nameToIssueMap.get(slug), issue)) {
          nameToIssueMap.set(slug, issue);
        }
        const subdirKey = `guides/${category}/${slug}`;
        if (shouldPreferIssue(subdirToIssueMap.get(subdirKey), issue)) {
          subdirToIssueMap.set(subdirKey, issue);
        }
      }
    }
  }
  return { nameToIssueMap, subdirToIssueMap };
}

/**
 * Guards against mass spurious issue creation when a GitHub API response is truncated.
 */
export function assertSafeNewIssueCount(
  totalPreparedGuides: number,
  missingGuideNames: string[],
  maxNewIssues: number = MAX_NEW_ISSUES_PER_RUN,
  allowMassCreate: boolean = false,
): void {
  if (allowMassCreate) return;
  if (missingGuideNames.length > maxNewIssues) {
    const preview = missingGuideNames.slice(0, 5).join(', ');
    const suffix = missingGuideNames.length > 5 ? `, ... (${missingGuideNames.length - 5} more)` : '';
    throw new Error(
      `Refusing to create ${missingGuideNames.length} new use-case issues in a single sync run ` +
      `(out of ${totalPreparedGuides} guides; max allowed per run is ${maxNewIssues}: ${preview}${suffix}). ` +
      `This usually indicates an incomplete GitHub API response. Set ALLOW_MASS_ISSUE_CREATE=true if intentional.`
    );
  }
}


// --- GitHub API ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches all repository issues matching a label via GraphQL cursor pagination,
 * verifying `totalCount` and retrying if GitHub intermittently returns an empty page.
 */
export async function fetchIssuesByLabel(
  graphqlFn: (query: string, variables: Record<string, any>) => Promise<any>,
  owner: string,
  repo: string,
  label: string,
  options: FetchPaginationOptions = {}
): Promise<any[]> {
  const { maxRetries = 5, retryDelayMs = 500, expectNonEmpty = true } = options;
  const query = `
    query($owner: String!, $repo: String!, $label: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        issues(
          first: 100
          after: $cursor
          labels: [$label]
          states: [OPEN, CLOSED]
          orderBy: { field: CREATED_AT, direction: DESC }
        ) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            body
            state
            milestone {
              number
            }
            labels(first: 50) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `;

  const results: any[] = [];
  const seenNumbers = new Set<number>();
  let rawFetchedCount = 0;
  let expectedTotal: number | null = null;
  let cursor: string | null = null;

  do {
    let pageData: any = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await graphqlFn(query, { owner, repo, label, cursor });
        const issuesConn = response?.repository?.issues;
        if (!issuesConn) {
          throw new Error(`Missing repository.issues in GraphQL response for label "${label}"`);
        }

        const totalCount: number = issuesConn.totalCount ?? 0;
        const nodes: any[] = issuesConn.nodes ?? [];
        const hasNextPage: boolean = Boolean(issuesConn.pageInfo?.hasNextPage);
        const targetTotal = totalCount > 0 ? totalCount : expectedTotal;

        if (expectNonEmpty && rawFetchedCount === 0 && (totalCount === 0 || nodes.length === 0)) {
          throw new Error(`Empty first page for label "${label}" (totalCount=${totalCount}, nodes=${nodes.length})`);
        }
        if (targetTotal !== null && targetTotal > 0 && (totalCount === 0 || nodes.length === 0)) {
          throw new Error(`Empty page during pagination for label "${label}" at cursor ${cursor} (totalCount=${totalCount}, nodes=${nodes.length})`);
        }
        if (targetTotal !== null && !hasNextPage && rawFetchedCount + nodes.length < targetTotal) {
          throw new Error(
            `Truncated pagination for label "${label}": fetched ${rawFetchedCount + nodes.length} of ${targetTotal} issues with hasNextPage=false`
          );
        }

        pageData = issuesConn;
        break;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries && retryDelayMs > 0) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }

    if (!pageData) {
      throw lastError ?? new Error(`Failed to fetch issues for label "${label}"`);
    }

    if (pageData.totalCount > 0) {
      expectedTotal = pageData.totalCount;
    } else if (expectedTotal === null) {
      expectedTotal = 0;
    }

    const nodes: any[] = pageData.nodes ?? [];
    rawFetchedCount += nodes.length;
    for (const node of nodes) {
      if (!node || typeof node.number !== 'number' || seenNumbers.has(node.number)) continue;
      seenNumbers.add(node.number);
      results.push({
        number: node.number,
        title: node.title ?? '',
        body: node.body ?? '',
        state: String(node.state ?? 'OPEN').toLowerCase(),
        milestone: node.milestone ? { number: node.milestone.number } : null,
        labels: (node.labels?.nodes ?? []).map((l: any) => ({ name: l.name })),
      });
    }

    const { hasNextPage, endCursor } = pageData.pageInfo ?? {};
    cursor = hasNextPage ? endCursor : null;
  } while (cursor);

  if (expectedTotal !== null && rawFetchedCount < expectedTotal) {
    throw new Error(
      `Incomplete issue list for label "${label}": expected ${expectedTotal} issues, fetched ${rawFetchedCount}`
    );
  }

  return results;
}

export async function getProjectDetails(
  org: string,
  number: number,
  graphqlFn: (query: string, variables: Record<string, any>) => Promise<any> = (q, v) => projectOctokit.graphql(q, v),
  options: FetchPaginationOptions = {}
): Promise<ProjectDetails | null> {
  const { maxRetries = 5, retryDelayMs = 500, expectNonEmpty = true } = options;
  console.log(`Fetching project details for ${org} project #${number}...`);
  const query = `
    query($org: String!, $number: Int!, $cursor: String) {
      organization(login: $org) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
          items(first: 100, after: $cursor) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              content {
                ... on Issue {
                  number
                  state
                }
              }
              fieldValues(first: 10) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2SingleSelectField {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const issueStatusMap = new Map<number, string>();
    let cursor: string | null = null;
    let projectId: string | null = null;
    let statusFieldId: string | null = null;
    let statusOptions: any[] = [];
    let rawFetchedCount = 0;
    let expectedTotal: number | null = null;

    do {
      let project: any = null;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await graphqlFn(query, { org, number, cursor });
          const proj = response?.organization?.projectV2;
          if (!proj?.items) {
            throw new Error('Missing organization.projectV2.items in GraphQL response');
          }

          const totalCount: number = proj.items.totalCount ?? 0;
          const nodes: any[] = proj.items.nodes ?? [];
          const hasNextPage: boolean = Boolean(proj.items.pageInfo?.hasNextPage);
          const targetTotal = totalCount > 0 ? totalCount : expectedTotal;

          if (expectNonEmpty && rawFetchedCount === 0 && (totalCount === 0 || nodes.length === 0)) {
            throw new Error(`Empty first page for project #${number} items (totalCount=${totalCount}, nodes=${nodes.length})`);
          }
          if (targetTotal !== null && targetTotal > 0 && (totalCount === 0 || nodes.length === 0)) {
            throw new Error(`Empty page during project #${number} pagination at cursor ${cursor} (totalCount=${totalCount}, nodes=${nodes.length})`);
          }
          if (targetTotal !== null && !hasNextPage && rawFetchedCount + nodes.length < targetTotal) {
            throw new Error(
              `Truncated project #${number} items pagination: fetched ${rawFetchedCount + nodes.length} of ${targetTotal} items with hasNextPage=false`
            );
          }

          project = proj;
          break;
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < maxRetries && retryDelayMs > 0) {
            await sleep(retryDelayMs * attempt);
          }
        }
      }

      if (!project) {
        throw lastError ?? new Error(`Failed to fetch project #${number} items`);
      }

      if (!projectId) {
        projectId = project.id;
        const statusField = project.fields.nodes.find((f: any) => f.name === 'Status');
        if (!statusField) throw new Error('Status field not found in project');
        statusFieldId = statusField.id;
        statusOptions = statusField.options;
      }

      if (project.items.totalCount > 0) {
        expectedTotal = project.items.totalCount;
      } else if (expectedTotal === null) {
        expectedTotal = 0;
      }

      const nodes: any[] = project.items.nodes ?? [];
      rawFetchedCount += nodes.length;
      for (const item of nodes) {
        const issueNumber = item.content?.number;
        if (!issueNumber || item.content?.state === 'CLOSED') continue;
        const statusValue = item.fieldValues.nodes.find((v: any) => v.field?.name === 'Status');
        if (statusValue) {
          issueStatusMap.set(issueNumber, statusValue.name);
        }
      }

      const { hasNextPage, endCursor } = project.items.pageInfo;
      cursor = hasNextPage ? endCursor : null;
    } while (cursor);

    console.log(`Fetched current status for ${issueStatusMap.size} project items.`);
    return { projectId: projectId!, statusFieldId: statusFieldId!, statusOptions, issueStatusMap };
  } catch (err: any) {
    console.error('Error fetching project details:', err.message);
    return null;
  }
}

async function updateProjectItemStatus(
  issueNumber: number,
  projectId: string,
  fieldId: string,
  optionId: string
) {
  try {
    const issueResponse = await octokit.rest.issues.get({
      owner: ORG,
      repo: REPO,
      issue_number: issueNumber
    });
    const issueNodeId = issueResponse.data.node_id;

    const addItemMutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
          item {
            id
          }
        }
      }
    `;
    const addResult = await projectOctokit.graphql(addItemMutation, { projectId, contentId: issueNodeId }) as any;
    const itemId = addResult.addProjectV2ItemById.item.id;

    const updateFieldMutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: {
            singleSelectOptionId: $optionId
          }
        }) {
          projectV2Item {
            id
          }
        }
      }
    `;
    await projectOctokit.graphql(updateFieldMutation, { projectId, itemId, fieldId, optionId });
  } catch (err: any) {
    console.error(`Error updating project for issue #${issueNumber}:`, err.message);
  }
}

async function fetchGitHubData(): Promise<GitHubData> {
  let projectDetails = null;
  let featureIssues: any[] = [];
  let featureToIssueMap = new Map<string, FeatureIssueData>();
  let allUseCases: any[] = [];
  let nameToIssueMap = new Map<string, any>();
  let subdirToIssueMap = new Map<string, any>();

  if (GITHUB_TOKEN) {
    projectDetails = await getProjectDetails(ORG, PROJECT_NUMBER);
    if (!projectDetails) {
      console.warn('⚠️ Could not fetch project details. Project updates will be skipped.');
    }

    console.log('Fetching "new-feature" issues...');
    try {
      featureIssues = await fetchIssuesByLabel(
        (q, v) => octokit.graphql(q, v),
        ORG,
        REPO,
        'new-feature'
      );
      featureToIssueMap = buildFeatureToIssueMap(featureIssues);
      console.log(`Found ${featureToIssueMap.size} features with issues.`);
    } catch (err: any) {
      console.warn('⚠️ Could not fetch "new-feature" issues. Issue relation updates will be skipped.');
      if (!IS_DRY_RUN) throw err;
    }

    console.log('Fetching existing "new-use-case" issues...');
    try {
      allUseCases = await fetchIssuesByLabel(
        (q, v) => octokit.graphql(q, v),
        ORG,
        REPO,
        'new-use-case'
      );
      ({ nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps(allUseCases));
    } catch (err: any) {
      console.warn('⚠️ Could not fetch existing "new-use-case" issues. Issue creation/updates will be skipped.');
      if (!IS_DRY_RUN) throw err;
    }
  } else if (IS_DRY_RUN) {
    console.warn('⚠️ GITHUB_TOKEN is not set. Project status updates will be skipped in this dry run.');
    console.log('ℹ️ Skipping GitHub issue fetches (no GITHUB_TOKEN set).');
  }

  return { featureIssues, featureToIssueMap, allUseCases, nameToIssueMap, subdirToIssueMap, projectDetails };
}

async function syncIssue(
  name: string,
  existingIssue: any | null,
  issueTitle: string,
  issueBody: string,
  priorityLabel: string | null,
  milestoneNumber: number | null,
  statusName: ProjectStatus | null,
  activeIssueNumbers: Set<number>
): Promise<{ issueNumber: number; changed: boolean }> {
  if (existingIssue) {
    const issueNumber: number = existingIssue.number;
    activeIssueNumbers.add(issueNumber);

    // Completed creation issues stay closed permanently without body/label churn.
    if (existingIssue.state === 'closed') {
      return { issueNumber, changed: false };
    }

    const needsClose = statusName === null;
    const currentLabels = (existingIssue.labels as any[]).map(l => typeof l === 'string' ? l : l.name);
    const desiredLabels = getDesiredLabels(currentLabels, priorityLabel);
    const labelsChanged = desiredLabels.length !== currentLabels.length || desiredLabels.some(l => !currentLabels.includes(l));
    const existingMilestoneNumber = existingIssue.milestone ? existingIssue.milestone.number : null;
    const targetMilestoneNumber = existingMilestoneNumber || milestoneNumber;
    const milestoneChanged = existingMilestoneNumber !== targetMilestoneNumber;
    const needsUpdate = existingIssue.title !== issueTitle || existingIssue.body !== issueBody || needsClose || labelsChanged || milestoneChanged;

    if (needsUpdate) {
      console.log(`${IS_DRY_RUN ? '[DRY RUN] Would update' : 'Updating'} issue #${issueNumber} for "${name}"${needsClose ? ' (closing as completed)' : ''}${labelsChanged ? ' (updating labels)' : ''}${milestoneChanged ? ' (updating milestone)' : ''}...`);
      if (!IS_DRY_RUN) {
        await octokit.rest.issues.update({
          owner: ORG,
          repo: REPO,
          issue_number: issueNumber,
          title: issueTitle,
          body: issueBody,
          labels: desiredLabels,
          milestone: targetMilestoneNumber,
          ...(needsClose ? { state: 'closed', state_reason: 'completed' } : {})
        });
      } else {
        if (existingIssue.title !== issueTitle) console.log(`[DRY RUN] Title: ${issueTitle}`);
        if (labelsChanged) console.log(`[DRY RUN] Labels: ${desiredLabels.join(', ')}`);
        if (milestoneChanged) console.log(`[DRY RUN] Milestone: ${targetMilestoneNumber}`);
        if (needsClose) console.log(`[DRY RUN] State: closed (completed)`);
        if (existingIssue.body !== issueBody) console.log(`[DRY RUN] Body:\n${issueBody}\n`);
      }
    }

    return { issueNumber, changed: needsUpdate };
  } else {
    const isComplete = statusName === null;
    const labels = getDesiredLabels([], priorityLabel);

    console.log(`${IS_DRY_RUN ? '[DRY RUN] Would create' : 'Creating'} new issue for "${name}"${isComplete ? ' (closing immediately as completed)' : ''}...`);
    if (!IS_DRY_RUN) {
      const newIssue = await octokit.rest.issues.create({
        owner: ORG,
        repo: REPO,
        title: issueTitle,
        body: issueBody,
        labels,
        ...(milestoneNumber ? { milestone: milestoneNumber } : {})
      });
      const issueNumber: number = newIssue.data.number;
      activeIssueNumbers.add(issueNumber);
      if (isComplete) {
        await octokit.rest.issues.update({
          owner: ORG,
          repo: REPO,
          issue_number: issueNumber,
          state: 'closed',
          state_reason: 'completed'
        });
      }
      return { issueNumber, changed: true };
    } else {
      console.log(`[DRY RUN] Title: ${issueTitle}`);
      console.log(`[DRY RUN] Labels: ${labels.join(', ')}`);
      if (milestoneNumber) console.log(`[DRY RUN] Milestone: ${milestoneNumber}`);
      if (isComplete) console.log(`[DRY RUN] State: closed (completed)`);
      console.log(`[DRY RUN] Body:\n${issueBody}\n`);
      return { issueNumber: 0, changed: true };
    }
  }
}

export function preserveTemplateUseCases(
  allUseCases: any[],
  activeIssueNumbers: Set<number>,
  featureUseCaseMap: Map<string, UseCaseEntry[]>,
  featuresWithActiveUseCases: Set<string>,
  featuresWithAnyUseCases: Set<string>
): void {
  for (const issue of allUseCases) {
    if (activeIssueNumbers.has(issue.number)) continue;
    const body = issue.body ?? '';
    if (issue.state === 'open' && !body.includes(REQUIRED_FILES_START)) {
      activeIssueNumbers.add(issue.number);
      const slugMatch = body.match(/###\s+Use case slug\s*\r?\n+([^\r\n#]+)/i) || issue.title?.match(/Create guide(?: and evals)? for the (.+) use case/i);
      const slug = slugMatch ? slugMatch[1].trim().toLowerCase() : `issue-${issue.number}`;
      for (const id of extractFeatureIds(body)) {
        const normalizedId = stripTmpPrefix(id);
        featuresWithAnyUseCases.add(normalizedId);
        featuresWithActiveUseCases.add(normalizedId);
        if (!featureUseCaseMap.has(normalizedId)) featureUseCaseMap.set(normalizedId, []);
        featureUseCaseMap.get(normalizedId)!.push({ name: slug, issueNumber: issue.number, complete: false });
      }
    }
  }
}

async function processUseCases(
  featureToIssueMap: Map<string, FeatureIssueData>,
  allUseCases: any[],
  nameToIssueMap: Map<string, any>,
  subdirToIssueMap: Map<string, any>,
  projectDetails: ProjectDetails | null
): Promise<{ activeIssueNumbers: Set<number>; featuresWithActiveUseCases: Set<string>; featuresWithAnyUseCases: Set<string>; featureUseCaseMap: Map<string, UseCaseEntry[]>; hasError: boolean; errors: string[] }> {
  const activeIssueNumbers = new Set<number>();
  const featureUseCaseMap = new Map<string, UseCaseEntry[]>();

  const guides = scanAllGuides();
  console.log(`Found ${guides.length} use cases.`);

  const { errors, hasError, featuresWithActiveUseCases, featuresWithAnyUseCases, preparedGuides, incompleteSubdirs } = processGuideInventory(guides);

  for (const relativeSubdir of incompleteSubdirs) {
    // Prevent the cleanup step from treating any existing issue as an orphan —
    // the use case directory exists, it's just missing some required files.
    const partialIssue = subdirToIssueMap.get(relativeSubdir);
    if (partialIssue) activeIssueNumbers.add(partialIssue.number);
  }

  if (GITHUB_TOKEN || !IS_DRY_RUN) {
    const missingGuideNames = preparedGuides
      .filter(({ name, relativeSubdir }) => !nameToIssueMap.get(name) && !subdirToIssueMap.get(relativeSubdir))
      .map(({ name }) => name);
    assertSafeNewIssueCount(
      preparedGuides.length,
      missingGuideNames,
      MAX_NEW_ISSUES_PER_RUN,
      parseBooleanEnv(process.env.ALLOW_MASS_ISSUE_CREATE, false)
    );
  }

  for (const { name, description, featureIds, relativeSubdir, statusName } of preparedGuides) {
    const inv = guides.find(g => path.relative(REPO_ROOT, g.dir) === relativeSubdir);
    if (!inv) {
      console.warn(`⚠️ Could not find inventory for ${relativeSubdir}`);
      continue;
    }
    const existingIssue = nameToIssueMap.get(name) || subdirToIssueMap.get(relativeSubdir);
    const existingMilestoneNumber = existingIssue
      ? (existingIssue.milestone ? existingIssue.milestone.number : null)
      : undefined;
    const { issueTitle, issueBody, priorityLabel, milestoneNumber } = buildIssueContent(
      name,
      description,
      featureIds,
      relativeSubdir,
      featureToIssueMap,
      inv,
      existingMilestoneNumber
    );

    const { issueNumber, changed } = await syncIssue(name, existingIssue, issueTitle, issueBody, priorityLabel, milestoneNumber, statusName, activeIssueNumbers);

    for (const id of featureIds) {
      const normalizedId = stripTmpPrefix(id);
      if (!featureUseCaseMap.has(normalizedId)) featureUseCaseMap.set(normalizedId, []);
      featureUseCaseMap.get(normalizedId)!.push({ name, issueNumber, complete: statusName === null });
    }

    let statusChanged = false;
    if (statusName && existingIssue?.state !== 'closed' && (issueNumber > 0 || IS_DRY_RUN)) {
      if (projectDetails) {
        const currentStatus = projectDetails.issueStatusMap.get(issueNumber);
        if (currentStatus?.toLowerCase() !== statusName.toLowerCase()) {
          const option = projectDetails.statusOptions.find((o: any) => o.name.toLowerCase() === statusName.toLowerCase());
          if (option) {
            statusChanged = true;
            console.log(`${IS_DRY_RUN ? '[DRY RUN] Would set' : 'Setting'} project #${PROJECT_NUMBER} status for #${issueNumber || 'NEW'} to "${statusName}"...`);
            if (!IS_DRY_RUN) {
              await updateProjectItemStatus(issueNumber, projectDetails.projectId, projectDetails.statusFieldId, option.id);
            }
          } else {
            console.warn(`⚠️ Could not find option ID for status "${statusName}"`);
          }
        }
      } else {
        statusChanged = true;
        console.log(`[DRY RUN] Would set project #${PROJECT_NUMBER} status to "${statusName}" (but project details are unavailable)`);
      }
    }

    if (!changed && !statusChanged) {
      console.log(`✅ Issue #${issueNumber} for "${name}" is up to date.`);
    }
  }

  // Preserve open template-filed new-use-case issues that do not yet have a guide directory on disk
  preserveTemplateUseCases(allUseCases, activeIssueNumbers, featureUseCaseMap, featuresWithActiveUseCases, featuresWithAnyUseCases);

  return { activeIssueNumbers, featuresWithActiveUseCases, featuresWithAnyUseCases, featureUseCaseMap, hasError, errors };
}

async function syncFeatureIssues(
  featureIssues: any[],
  featureToIssueMap: Map<string, FeatureIssueData>,
  featuresWithActiveUseCases: Set<string>,
  featuresWithAnyUseCases: Set<string>,
  featureUseCaseMap: Map<string, UseCaseEntry[]>,
  projectDetails: ProjectDetails | null,
  allUseCases: any[],
) {
  if (!GITHUB_TOKEN && !IS_DRY_RUN) return;

  const featuresToSync = getFeaturesNeedingSync(featureToIssueMap, featuresWithActiveUseCases, featuresWithAnyUseCases);
  if (featuresToSync.length > 0) {
    console.log('🔄 Syncing feature issue states based on use case progress...');
  }
  for (const { featureId, issueNumber, closeReason, targetStatus } of featuresToSync) {
    if (closeReason) {
      console.log(`${IS_DRY_RUN ? '[DRY RUN] Would close' : 'Closing'} feature issue #${issueNumber} (${featureId}) as completed — all use cases implemented...`);
      if (!IS_DRY_RUN) {
        await octokit.rest.issues.update({
          owner: ORG,
          repo: REPO,
          issue_number: issueNumber,
          state: 'closed',
          state_reason: closeReason
        });
      }
    }

    const featureStatusName = targetStatus;
    if (featureStatusName && projectDetails) {
      const currentStatus = projectDetails.issueStatusMap.get(issueNumber);
      if (currentStatus?.toLowerCase() !== featureStatusName.toLowerCase()) {
        const option = projectDetails.statusOptions.find((o: any) => o.name.toLowerCase() === featureStatusName.toLowerCase());
        if (option) {
          console.log(`${IS_DRY_RUN ? '[DRY RUN] Would set' : 'Setting'} project status for feature #${issueNumber} to "${featureStatusName}"...`);
          if (!IS_DRY_RUN) {
            await updateProjectItemStatus(issueNumber, projectDetails.projectId, projectDetails.statusFieldId, option.id);
          }
        } else {
          console.warn(`⚠️ Could not find option ID for status "${featureStatusName}"`);
        }
      }
    } else if (featureStatusName && IS_DRY_RUN) {
      console.log(`[DRY RUN] Would set project status to "${featureStatusName}" for feature #${issueNumber} (but project details are unavailable)`);
    }
  }

  // Reconcile any items on Project #30 that were auto-assigned "Needs use cases" by GitHub's
  // default project workflow (such as issues against existing guides like #2100).
  if (projectDetails && featureIssues.length > 0) {
    for (const [issueNumber, targetStatus] of reconcileNeedsUseCasesProjectStatus(
      projectDetails.issueStatusMap,
      featureIssues,
      allUseCases,
    )) {
      const option = projectDetails.statusOptions.find((o: any) => o.name.toLowerCase() === targetStatus.toLowerCase());
      if (!option) continue;
      console.log(`${IS_DRY_RUN ? '[DRY RUN] Would set' : 'Setting'} project status for #${issueNumber} from "${ProjectStatus.NeedsUseCases}" to "${targetStatus}"...`);
      if (!IS_DRY_RUN) {
        await updateProjectItemStatus(issueNumber, projectDetails.projectId, projectDetails.statusFieldId, option.id);
      }
    }
  }

  // Update use case checklists in feature issue bodies (open and closed)
  for (const [featureId, useCases] of featureUseCaseMap) {
    const featureData = featureToIssueMap.get(featureId);
    if (!featureData) continue;

    const newBody = updateFeatureIssueBody(featureData.body, useCases);
    if (newBody === featureData.body) continue;

    const checklist = buildUseCaseChecklist(useCases);
    console.log(`${IS_DRY_RUN ? '[DRY RUN] Would update' : 'Updating'} use case checklist for #${featureData.number} (${featureId}):\n${checklist}`);
    if (!IS_DRY_RUN) {
      await octokit.rest.issues.update({
        owner: ORG,
        repo: REPO,
        issue_number: featureData.number,
        body: newBody
      });
    }
  }
}

async function cleanupOrphanedIssues(allUseCases: any[], activeIssueNumbers: Set<number>) {
  if (!GITHUB_TOKEN) {
    if (IS_DRY_RUN) {
      console.log('ℹ️ Skipping orphaned issue cleanup (no GITHUB_TOKEN set).');
    }
    return;
  }

  console.log('🧹 Checking for orphaned issues to cleanup...');
  for (const issue of allUseCases) {
    if (activeIssueNumbers.has(issue.number)) continue;

    if (issue.state === 'open') {
      console.log(`${IS_DRY_RUN ? '[DRY RUN] Would close' : 'Closing'} orphaned issue #${issue.number} ("${issue.title}")...`);
      if (!IS_DRY_RUN) {
        try {
          await octokit.rest.issues.update({
            owner: ORG,
            repo: REPO,
            issue_number: issue.number,
            state: 'closed',
            state_reason: 'not_planned'
          });
        } catch (err: any) {
          console.warn(`⚠️ Could not close orphaned issue #${issue.number}: ${err.message}`);
        }
      }
    }

    console.log(`${IS_DRY_RUN ? '[DRY RUN] Would remove label' : 'Removing label'} from orphaned issue #${issue.number} ("${issue.title}")...`);
    if (!IS_DRY_RUN) {
      try {
        await octokit.rest.issues.removeLabel({
          owner: ORG,
          repo: REPO,
          issue_number: issue.number,
          name: 'new-use-case'
        });
      } catch (err: any) {
        console.warn(`⚠️ Could not remove label from orphaned issue #${issue.number}: ${err.message}`);
      }
    }
  }
}

async function run() {
  console.log('🚀 Starting use case sync...');

  const { featureIssues, featureToIssueMap, allUseCases, nameToIssueMap, subdirToIssueMap, projectDetails } = await fetchGitHubData();
  const { activeIssueNumbers, featuresWithActiveUseCases, featuresWithAnyUseCases, featureUseCaseMap, hasError, errors } = await processUseCases(featureToIssueMap, allUseCases, nameToIssueMap, subdirToIssueMap, projectDetails);
  await cleanupOrphanedIssues(allUseCases, activeIssueNumbers);
  await syncFeatureIssues(featureIssues, featureToIssueMap, featuresWithActiveUseCases, featuresWithAnyUseCases, featureUseCaseMap, projectDetails, allUseCases);

  if (hasError) {
    console.error('\n🛑 Sync failed due to validation errors:\n');
    for (const error of errors) {
      console.error(`  ${error}`);
    }
    process.exit(1);
  }

  console.log('✨ Finished use case sync.');
}

if (isMain) {
  run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
