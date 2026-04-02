import dotenv from 'dotenv';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { fileURLToPath } from 'url';
import { ProjectStatus, processGuideInventory, scanAllGuides } from '../lib/guide-validation.ts';

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
  needsReopen: boolean;
  closeReason: 'completed' | null;
  targetStatus: ProjectStatus | null;
}

interface ProjectDetails {
  projectId: string;
  statusFieldId: string;
  statusOptions: any[];
  issueStatusMap: Map<number, string>;
}

interface GitHubData {
  featureToIssueMap: Map<string, FeatureIssueData>;
  allUseCases: any[];
  nameToIssueMap: Map<string, any>;
  subdirToIssueMap: Map<string, any>;
  projectDetails: ProjectDetails | null;
}


// --- Constants ---

import { rootDir } from '../lib/paths.ts';

const REPO_ROOT = rootDir;
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const PRIORITY_LABEL_REGEX = /^P\d+$/;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PROJECT_GITHUB_TOKEN = process.env.PROJECT_GITHUB_TOKEN || GITHUB_TOKEN;
const ORG = 'GoogleChrome';
const REPO = 'guidance';
const PROJECT_NUMBER = 30;
// Default to dry run mode unless explicitly disabled.
const IS_DRY_RUN = process.env.DRY_RUN !== 'false';

if (IS_DRY_RUN) {
  console.log('🏃 Dry run mode enabled. No changes will be made to GitHub.');
}

if (!GITHUB_TOKEN && !IS_DRY_RUN) {
  console.error('Error: GITHUB_TOKEN environment variable is required.');
  process.exit(1);
}

const octokit: any = new Octokit({ auth: GITHUB_TOKEN });
const projectOctokit: any = new Octokit({ auth: PROJECT_GITHUB_TOKEN });

// --- Pure helpers ---


/**
 * Determines the project status name for a use case based on its completeness.
 * Returns null when the use case is complete.
 */

/**
 * Determines whether an existing issue needs to be closed or reopened.
 */
export function getIssueStateChanges(currentState: 'open' | 'closed', statusName: ProjectStatus | null, currentProjectStatus?: string): { needsClose: boolean; needsReopen: boolean } {
  const shouldBeOpen = statusName !== null || currentProjectStatus === ProjectStatus.NeedsInvestigation;
  return {
    needsClose: !shouldBeOpen && currentState === 'open',
    needsReopen: shouldBeOpen && currentState === 'closed',
  };
}

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
  featureToIssueMap: Map<string, FeatureIssueData>
): IssueContent {
  const relatedLinks: string[] = [];
  let priorityLabel: string | null = null;
  let milestoneNumber: number | null = null;

  for (const id of featureIds) {
    const featureData = featureToIssueMap.get(id);
    if (featureData) {
      relatedLinks.push(`#${featureData.number}`);
      if (!priorityLabel && featureData.priorityLabel) {
        priorityLabel = featureData.priorityLabel;
      }
      if (!milestoneNumber && featureData.milestoneNumber) {
        milestoneNumber = featureData.milestoneNumber;
      }
    }
  }

  const relatedFeaturesStr = relatedLinks.length > 0 ? `\n\nRelated features: ${relatedLinks.join(' ')}` : '';
  const subdirUrl = `https://github.com/${ORG}/${REPO}/tree/main/${relativeSubdir}`;
  const linkedFeatures = featureIds.map(id => `[${id}](https://webstatus.dev/features/${id})`).join(', ');

  return {
    issueTitle: `Create guide and evals for the ${name} use case`,
    issueBody: `${description}\n\nAffected web-feature IDs: ${linkedFeatures}\n\nUse case subdir: [${relativeSubdir}](${subdirUrl})${relatedFeaturesStr}`,
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
    const match = issue.body?.match(/Feature ID: ([a-z0-9-]+)/);
    if (match) {
      const priorityLabel = issue.labels
        .map((l: any) => (typeof l === 'string' ? l : l.name))
        .find((l: string) => PRIORITY_LABEL_REGEX.test(l)) || null;
      const milestoneNumber = issue.milestone ? issue.milestone.number : null;
      map.set(match[1], { number: issue.number, priorityLabel, milestoneNumber, state: issue.state, body: issue.body ?? '' });
    }
  }
  return map;
}

