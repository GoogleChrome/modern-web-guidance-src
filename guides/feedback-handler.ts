/**
 * feedback-handler.ts
 *
 * Handles feedback left on PRs by synthesizing reviews and applying fixes.
 *
 * Usage:
 *   node guides/feedback-handler.ts <pr-number>
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';


import { runCommand, runGemini } from './lib/utils.ts';



// ─── Main logic ─────────────────────────────────────────────────────────────

async function fetchPRContext(prNumber: string): Promise<any> {
  console.log('Fetching PR context via gh CLI...');
  const prDataJson = await runCommand('gh', ['pr', 'view', prNumber, '--json', 'reviews,comments,headRefName,files']);
  const prData = JSON.parse(prDataJson);
  console.log(`PR Branch: ${prData.headRefName}`);
  console.log(`Found ${prData.reviews.length} reviews and ${prData.comments.length} comments.`);
  return prData;
}

function deriveGuideDirectory(prData: any): string {
  const guideFile = prData.files.find((f: any) => f.path.startsWith('guides/'));
  let guideDir = '';
  if (guideFile) {
    const parts = guideFile.path.split('/');
    if (parts.length >= 3) {
      guideDir = path.join(parts[0], parts[1], parts[2]);
      console.log(`Affected guide directory: ${guideDir}`);
    }
  }
  return guideDir;
}

async function synthesizeFeedback(prNumber: string, prData: any): Promise<string> {
  console.log('Synthesizing feedback with Gemini...');
  const prompt = `
You are a coordinator for an AI coding agent. Below is the JSON data for PR #${prNumber}, including reviews and comments.

Tasks:
1. Resolve conflicting feedback: If there is conflicting feedback, flag it clearly.
2. Filter noise: Ignore LGTM or general chatter.
3. Deduplicate: Group similar feedback.
4. Output a structured TODO list for the coding agent.

PR Data:
${JSON.stringify(prData)}

Output your response as a clear markdown summary and TODO list.
`;

  const synthesis = await runGemini(prompt);
  console.log('\n--- Synthesis & Plan ---');
  console.log(synthesis);
  console.log('------------------------\n');
  return synthesis;
}

async function postPlanToPR(prNumber: string, synthesis: string): Promise<void> {
  console.log('Posting plan to PR...');
  const body = `On it!

<details><summary>Plan from feedback-handler</summary>

${synthesis}

</details>`;
  await runCommand('gh', ['pr', 'comment', prNumber, '-b', body]);
  console.log('✅ Plan posted');
}

async function applyFixesToSourceFiles(guideDir: string, synthesis: string): Promise<void> {
  console.log('Applying fixes to source files...');
  const applyPrompt = `
You are an AI coding agent. Your task is to apply the following fixes to the files in the guide directory \`${guideDir}\` to address PR feedback.

Synthesized Plan:
${synthesis}

Please read the files in \`${guideDir}\` and update them (e.g., \`demo.html\`, \`guide.md\`) to implement the requested changes.
Focus on the source files. Do not run \`gd dev\` or try to calibrate the grader, that will be done in a separate step.
Use your file editing tools to make the changes.
`;
  try {
    await runGemini(applyPrompt);
    console.log('✅ Fixes applied to source files');
  } catch (err) {
    console.error(`❌ Failed to apply fixes: ${(err as Error).message}`);
  }
}

async function runGraderDev(guideDir: string): Promise<void> {
  console.log(`Running gd dev for ${guideDir}...`);
  try {
    await runCommand('node', ['bin/gd.ts', 'dev', guideDir]);
    console.log(`✅ gd dev completed`);
  } catch (err) {
    console.error(`❌ gd dev failed: ${(err as Error).message}`);
  }
}

async function pushChanges(prData: any, guideDir: string): Promise<void> {
  console.log('Pushing changes...');
  await runCommand('git', ['add', guideDir]);
  const stagedFiles = await runCommand('git', ['diff', '--cached', '--name-only']);
  if (!stagedFiles.trim()) {
    console.log('No changes to commit.');
    return;
  }

  await runCommand('git', ['commit', '-m', 'chore: apply feedback and regenerate artifacts']);

  const token = process.env.APP_TOKEN || process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const pushUrl = token && repo ? `https://x-access-token:${token}@github.com/${repo}.git` : 'origin';
  const branch = prData.headRefName;

  try {
    console.log('Stashing any unstaged changes...');
    await runCommand('git', ['stash', '-u']);

    console.log('Pulling latest changes...');
    await runCommand('git', ['pull', '--rebase', pushUrl, branch]);
    console.log('✅ Pulled latest changes');

    console.log('Restoring stashed changes...');
    try {
      await runCommand('git', ['stash', 'pop']);
      console.log('✅ Stash restored');
    } catch (popErr) {
      console.warn(`⚠️ Failed to restore stash: ${(popErr as Error).message}`);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to pull latest changes: ${(err as Error).message}`);
  }

  await runCommand('git', ['push', pushUrl, `HEAD:${branch}`]);
  console.log(`✅ Changes pushed to ${branch}`);
}

export async function handleFeedback(prNumber: string): Promise<void> {
  console.log(`Processing feedback for PR #${prNumber}...`);

  const prData = await fetchPRContext(prNumber);
  const guideDir = deriveGuideDirectory(prData);

  const synthesis = await synthesizeFeedback(prNumber, prData);
  await postPlanToPR(prNumber, synthesis);

  if (guideDir) {
    await applyFixesToSourceFiles(guideDir, synthesis);
    await runGraderDev(guideDir);
    await pushChanges(prData, guideDir);
  } else {
    console.log('No specific guide directory identified from PR files. Skipping automatic gd dev.');
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const prNumber = args[0] || process.env.GITHUB_PR_NUMBER;

  if (!prNumber) {
    console.error('Usage: node guides/feedback-handler.ts <pr-number>');
    process.exit(1);
  }

  handleFeedback(prNumber).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
