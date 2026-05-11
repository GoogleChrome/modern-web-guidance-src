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

import fs from 'node:fs';
import { runCommand, runGemini, escapeLeftAngleBracket } from './lib/utils.ts';
import { parsePassRates, type PassRates } from './guide-gen.ts';

async function fetchPRContext(prNumber: string): Promise<any> {
  console.log('Fetching PR context via GraphQL...');
  const repo = process.env.GITHUB_REPOSITORY || 'paulirish/guidance';
  const [owner, name] = repo.split('/');

  const query = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      headRefName
      files(first: 100) {
        nodes {
          path
        }
      }
      reviewThreads(first: 100) {
        nodes {
          isResolved
          comments(first: 10) {
            nodes {
              author { login }
              body
              path
              line
              createdAt
              diffHunk
            }
          }
        }
      }
      comments(first: 100) {
        nodes {
          author { login }
          body
          createdAt
        }
      }
    }
  }
}
  `.trim();

  const result = await runCommand('gh', ['api', 'graphql', '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `number=${prNumber}`, '-f', `query=${query}`]);
  const gqlData = JSON.parse(result);
  const pr = gqlData.data.repository.pullRequest;

  console.log(`PR Branch: ${pr.headRefName}`);
  console.log(`Found ${pr.reviewThreads.nodes.length} review threads and ${pr.comments.nodes.length} general comments.`);

  return {
    headRefName: pr.headRefName,
    files: pr.files.nodes,
    reviewThreads: pr.reviewThreads.nodes,
    comments: pr.comments.nodes,
  };
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

async function synthesizeFeedback(prNumber: string, prData: any): Promise<string> {
  console.log('Synthesizing feedback with Gemini...');
  const plannerPrompt = `
You are the **PlannerAgent**. Your task is to synthesize feedback left on PR #${prNumber} and create a structured TODO list for the **FixerAgent**.

Tasks:
1. Resolve conflicting feedback: If there is conflicting feedback, flag it clearly.
2. Filter noise: Ignore LGTM or general chatter.
3. Deduplicate: Group similar feedback.
4. Output a structured TODO list for the FixerAgent.

PR Data:
${JSON.stringify(prData)}

Note: \`reviewThreads\` contains inline comments and their resolution status. \`comments\` contains top-level PR comments.

Output your response as a clear markdown summary and TODO list.
`;

  const synthesis = await runGemini(plannerPrompt);
  console.log('\n--- Synthesis & Plan ---');
  console.log(synthesis);
  console.log('------------------------\n');
  return synthesis;
}

async function postPlanToPR(prNumber: string, synthesis: string): Promise<void> {
  console.log('Posting plan to PR...');
  const escapedSynthesis = escapeLeftAngleBracket(synthesis);
  const body = `On it!

<details><summary>📋 Plan from feedback-handler</summary>

${escapedSynthesis}

</details>`;
  await runCommand('gh', ['pr', 'comment', prNumber, '-b', body]);
  console.log('✅ Plan posted');
}

async function applyFixesToSourceFiles(guideDirs: string[], synthesis: string): Promise<string | undefined> {
  console.log('Applying fixes to source files...');
  const fixerPrompt = `
You are the **FixerAgent**. Your task is to update files within these directories to address PR feedback, following the plan provided by the **PlannerAgent**.

A previous agent generated the files within the following directories:
${guideDirs.map(d => `- \`${d}\``).join('\n')}

### Synthesized Plan:
${synthesis}

---

Please read these files and update them to implement the requested changes.
Focus on the source files. Do not run \`gd dev\` or try to calibrate the grader, that will be done in a separate step.
Use your file editing tools to make the changes.
`;
  try {
    const response = await runGemini(fixerPrompt);
    console.log('✅ Fixes applied to source files');
    return response;
  } catch (err) {
    console.error(`❌ Failed to apply fixes: ${(err as Error).message}`);
    return undefined;
  }
}

async function maybeRunGdDev(guideDir: string): Promise<PassRates | null> {
  const modifiedFiles = await runCommand('git', ['diff', '--name-only', guideDir]);
  const modifiedFilesList = modifiedFiles.split('\n').filter(Boolean);

  const hasGrader = fs.existsSync(path.join(guideDir, 'grader.ts'));
  const needsGdDev = !hasGrader || modifiedFilesList.some(f =>
    f.endsWith('demo.html') || f.endsWith('expectations.md') || f.endsWith('guide.md')
  );

  if (!needsGdDev) {
    console.log(`Skipping gd dev for ${guideDir} (no source files modified and grader exists).`);
    return null;
  }

  console.log(`Running gd dev for ${guideDir}... (slow)`);
  try {
    const output = await runCommand('node', ['bin/gd.ts', 'dev', guideDir]);
    const passRates = parsePassRates(output);
    console.log(`✅ gd dev completed`, passRates ? `with pass rates: ${JSON.stringify(passRates)}` : 'but ⚠️ failed to parse pass rates');

    return passRates || null
  } catch (err) {
    console.error(`❌ gd dev failed: ${(err as Error).message}`);
    return null;
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
  const escapedReport = escapeLeftAngleBracket(report);
  const body = `Fixes applied!

<details><summary>🛠️ Report from FixerAgent</summary>

${escapedReport}

</details>`;
  await runCommand('gh', ['pr', 'comment', prNumber, '-b', body]);
  console.log('✅ Fixes report posted');
}

async function postAllPassRatesToPR(prNumber: string, allPassRates: Record<string, PassRates>): Promise<void> {
  console.log('Posting all pass rates to PR:', JSON.stringify(allPassRates, null, 2));

  let body = `### 📊 Updated Pass Rates\n\n`;
  body += `| Use Case | Unguided | Guided | Uplift |\n`;
  body += `| :--- | :---: | :---: | :---: |\n`;

  for (const [guideDir, rates] of Object.entries(allPassRates)) {
    const unguided = parseInt(rates.unguided, 10);
    const guided = parseInt(rates.guided, 10);
    const uplift = guided - unguided;
    const upliftStr = uplift >= 0 ? `+${uplift}%` : `${uplift}%`;

    const label = path.basename(guideDir);

    body += `| \`${label}\` | ${rates.unguided}% | ${rates.guided}% | ${upliftStr} |\n`;
  }

  await runCommand('gh', ['pr', 'comment', prNumber, '-b', body]);
  console.log('✅ All pass rates posted');
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
      for (const guideDir of guideDirs) {
        await runCommand('git', ['add', guideDir]);
      }
      const stagedFiles = await runCommand('git', ['diff', '--cached', '--name-only']);
      if (stagedFiles.trim()) {
        await runCommand('git', ['commit', '-m', 'chore: apply feedback to source files']);
      }
      await postFixesReportToPR(prNumber, fixesReport);
    }

    const allPassRates: Record<string, PassRates> = {};

    for (const guideDir of guideDirs) {
      const passRates = await maybeRunGdDev(guideDir);
      if (passRates) {
        allPassRates[guideDir] = passRates;
      }
    }

    if (Object.keys(allPassRates).length > 0) {
      await postAllPassRatesToPR(prNumber, allPassRates);
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