export const USE_CASES_START = '<!-- use-cases-start: automatically updated by sync-use-cases.ts, do not edit -->';
export const USE_CASES_END = '<!-- use-cases-end -->';

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
 * Returns the list of feature issues that need to be synced because they have
 * at least one active (incomplete) use case depending on them.
 */
export function getFeaturesNeedingSync(
  featureToIssueMap: Map<string, FeatureIssueData>,
  featuresWithActiveUseCases: Set<string>,
  featuresWithAnyUseCases: Set<string>,
  featuresNeedingInvestigation: Set<string> = new Set()
): FeatureToSync[] {
  const result: FeatureToSync[] = [];
  for (const [featureId, featureData] of featureToIssueMap) {
    const hasActiveUseCases = featuresWithActiveUseCases.has(featureId);
    const hasCompletedUseCases = !hasActiveUseCases && featuresWithAnyUseCases.has(featureId);

    if (hasActiveUseCases) {
      const isInvestigating = featuresNeedingInvestigation.has(featureId);
      result.push({
        featureId,
        issueNumber: featureData.number,
        needsReopen: featureData.state === 'closed',
        closeReason: null,
        targetStatus: isInvestigating ? ProjectStatus.NeedsInvestigation : ProjectStatus.NeedsEvals,
      });
    } else if (hasCompletedUseCases && featureData.state === 'open') {
      result.push({
        featureId,
        issueNumber: featureData.number,
        needsReopen: false,
        closeReason: 'completed',
        targetStatus: null,
      });
    } else if (!featuresWithAnyUseCases.has(featureId) && featureData.state === 'open') {
      result.push({
        featureId,
        issueNumber: featureData.number,
        needsReopen: false,
        closeReason: null,
        targetStatus: ProjectStatus.NeedsUseCases,
      });
    }
  }
  return result;
}

/**
 * Builds maps from use case name and subdirectory to their existing GitHub issues.
 */
export function buildUseCaseMaps(issues: any[]): { nameToIssueMap: Map<string, any>; subdirToIssueMap: Map<string, any> } {
  const nameToIssueMap = new Map<string, any>();
  const subdirToIssueMap = new Map<string, any>();
  for (const issue of issues) {
    const titleMatch = issue.title.match(/Create guide and evals for the (.+) use case/);
    if (titleMatch) {
      nameToIssueMap.set(titleMatch[1].trim(), issue);
    }
    const bodyMatch = issue.body?.match(/Use case subdir: \[([^\]]+)\]/);
    if (bodyMatch) {
      subdirToIssueMap.set(bodyMatch[1].trim(), issue);
    }
  }
  return { nameToIssueMap, subdirToIssueMap };
}


// --- GitHub API ---

