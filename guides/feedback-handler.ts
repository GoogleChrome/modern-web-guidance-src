/**
 * feedback-handler.ts
 *
 * Handles feedback left on PRs by synthesizing reviews and applying fixes.
 *
 * Usage:
 *   node guides/feedback-handler.ts <pr-number>
 */

import path from 'node:path';

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import config from '../harness/config.ts';

// ─── Helper to run commands ─────────────────────────────────────────────────

async function runCommand(command: string, args: string[]): Promise<string> {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutData = '';
  let stderrData = '';
  child.stdout.on('data', (d) => { stdoutData += d; });
  child.stderr.on('data', (d) => { stderrData += d; });

  const exitCode = await new Promise<number | null>(resolve => child.on('close', resolve));

  if (exitCode !== 0) {
    throw new Error(`Command "${command} ${args.join(' ')}" exited with code ${exitCode}. Stderr: ${stderrData}`);
  }

  return stdoutData.trim();
}

// ─── Helper to run Gemini ───────────────────────────────────────────────────

async function runGemini(prompt: string): Promise<string> {
  const command = config.environment.geminiCliBin;
  const commandArgs = ['-p', prompt, '--yolo'];

  const child = spawn(command, commandArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutData = '';
  let stderrData = '';
  child.stdout.on('data', (d) => { stdoutData += d; });
  child.stderr.on('data', (d) => { stderrData += d; });

  const exitCode = await new Promise<number | null>(resolve => child.on('close', resolve));

  if (exitCode !== 0) {
    throw new Error(`Gemini CLI exited with code ${exitCode}. Stderr: ${stderrData}`);
  }

  return stdoutData.trim();
}

// ─── Main logic ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const prNumber = args[0] || process.env.GITHUB_PR_NUMBER;

  if (!prNumber) {
    console.error('Usage: node guides/feedback-handler.ts <pr-number>');
    process.exit(1);
  }

  console.log(`Processing feedback for PR #${prNumber}...`);

  // 1. Fetch PR context
  console.log('Fetching PR context via gh CLI...');
  const prDataJson = await runCommand('gh', ['pr', 'view', prNumber, '--json', 'reviews,comments,headRefName,files']);
  const prData = JSON.parse(prDataJson);
  
  console.log(`PR Branch: ${prData.headRefName}`);
  console.log(`Found ${prData.reviews.length} reviews and ${prData.comments.length} comments.`);

  // Find affected guide directory
  const guideFile = prData.files.find((f: any) => f.path.startsWith('guides/'));
  let guideDir = '';
  if (guideFile) {
    const parts = guideFile.path.split('/');
    if (parts.length >= 3) {
      guideDir = path.join(parts[0], parts[1], parts[2]);
      console.log(`Affected guide directory: ${guideDir}`);
    }
  }

  // 2. Synthesize feedback and create TODO list
  console.log('Synthesizing feedback with Gemini...');
  const prompt = `
You are a coordinator for an AI coding agent. Below is the JSON data for PR #${prNumber}, including reviews and comments.

Tasks:
1. Resolve conflicts: If there is conflicting feedback, flag it clearly.
2. Filter noise: Ignore LGTM or general chatter.
3. Deduplicate: Group similar feedback.
4. Output a structured TODO list for the coding agent.

PR Data:
${prDataJson}

Output your response as a clear markdown summary and TODO list.
`;

  const synthesis = await runGemini(prompt);
  console.log('\n--- Synthesis & Plan ---');
  console.log(synthesis);
  console.log('------------------------\n');

  // 3. Post plan to PR
  console.log('Posting plan to PR...');
  await runCommand('gh', ['pr', 'comment', prNumber, '-b', synthesis]);
  console.log('✅ Plan posted');

  // 4. Apply fixes to source files
  console.log('Applying fixes to source files...');
  if (guideDir) {
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

    console.log(`Running gd dev for ${guideDir}...`);
    try {
      await runCommand('node', ['bin/gd.ts', 'dev', guideDir]);
      console.log(`✅ gd dev completed`);
    } catch (err) {
      console.error(`❌ gd dev failed: ${(err as Error).message}`);
    }
  } else {
    console.log('No specific guide directory identified from PR files. Skipping automatic gd dev.');
  }

  // 5. Push changes
  console.log('Pushing changes...');
  if (guideDir) {
    await runCommand('git', ['add', guideDir]);
    const stagedFiles = await runCommand('git', ['diff', '--cached', '--name-only']);
    if (stagedFiles.trim()) {
      await runCommand('git', ['commit', '-m', 'chore: apply feedback and regenerate artifacts']);
      
      const token = process.env.APP_TOKEN || process.env.GH_TOKEN;
      const repo = process.env.GITHUB_REPOSITORY;
      const pushUrl = token && repo ? `https://x-access-token:${token}@github.com/${repo}.git` : 'origin';
      const branch = prData.headRefName;
      
      await runCommand('git', ['push', pushUrl, `${branch}:${branch}`]);
      console.log(`✅ Changes pushed to ${branch}`);
    } else {
      console.log('No changes to commit.');
    }
  } else {
    console.log('No guide directory identified, skipping push.');
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
