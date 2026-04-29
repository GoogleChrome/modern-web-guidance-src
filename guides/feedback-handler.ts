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

function deriveGuideDirectories(prData: any): string[] {
  const guideDirs = new Set<string>();
  for (const file of prData.files) {
    if (file.path.startsWith('guides/')) {
      const parts = file.path.split('/');
      if (parts.length >= 3) {
        guideDirs.add(path.join(parts[0], parts[1], parts[2]));
      }
    }
  }
  const dirs = Array.from(guideDirs);
  console.log(`Affected guide directories: ${dirs.join(', ')}`);
  return dirs;
}

function deriveAffectedFiles(prData: any, guideDir: string): string[] {
  return prData.files
    .map((f: any) => f.path)
    .filter((p: string) => p.startsWith(guideDir));
}

async function synthesizeFeedback(prNumber: string, prData: any): Promise<string> {
  console.log('Synthesizing feedback with Gemini...');
  const prompt = `
You are the **PlannerAgent**. Your task is to synthesize feedback left on PR #${prNumber} and create a structured TODO list for the **FixerAgent**.

Tasks:
1. Resolve conflicting feedback: If there is conflicting feedback, flag it clearly.
2. Filter noise: Ignore LGTM or general chatter.
3. Deduplicate: Group similar feedback.
4. Output a structured TODO list for the FixerAgent.

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

<details><summary>Plan from PlannerAgent</summary>

${synthesis}

</details>`;
  await runCommand('gh', ['pr', 'comment', prNumber, '-b', body]);
  console.log('✅ Plan posted');
}

async function applyFixesToSourceFiles(guideDirs: string[], synthesis: string): Promise<string | undefined> {
  console.log('Applying fixes to source files...');
  const applyPrompt = `
You are the **FixerAgent**. Your task is to apply the following fixes to these files to address PR feedback, following the plan provided by the **PlannerAgent**.

A previous agent generated the files within the following directories:
${guideDirs.map(d => `- \`${d}\``).join('\n')}

Synthesized Plan:
${synthesis}

Please read these files and update them to implement the requested changes.
Focus on the source files. Do not run \`gd dev\` or try to calibrate the grader, that will be done in a separate step.
Use your file editing tools to make the changes.
`;
  try {
    const response = await runGemini(applyPrompt);
    console.log('✅ Fixes applied to source files');
    return response;
  } catch (err) {
    console.error(`❌ Failed to apply fixes: ${(err as Error).message}`);
    return undefined;
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

async function pushChanges(prData: any, guideDirs: string[]): Promise<void> {
  console.log('Pushing changes...');
  for (const dir of guideDirs) {
    await runCommand('git', ['add', dir]);
  }
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

async function postFixesReportToPR(prNumber: string, report: string): Promise<void> {
  console.log('Posting fixes report to PR...');
  const body = `Fixes applied!

<details><summary>Report from FixerAgent</summary>

${report}

</details>`;
  await runCommand('gh', ['pr', 'comment', prNumber, '-b', body]);
  console.log('✅ Fixes report posted');
}

export async function handleFeedback(prNumber: string): Promise<void> {
  console.log(`Processing feedback for PR #${prNumber}...`);

  const prData = await fetchPRContext(prNumber);
  const guideDirs = deriveGuideDirectories(prData);

  const synthesis = await synthesizeFeedback(prNumber, prData);
  await postPlanToPR(prNumber, synthesis);

  if (guideDirs.length > 0) {
    const fixesReport = await applyFixesToSourceFiles(guideDirs, synthesis);
    if (fixesReport) {
      await postFixesReportToPR(prNumber, fixesReport);
    }

    for (const guideDir of guideDirs) {
      await runGraderDev(guideDir);
    }
    
    await pushChanges(prData, guideDirs);
  } else {
    console.log('No guide directories identified from PR files.');
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