async function getProjectDetails(org: string, number: number): Promise<ProjectDetails | null> {
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
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              content {
                ... on Issue {
                  number
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

    do {
      const response = await projectOctokit.graphql(query, { org, number, cursor }) as any;
      const project = response.organization.projectV2;

      if (!projectId) {
        projectId = project.id;
        const statusField = project.fields.nodes.find((f: any) => f.name === 'Status');
        if (!statusField) throw new Error('Status field not found in project');
        statusFieldId = statusField.id;
        statusOptions = statusField.options;
      }

      for (const item of project.items.nodes) {
        const issueNumber = item.content?.number;
        if (!issueNumber) continue;
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

async function updateProjectItemStatus(issueNumber: number, projectId: string, fieldId: string, optionId: string) {
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
    const addResult = await octokit.graphql(addItemMutation, { projectId, contentId: issueNodeId }) as any;
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
    await octokit.graphql(updateFieldMutation, { projectId, itemId, fieldId, optionId });
  } catch (err: any) {
    console.error(`Error updating project for issue #${issueNumber}:`, err.message);
  }
}

async function fetchGitHubData(): Promise<GitHubData> {
  let projectDetails = null;
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
      const featureIssues = await octokit.paginate(octokit.rest.issues.listForRepo, {
        owner: ORG,
        repo: REPO,
        labels: 'new-feature',
        state: 'all'
      });
      featureToIssueMap = buildFeatureToIssueMap(featureIssues);
      console.log(`Found ${featureToIssueMap.size} features with issues.`);
    } catch (err: any) {
      console.warn('⚠️ Could not fetch "new-feature" issues. Issue relation updates will be skipped.');
      if (!IS_DRY_RUN) throw err;
    }

    console.log('Fetching existing "new-use-case" issues...');
    try {
      allUseCases = await octokit.paginate(octokit.rest.issues.listForRepo, {
        owner: ORG,
        repo: REPO,
        labels: 'new-use-case',
        state: 'all'
      });
      ({ nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps(allUseCases));
    } catch (err: any) {
      console.warn('⚠️ Could not fetch existing "new-use-case" issues. Issue creation/updates will be skipped.');
      if (!IS_DRY_RUN) throw err;
    }
  } else if (IS_DRY_RUN) {
    console.warn('⚠️ GITHUB_TOKEN is not set. Project status updates will be skipped in this dry run.');
    console.log('ℹ️ Skipping GitHub issue fetches (no GITHUB_TOKEN set).');
  }

  return { featureToIssueMap, allUseCases, nameToIssueMap, subdirToIssueMap, projectDetails };
}

async function syncIssue(
  name: string,
  existingIssue: any | null,
  issueTitle: string,
  issueBody: string,
  priorityLabel: string | null,
  milestoneNumber: number | null,
  statusName: ProjectStatus | null,
  activeIssueNumbers: Set<number>,
  currentProjectStatus?: string
): Promise<{ issueNumber: number; changed: boolean }> {
  if (existingIssue) {
    const { needsClose, needsReopen } = getIssueStateChanges(existingIssue.state, statusName, currentProjectStatus);
    const currentLabels = (existingIssue.labels as any[]).map(l => typeof l === 'string' ? l : l.name);
    const desiredLabels = getDesiredLabels(currentLabels, priorityLabel);
    const labelsChanged = desiredLabels.length !== currentLabels.length || desiredLabels.some(l => !currentLabels.includes(l));
    const existingMilestoneNumber = existingIssue.milestone ? existingIssue.milestone.number : null;
    const targetMilestoneNumber = existingMilestoneNumber || milestoneNumber;
    const milestoneChanged = existingMilestoneNumber !== targetMilestoneNumber;
    const needsUpdate = existingIssue.title !== issueTitle || existingIssue.body !== issueBody || needsReopen || needsClose || labelsChanged || milestoneChanged;

    const issueNumber: number = existingIssue.number;
    activeIssueNumbers.add(issueNumber);

    if (needsUpdate) {
      console.log(`${IS_DRY_RUN ? '[DRY RUN] Would update' : 'Updating'} issue #${issueNumber} for "${name}"${needsReopen ? ' (reopening)' : ''}${needsClose ? ' (closing as completed)' : ''}${labelsChanged ? ' (updating labels)' : ''}${milestoneChanged ? ' (updating milestone)' : ''}...`);
      if (!IS_DRY_RUN) {
        await octokit.rest.issues.update({
          owner: ORG,
          repo: REPO,
          issue_number: issueNumber,
          title: issueTitle,
          body: issueBody,
          labels: desiredLabels,
          milestone: targetMilestoneNumber,
          ...(needsReopen ? { state: 'open' } : {}),
          ...(needsClose ? { state: 'closed', state_reason: 'completed' } : {})
        });
      } else {
        if (existingIssue.title !== issueTitle) console.log(`[DRY RUN] Title: ${issueTitle}`);
        if (labelsChanged) console.log(`[DRY RUN] Labels: ${desiredLabels.join(', ')}`);
        if (milestoneChanged) console.log(`[DRY RUN] Milestone: ${targetMilestoneNumber}`);
        if (needsReopen) console.log(`[DRY RUN] State: open`);
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

async function processUseCases(
  featureToIssueMap: Map<string, FeatureIssueData>,
  nameToIssueMap: Map<string, any>,
  subdirToIssueMap: Map<string, any>,
  projectDetails: ProjectDetails | null
): Promise<{ activeIssueNumbers: Set<number>; featuresWithActiveUseCases: Set<string>; featuresWithAnyUseCases: Set<string>; featuresNeedingInvestigation: Set<string>; featureUseCaseMap: Map<string, UseCaseEntry[]>; hasError: boolean; errors: string[] }> {
  const activeIssueNumbers = new Set<number>();
  const featuresNeedingInvestigation = new Set<string>();
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

  for (const { name, description, featureIds, relativeSubdir, statusName } of preparedGuides) {
    const { issueTitle, issueBody, priorityLabel, milestoneNumber } = buildIssueContent(name, description, featureIds, relativeSubdir, featureToIssueMap);
    const existingIssue = nameToIssueMap.get(name) || subdirToIssueMap.get(relativeSubdir);
    const existingIssueNumber = existingIssue?.number;
    const currentProjectStatus = existingIssueNumber ? projectDetails?.issueStatusMap.get(existingIssueNumber) : undefined;

    const { issueNumber, changed } = await syncIssue(name, existingIssue, issueTitle, issueBody, priorityLabel, milestoneNumber, statusName, activeIssueNumbers, currentProjectStatus);

    if (currentProjectStatus === ProjectStatus.NeedsInvestigation) {
      for (const id of featureIds) {
        featuresWithActiveUseCases.add(id);
        featuresNeedingInvestigation.add(id);
      }
    }

    for (const id of featureIds) {
      if (!featureUseCaseMap.has(id)) featureUseCaseMap.set(id, []);
      featureUseCaseMap.get(id)!.push({ name, issueNumber, complete: statusName === null });
    }

    let statusChanged = false;
    if (statusName && (issueNumber > 0 || IS_DRY_RUN)) {
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

  return { activeIssueNumbers, featuresWithActiveUseCases, featuresWithAnyUseCases, featuresNeedingInvestigation, featureUseCaseMap, hasError, errors };
}

async function syncFeatureIssues(
  featureToIssueMap: Map<string, FeatureIssueData>,
  featuresWithActiveUseCases: Set<string>,
  featuresWithAnyUseCases: Set<string>,
  featureUseCaseMap: Map<string, UseCaseEntry[]>,
  projectDetails: ProjectDetails | null,
  featuresNeedingInvestigation: Set<string>
) {
  if (!GITHUB_TOKEN && !IS_DRY_RUN) return;

  const featuresToSync = getFeaturesNeedingSync(featureToIssueMap, featuresWithActiveUseCases, featuresWithAnyUseCases, featuresNeedingInvestigation);
  if (featuresToSync.length === 0) return;

  console.log('🔄 Syncing feature issue states based on use case progress...');
  for (const { featureId, issueNumber, needsReopen, closeReason, targetStatus } of featuresToSync) {
    if (needsReopen) {
      console.log(`${IS_DRY_RUN ? '[DRY RUN] Would reopen' : 'Reopening'} feature issue #${issueNumber} (${featureId}) — has active use cases...`);
      if (!IS_DRY_RUN) {
        await octokit.rest.issues.update({
          owner: ORG,
          repo: REPO,
          issue_number: issueNumber,
          state: 'open'
        });
      }
    } else if (closeReason) {
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

  const { featureToIssueMap, allUseCases, nameToIssueMap, subdirToIssueMap, projectDetails } = await fetchGitHubData();
  const { activeIssueNumbers, featuresWithActiveUseCases, featuresWithAnyUseCases, featuresNeedingInvestigation, featureUseCaseMap, hasError, errors } = await processUseCases(featureToIssueMap, nameToIssueMap, subdirToIssueMap, projectDetails);
  await cleanupOrphanedIssues(allUseCases, activeIssueNumbers);
  await syncFeatureIssues(featureToIssueMap, featuresWithActiveUseCases, featuresWithAnyUseCases, featureUseCaseMap, projectDetails, featuresNeedingInvestigation);

  if (hasError) {
    console.error('\n🛑 Sync failed due to validation errors:\n');
    for (const error of errors) {
      console.error(`  ${error}`);
    }
    process.exit(1);
  }

  console.log('✨ Finished use case sync.');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
