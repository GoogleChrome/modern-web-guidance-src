import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { Octokit } from '@octokit/rest';
import matter from 'gray-matter';
import { features } from 'web-features';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

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

/**
 * Recursively find all guide.md files in a directory.
 */
function findGuides(dir: string): string[] {
  const guideFiles: string[] = [];

  function find(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip test directories to avoid noise
        if (!entry.name.includes('test')) {
          find(fullPath);
        }
      } else if (entry.name === 'guide.md') {
        guideFiles.push(fullPath);
      }
    }
  }

  find(dir);
  return guideFiles;
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

  const featureIds = data['web-feature-ids'] || [];
  if (!Array.isArray(featureIds)) {
    errors.push(`"web-feature-ids" must be an array in ${relativePath}.`);
  } else {
    for (const id of featureIds) {
      const feature = (features as any)[id];
      if (!feature) {
        errors.push(`Web feature ID "${id}" not found in web-features package (${relativePath}).`);
      } else if (feature.kind !== 'feature') {
        let suggestion = '';
        if (feature.kind === 'moved') {
          suggestion = ` (It has been moved to "${feature.redirect_target}")`;
        } else if (feature.kind === 'split') {
          suggestion = ` (It has been split into: ${feature.redirect_targets.join(', ')})`;
        }
        errors.push(`Web feature ID "${id}" is a ${feature.kind} record, not a primary feature${suggestion} in ${relativePath}.`);
      }
    }
  }

  return { errors, data, body, filePath };
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'GoogleChrome';
const REPO = 'guidance';
const PROJECT_NUMBER = 30;
const ORG = 'GoogleChrome';

const IS_DRY_RUN = process.env.DRY_RUN === 'true';
const PR_NUMBER = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER) : undefined;

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

async function getRenamedPaths(owner: string, repo: string, prNumber: number) {
  console.log(`Fetching renamed files for PR #${prNumber}...`);
  const renamedMap = new Map<string, string>();
  try {
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: prNumber
    });
    for (const file of files) {
      if (file.status === 'renamed' && file.previous_filename) {
        const newDir = path.dirname(file.filename);
        const oldDir = path.dirname(file.previous_filename);
        renamedMap.set(newDir, oldDir);
      }
    }
  } catch (err: any) {
    console.warn(`⚠️ Could not fetch PR file list to detect renames: ${err.message}`);
  }
  return renamedMap;
}

