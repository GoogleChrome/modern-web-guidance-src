import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Octokit } from '@octokit/rest';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import { validateMacros } from '../serving/mcp-server/lib/macros.ts';
import { validateFeature } from '../serving/mcp-server/data/baseline.ts';

interface GuideData {
  name?: string;
  description?: string;
  'web-feature-ids'?: string[];
  [key: string]: any;
}

interface ValidationResult {
  errors: string[];
  data: GuideData;
  body: string;
  filePath: string;
}


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const PRIORITY_LABEL_REGEX = /^P\d+$/;



/**
 * Recursively find all use case directories.
 */
function findUseCaseDirs(dir: string): string[] {
  const useCaseDirs: string[] = [];

  function find(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    let isUseCase = false;
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip test directories to avoid noise
        if (!entry.name.includes('test')) {
          find(fullPath);
        }
      } else if (['guide.md', 'demo.html', 'grader.ts', 'prompts.md'].includes(entry.name)) {
        isUseCase = true;
      }
    }
    if (isUseCase) {
      useCaseDirs.push(currentDir);
    }
  }

  find(dir);
  return useCaseDirs;
}

/**
 * Validate a guide file's frontmatter and content.
 */
function validateGuide(filePath: string): ValidationResult {
  const errors: string[] = [];
  const relativePath = path.relative(REPO_ROOT, filePath);

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return {
      errors: [`Could not read file: ${e}`],
      data: {},
      body: '',
      filePath
    };
  }

  const { data: rawData, content: body } = matter(content);
  const data = rawData as GuideData;

  if (!data.name) {
    errors.push(`Missing "name" in frontmatter for ${relativePath}.`);
  }

  if (!data.description) {
    errors.push(`Missing "description" in frontmatter for ${relativePath}.`);
  }

  const featureIds = data['web-feature-ids'];
  if (featureIds === undefined) {
    errors.push(
      `Missing "web-feature-ids" in frontmatter for ${relativePath}.`,
    );
  } else if (!Array.isArray(featureIds)) {
    errors.push(`"web-feature-ids" must be an array in ${relativePath}.`);
  } else {
    for (const id of featureIds) {
      const result = validateFeature(id);
      if (!result.isValid) {
        errors.push(`${result.errorMessage} (${relativePath}).`);
      }
    }
  }

  // Validate macros in the body
  errors.push(...validateMacros(body, relativePath));

  return { errors, data, body, filePath };
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ORG = 'GoogleChrome';
const REPO = 'guidance';
const PROJECT_NUMBER = 30;

const IS_DRY_RUN = process.env.DRY_RUN === 'true';

if (IS_DRY_RUN) {
  console.log('🏃 Dry run mode enabled. No changes will be made to GitHub.');
}

if (!GITHUB_TOKEN && !IS_DRY_RUN) {
  console.error('Error: GITHUB_TOKEN environment variable is required.');
  process.exit(1);
}

const octokit: any = new Octokit({ auth: GITHUB_TOKEN });

async function getProjectDetails(org: string, number: number) {
  console.log(`Fetching project details for ${org} project #${number}...`);
  const query = `
    query($org: String!, $number: Int!) {
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
        }
      }
    }
  `;

  try {
    const response = await octokit.graphql(query, { org, number }) as any;
    const project = response.organization.projectV2;
    const statusField = project.fields.nodes.find((f: any) => f.name === 'Status');

    if (!statusField) {
      throw new Error('Status field not found in project');
    }

    return {
      projectId: project.id,
      statusFieldId: statusField.id,
      statusOptions: statusField.options
    };
  } catch (err: any) {
    console.error('Error fetching project details:', err.message);
    return null;
  }
}