async function run() {
  console.log('🚀 Starting use case sync...');

  let hasError = false;

  const projectDetails = await getProjectDetails(ORG, PROJECT_NUMBER);
  if (!projectDetails) {
    console.warn('⚠️ Could not fetch project details. Project updates will be skipped.');
  }

  // Fetch renames if running in a PR context
  const renamedPaths = PR_NUMBER ? await getRenamedPaths(OWNER, REPO, PR_NUMBER) : null;

  // 1. Fetch all 'new-feature' issues to build Feature ID -> Issue Number mapping
  console.log('Fetching "new-feature" issues...');
  let featureToIssueMap = new Map<string, number>();
  try {
    const featureIssues = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner: OWNER,
      repo: REPO,
      labels: 'new-feature',
      state: 'all'
    });

    for (const issue of featureIssues) {
      const match = issue.body?.match(/Feature ID: ([a-z0-9-]+)/);
      if (match) {
        featureToIssueMap.set(match[1], issue.number);
      }
    }
    console.log(`Found ${featureToIssueMap.size} features with issues.`);
  } catch (err: any) {
    console.warn('⚠️ Could not fetch "new-feature" issues. Issue relation updates will be skipped.');
    if (!IS_DRY_RUN) throw err;
  }

  // 2. Fetch all existing 'new-use-case' issues
  console.log('Fetching existing "new-use-case" issues...');
  let nameToIssueMap = new Map<string, any>();
  let subdirToIssueMap = new Map<string, any>();
  try {
    const existingUseCases = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner: OWNER,
      repo: REPO,
      labels: 'new-use-case',
      state: 'all'
    });

    for (const issue of existingUseCases) {
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

  // 3. Find and validate all guide.md files
  const guidesDir = path.resolve(REPO_ROOT, 'guides');
  const guideFiles = findGuides(guidesDir);
  console.log(`Found ${guideFiles.length} guide.md files.`);

  for (const guidePath of guideFiles) {
    const relativePath = path.relative(REPO_ROOT, guidePath);
    const subdir = path.dirname(guidePath);

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
    let statusName = 'Needs guidance';
    if (body.trim().length > 0) {
      const graderPath = path.join(subdir, 'grader.ts');
      if (fs.existsSync(graderPath)) {
        statusName = 'Done';
      } else {
        statusName = 'Needs evals';
      }
    }

    // Build related features string
    const relatedLinks: string[] = [];
    for (const id of featureIds) {
      const issueNum = featureToIssueMap.get(id);
      if (issueNum) {
        relatedLinks.push(`#${issueNum}`);
      }
    }
    const relatedFeaturesStr = relatedLinks.length > 0 ? `\n\nRelated features: ${relatedLinks.join(' ')}` : '';

    const relativeSubdir = path.relative(REPO_ROOT, subdir);
    const subdirUrl = `https://github.com/${OWNER}/${REPO}/tree/main/${relativeSubdir}`;
    const linkedFeatures = (featureIds as string[]).map(id => `[${id}](https://webstatus.dev/features/${id})`).join(', ');

    const issueTitle = `Create guide and evals for the ${name} use case`;
    const issueBody = `${description}\n\nAffected web-feature IDs: ${linkedFeatures}\n\nUse case subdir: [${relativeSubdir}](${subdirUrl})${relatedFeaturesStr}`;

    let existingIssue = nameToIssueMap.get(name);

    if (!existingIssue) {
      let lookupSubdir = relativeSubdir;
      // If we are in a PR and this path was renamed, look up by the OLD path
      if (renamedPaths && renamedPaths.has(relativeSubdir)) {
        lookupSubdir = renamedPaths.get(relativeSubdir)!;
        console.log(`🔍 Detected directory move for ${relativeSubdir} (formerly ${lookupSubdir}). Searching for existing issue...`);
      }

      existingIssue = subdirToIssueMap.get(lookupSubdir);
      if (existingIssue) {
        const oldName = existingIssue.title.match(/the (.+) use case/)?.[1] || 'unknown';
        console.log(`ℹ️ Detected rename/move for use case "${name}" (formerly "${oldName}" in ${lookupSubdir}). Updating existing issue #${existingIssue.number}.`);
      }
    }

    let issueNumber: number;

    if (existingIssue) {
      const needsUpdate = existingIssue.title !== issueTitle || existingIssue.body !== issueBody;
      issueNumber = existingIssue.number;

      if (needsUpdate) {
        console.log(`${IS_DRY_RUN ? '[DRY RUN] Would update' : 'Updating'} issue #${issueNumber} for "${name}"...`);
        if (!IS_DRY_RUN) {
          await octokit.rest.issues.update({
            owner: OWNER,
            repo: REPO,
            issue_number: issueNumber,
            title: issueTitle,
            body: issueBody
          });
        } else {
          console.log(`[DRY RUN] Title: ${issueTitle}`);
          console.log(`[DRY RUN] Labels: new-use-case`);
          console.log(`[DRY RUN] Body:\n${issueBody}\n`);
        }
      } else {
        console.log(`✅ Issue #${issueNumber} for "${name}" is up to date.`);
      }
    } else {
      console.log(`${IS_DRY_RUN ? '[DRY RUN] Would create' : 'Creating'} new issue for "${name}"...`);
      if (!IS_DRY_RUN) {
        const newIssue = await octokit.rest.issues.create({
          owner: OWNER,
          repo: REPO,
          title: issueTitle,
          body: issueBody,
          labels: ['new-use-case']
        });
        issueNumber = newIssue.data.number;
      } else {
        console.log(`[DRY RUN] Title: ${issueTitle}`);
        console.log(`[DRY RUN] Labels: new-use-case`);
        console.log(`[DRY RUN] Body:\n${issueBody}\n`);
        issueNumber = 0; // Placeholder for dry run
      }
    }

    // Update Project Status
    if (issueNumber > 0 || IS_DRY_RUN) {
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
      owner: OWNER,
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