async function run() {
  console.log('🚀 Starting use case sync...');

  let hasError = false;

  let projectDetails = null;
  if (GITHUB_TOKEN) {
    projectDetails = await getProjectDetails(ORG, PROJECT_NUMBER);
    if (!projectDetails) {
      console.warn('⚠️ Could not fetch project details. Project updates will be skipped.');
    }
  } else if (IS_DRY_RUN) {
    console.warn('⚠️ GITHUB_TOKEN is not set. Project status updates will be skipped in this dry run.');
  }

  const featureToIssueMap = new Map<string, { number: number; priorityLabel: string | null }>();
  const nameToIssueMap = new Map<string, any>();
  const subdirToIssueMap = new Map<string, any>();
  let allUseCases: any[] = [];

  if (GITHUB_TOKEN) {
    // 1. Fetch all 'new-feature' issues to build Feature ID -> Issue Number mapping
    console.log('Fetching "new-feature" issues...');
    try {
      const featureIssues = await octokit.paginate(octokit.rest.issues.listForRepo, {
        owner: ORG,
        repo: REPO,
        labels: 'new-feature',
        state: 'all'
      });

      for (const issue of featureIssues) {
        const match = issue.body?.match(/Feature ID: ([a-z0-9-]+)/);
        if (match) {
          const priorityLabel = issue.labels
            .map((l: any) => (typeof l === 'string' ? l : l.name))
            .find((l: string) => PRIORITY_LABEL_REGEX.test(l)) || null;
          featureToIssueMap.set(match[1], { number: issue.number, priorityLabel });
        }
      }
      console.log(`Found ${featureToIssueMap.size} features with issues.`);
    } catch (err: any) {
      console.warn('⚠️ Could not fetch "new-feature" issues. Issue relation updates will be skipped.');
      if (!IS_DRY_RUN) throw err;
    }
  } else if (IS_DRY_RUN) {
    console.log('ℹ️ Skipping "new-feature" issue fetch (no GITHUB_TOKEN set).');
  }

  if (GITHUB_TOKEN) {
    // 2. Fetch all existing 'new-use-case' issues
    console.log('Fetching existing "new-use-case" issues...');
    try {
      allUseCases = await octokit.paginate(octokit.rest.issues.listForRepo, {
        owner: ORG,
        repo: REPO,
        labels: 'new-use-case',
        state: 'all'
      });

      for (const issue of allUseCases) {
        // 1. Map by name from the title
        const titleMatch = issue.title.match(/Create guide and evals for the (.+) use case/);
        if (titleMatch) {
          nameToIssueMap.set(titleMatch[1].trim(), issue);
        }

        // 2. Map by subdirectory from the body
        const bodyMatch = issue.body?.match(/Use case subdir: \[([^\]]+)\]/);
        if (bodyMatch) {
          subdirToIssueMap.set(bodyMatch[1].trim(), issue);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ Could not fetch existing "new-use-case" issues. Issue creation/updates will be skipped.');
      if (!IS_DRY_RUN) throw err;
    }
  } else if (IS_DRY_RUN) {
    console.log('ℹ️ Skipping existing "new-use-case" issue fetch (no GITHUB_TOKEN set).');
  }

  const activeIssueNumbers = new Set<number>();

  // 3. Find and validate all use case directories
  const guidesDir = path.resolve(REPO_ROOT, 'guides');
  const useCaseDirs = findUseCaseDirs(guidesDir);
  console.log(`Found ${useCaseDirs.length} use cases.`);

  for (const subdir of useCaseDirs) {
    const relativeSubdir = path.relative(REPO_ROOT, subdir);
    const guidePath = path.join(subdir, 'guide.md');
    const demoPath = path.join(subdir, 'demo.html');
    const graderPath = path.join(subdir, 'grader.ts');
    const promptsPath = path.join(subdir, 'prompts.md');

    const hasGuide = fs.existsSync(guidePath);
    const hasDemo = fs.existsSync(demoPath) && fs.readFileSync(demoPath, 'utf8').trim().length > 0;
    const hasGrader = fs.existsSync(graderPath) && fs.readFileSync(graderPath, 'utf8').trim().length > 0;
    const hasPrompts = fs.existsSync(promptsPath) && fs.readFileSync(promptsPath, 'utf8').trim().length > 0;

    if (hasGuide !== hasDemo) {
      const missingFile = hasGuide ? 'demo.html' : 'guide.md';
      console.warn(`⚠️ Warning in ${relativeSubdir}: Missing ${missingFile}. Must have BOTH guide.md and demo.html before advancing to the "Needs guidance" column.`);
    }

    if (hasGrader !== hasPrompts) {
      const missingFile = hasGrader ? 'prompts.md' : 'grader.ts';
      console.warn(`⚠️ Warning in ${relativeSubdir}: Missing ${missingFile}. Must have BOTH grader.ts and prompts.md before advancing to completed.`);
    }

    if (!hasGuide || !hasDemo) {
      // Prevent the cleanup step from treating any existing issue as an orphan —
      // the use case directory exists, it's just missing some required files.
      const partialIssue = subdirToIssueMap.get(relativeSubdir);
      if (partialIssue) {
        activeIssueNumbers.add(partialIssue.number);
      }
      continue;
    }

    const { errors, data, body } = validateGuide(guidePath);

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`❌ Error: ${error}`);
      }
      hasError = true;
      if (!data.name) continue;
    }

    const name = data.name!;
    const description = data.description || '';
    const featureIds = data['web-feature-ids'] || [];

    // Determine project status
    let statusName: string | null = null;
    if (body.trim().length === 0) {
      statusName = 'Needs guidance';
    } else if (!hasGrader || !hasPrompts) {
      statusName = 'Needs evals';
    }

    // Build related features string
    const relatedLinks: string[] = [];
    let priorityLabel: string | null = null;
    for (const id of featureIds) {
      const featureData = featureToIssueMap.get(id);
      if (featureData) {
        relatedLinks.push(`#${featureData.number}`);
        if (!priorityLabel && featureData.priorityLabel) {
          priorityLabel = featureData.priorityLabel;
        }
      }
    }
    const relatedFeaturesStr = relatedLinks.length > 0 ? `\n\nRelated features: ${relatedLinks.join(' ')}` : '';

    const subdirUrl = `https://github.com/${ORG}/${REPO}/tree/main/${relativeSubdir}`;
    const linkedFeatures = (featureIds as string[]).map(id => `[${id}](https://webstatus.dev/features/${id})`).join(', ');

    const issueTitle = `Create guide and evals for the ${name} use case`;
    const issueBody = `${description}\n\nAffected web-feature IDs: ${linkedFeatures}\n\nUse case subdir: [${relativeSubdir}](${subdirUrl})${relatedFeaturesStr}`;

    const existingIssue = nameToIssueMap.get(name) || subdirToIssueMap.get(relativeSubdir);
    let issueNumber: number;

    if (existingIssue) {
      const shouldBeOpen = statusName !== null;
      const needsClose = !shouldBeOpen && existingIssue.state === 'open';
      const needsReopen = shouldBeOpen && existingIssue.state === 'closed';

      const currentLabels = (existingIssue.labels as any[]).map(l => typeof l === 'string' ? l : l.name);
      const desiredLabels = [...new Set([...currentLabels, 'new-use-case'])];

      // Only add priority if the issue doesn't have one yet
      if (priorityLabel && !currentLabels.some(l => PRIORITY_LABEL_REGEX.test(l))) {
        desiredLabels.push(priorityLabel);
      }
      const labelsChanged = desiredLabels.length !== currentLabels.length || desiredLabels.some(l => !currentLabels.includes(l));

      const needsUpdate = existingIssue.title !== issueTitle || existingIssue.body !== issueBody || needsReopen || needsClose || labelsChanged;

      issueNumber = existingIssue.number;
      activeIssueNumbers.add(issueNumber);

      if (needsUpdate) {
        console.log(`${IS_DRY_RUN ? '[DRY RUN] Would update' : 'Updating'} issue #${issueNumber} for "${name}"${needsReopen ? ' (reopening)' : ''}${needsClose ? ' (closing as completed)' : ''}${labelsChanged ? ' (updating labels)' : ''}...`);
        if (!IS_DRY_RUN) {
          await octokit.rest.issues.update({
            owner: ORG,
            repo: REPO,
            issue_number: issueNumber,
            title: issueTitle,
            body: issueBody,
            labels: desiredLabels,
            ...(needsReopen ? { state: 'open' } : {}),
            ...(needsClose ? { state: 'closed', state_reason: 'completed' } : {})
          });
        } else {
          console.log(`[DRY RUN] Title: ${issueTitle}`);
          console.log(`[DRY RUN] Labels: ${desiredLabels.join(', ')}`);
          if (needsReopen) console.log(`[DRY RUN] State: open`);
          if (needsClose) console.log(`[DRY RUN] State: closed (completed)`);
          console.log(`[DRY RUN] Body:\n${issueBody}\n`);
        }
      } else {
        console.log(`✅ Issue #${issueNumber} for "${name}" is up to date.`);
      }
    } else {
      const isComplete = statusName === null;
      const labels = ['new-use-case'];
      if (priorityLabel) labels.push(priorityLabel);

      console.log(`${IS_DRY_RUN ? '[DRY RUN] Would create' : 'Creating'} new issue for "${name}"${isComplete ? ' (closing immediately as completed)' : ''}...`);
      if (!IS_DRY_RUN) {
        const newIssue = await octokit.rest.issues.create({
          owner: ORG,
          repo: REPO,
          title: issueTitle,
          body: issueBody,
          labels
        });
        issueNumber = newIssue.data.number;
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
      } else {
        console.log(`[DRY RUN] Title: ${issueTitle}`);
        console.log(`[DRY RUN] Labels: ${labels.join(', ')}`);
        if (isComplete) console.log(`[DRY RUN] State: closed (completed)`);
        console.log(`[DRY RUN] Body:\n${issueBody}\n`);
        issueNumber = 0; // Placeholder for dry run
      }
    }

    // Update Project Status
    if (statusName && (issueNumber > 0 || IS_DRY_RUN)) {
      if (projectDetails) {
        const option = projectDetails.statusOptions.find((o: any) => o.name.toLowerCase() === statusName.toLowerCase());
        if (option) {
          console.log(`${IS_DRY_RUN ? '[DRY RUN] Would set' : 'Setting'} project #${PROJECT_NUMBER} status for #${issueNumber || 'NEW'} to "${statusName}"...`);
          if (!IS_DRY_RUN) {
            await updateProjectItemStatus(issueNumber, projectDetails.projectId, projectDetails.statusFieldId, option.id);
          }
        } else {
          console.warn(`⚠️ Could not find option ID for status "${statusName}"`);
        }
      } else {
        console.log(`[DRY RUN] Would set project #${PROJECT_NUMBER} status to "${statusName}" (but project details are unavailable)`);
      }
    }
  }

  if (GITHUB_TOKEN) {
    // 4. Cleanup: Close issues and remove labels for use cases that no longer exist
    console.log('🧹 Checking for orphaned issues to cleanup...');
    for (const issue of allUseCases) {
      if (!activeIssueNumbers.has(issue.number)) {
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
  } else if (IS_DRY_RUN) {
    console.log('ℹ️ Skipping orphaned issue cleanup (no GITHUB_TOKEN set).');
  }

  if (hasError) {
    console.error('\n🛑 Sync failed due to validation errors.');
    process.exit(1);
  }

  console.log('✨ Finished use case sync.');
}

async function updateProjectItemStatus(issueNumber: number, projectId: string, fieldId: string, optionId: string) {
  try {
    // First, find the item ID in the project
    // This is tricky because we need the global node ID of the issue
    const issueResponse = await octokit.rest.issues.get({
      owner: ORG,
      repo: REPO,
      issue_number: issueNumber
    });
    const issueNodeId = issueResponse.data.node_id;

    // Add/Get item in project
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

    // Update status field
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

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
