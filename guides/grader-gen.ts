import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

import { rootDir } from '../lib/root.ts';

const guidesDir = path.join(rootDir, 'guides');

import config from '../harness/config.ts';
import { createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, createTrustedFolders } from '../harness/lib/agent-shared.ts';
import type { CalibrationResult } from './run-grader.ts';

const BASE_PROMPT = `
Read the guide.md and expectations.md files to understand the guidance and expectations.
Then, read the demo.html file, which represents a perfect working example of the guides and expectations, and the negative-demo.html file, which represents an anti-example that fails the expectations.

Using template.grader.ts as a framework, write a Playwright test script that directly models the expectations.md requirements.
You should generate both functional and browser tests, with each test containing only one assertion.
Design it so that the demo.html passes all tests (100% success rate), and the negative-demo.html fails all tests (0% success rate).

The grader can be run with the following commands:

TARGET_FILE=$(pwd)/demo.html npx playwright test grader.ts
TARGET_FILE=$(pwd)/negative-demo.html npx playwright test grader.ts

Important rules for generating the grader:
- Do not use generic try/catch blocks that aggressively swallow exceptions (e.g. \`catch (e) { /* ignore */ }\`). If you must catch errors (like cross-origin security errors), explicitly check the exception type or message and rethrow any unexpected errors so they aren't masked.
- CRITICAL BASH SYNTAX WARNING: You must NEVER use naked heredoc redirections like \`<< 'EOF' > filename\`. This is invalid Bash syntax and will crash the agent harness parser. Whenever you write to ANY file (e.g., grader.ts, test.js, etc.), you MUST prefix it with the \`cat\` command:
  VALID:    cat << 'EOF' > filename
  INVALID: << 'EOF' > filename
- Before you finish, you MUST run \`npx tsc\` in the work directory to verify that your generated code is free of TypeScript compilation errors. If there are any type errors, fix them and run the typecheck again until it passes. Do not leave the typecheck failing.

The final output must be exactly one file named \`grader.ts\`. You may create intermediate scratch files for testing during your process, but do not override the existing HTML, guide, or expectation files.
`;

function setupIsolatedWorkDir(targetDir: string): string {
  const tempHome = createIsolatedHome('ghh-grader-gen');
  const workDir = path.join(tempHome, 'work');
  fs.mkdirSync(workDir, { recursive: true });

  // Copy all files and folders from target dir to work dir
  fs.cpSync(targetDir, workDir, { recursive: true });

  // Copy template.grader.ts from the guides directory
  copyFileIfExists(path.join(guidesDir, 'template.grader.ts'), path.join(workDir, 'template.grader.ts'));

  // Provide testing config to the agent
  copyFileIfExists(path.join(guidesDir, 'playwright.config.ts'), path.join(workDir, 'playwright.config.ts'));

  // Provide tsconfig for typechecking
  copyFileIfExists(path.join(__dirname, 'tsconfig.json'), path.join(workDir, 'tsconfig.json'));

  const geminiSource = path.join(path.resolve(process.env.HOME || process.cwd()), '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');
  fs.mkdirSync(geminiDest, { recursive: true });

  const filesToCopy = [
    'oauth_creds.json',
    'google_accounts.json',
    'installation_id'
  ];

  for (const file of filesToCopy) {
    const src = path.join(geminiSource, file);
    copyFileIfExists(src, path.join(geminiDest, file));
  }

  createTrustedFolders(geminiDest, [workDir]);

  process.env.HOME = tempHome;

  return workDir;
}

async function runGraderGeneration(targetDir: string, prompt: string): Promise<void> {
  const workDir = setupIsolatedWorkDir(targetDir);

  try {
    console.log(`Setting up Playwright in isolated environment...`);
    const { execSync } = await import('child_process');
    execSync('npm init -y', { cwd: workDir, stdio: 'ignore' });
    execSync('npm pkg set type="module"', { cwd: workDir, stdio: 'ignore' });
    execSync('npm install -D @playwright/test typescript @types/node', { cwd: workDir, stdio: 'ignore' });
    execSync('npx playwright install chromium', { cwd: workDir, stdio: 'ignore', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(workDir, '.cache', 'ms-playwright') } });

    const command = config.environment.geminiCliBin;
    const commandArgs = [
      '-p', prompt,
      '--yolo'
    ];

    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`Starting Gemini CLI agent for grader generation in ${workDir} (Attempt ${attempt}/${maxRetries})`);
      console.log(`Executing prompt...`);

      const child = spawn(command, commandArgs, {
        cwd: workDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdoutData += chunk;
        process.stdout.write(chunk);
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderrData += chunk;
        process.stderr.write(chunk);
      });

      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve);
      });

      if (exitCode === 0) {
        break; // Success
      }

      const combinedOutput = stdoutData + '\n' + stderrData;
      const isInternalApiError = combinedOutput.includes('ApiError: got status: INTERNAL') || combinedOutput.includes('"status":"INTERNAL"');

      if (isInternalApiError && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(`\n⚠️ Gemini API returned an INTERNAL error. Retrying in ${backoffMs / 1000} seconds...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      throw new Error(`Gemini CLI exited with code ${exitCode}`);
    }

    const generatedFile = path.join(workDir, 'grader.ts');
    const destFile = path.join(targetDir, 'grader.ts');
    if (fs.existsSync(generatedFile)) {
      fs.copyFileSync(generatedFile, destFile);
      console.log(`Successfully generated grader.ts at ${destFile}`);
    } else {
      console.error(`Error: grader.ts was not generated by Gemini CLI in ${workDir}`);
    }

    try {
      execSync('npm run typecheck', { cwd: guidesDir, stdio: 'inherit' });
    } catch {
      throw new Error(`Typecheck failed on generated grader.ts. Review the file for type errors.`);
    }

    console.log("Grader generation finished.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    throw err;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function generateGrader(targetDirRaw: string): Promise<void> {
  const targetDir = path.resolve(process.cwd(), targetDirRaw);

  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory not found: ${targetDir}`);
    process.exit(1);
  }

  const guidePath = path.join(targetDir, 'guide.md');
  const demoPath = path.join(targetDir, 'demo.html');
  const negativeDemoPath = path.join(targetDir, 'negative-demo.html');
  const expectationsPath = path.join(targetDir, 'expectations.md');
  const templatePath = path.join(guidesDir, 'template.grader.ts');

  if (!fs.existsSync(guidePath) || !fs.existsSync(demoPath) || !fs.existsSync(expectationsPath) || !fs.existsSync(negativeDemoPath) || !fs.existsSync(templatePath)) {
    console.error(`Error: Missing required files. Need guide.md, demo.html, negative-demo.html, expectations.md, and template.grader.ts in the respective directories.`);
    process.exit(1);
  }

  await runGraderGeneration(targetDir, BASE_PROMPT);
}

export async function generateGraderWithContext(targetDirRaw: string, calibrationResult: CalibrationResult): Promise<void> {
  const targetDir = path.resolve(process.cwd(), targetDirRaw);

  if (!fs.existsSync(targetDir)) {
    throw new Error(`Directory not found: ${targetDir}`);
  }

  const failureLines: string[] = [];
  if (calibrationResult.demo.failingTests.length > 0) {
    failureLines.push(`- demo.html failed these tests (they should pass): ${calibrationResult.demo.failingTests.join(', ')}`);
  }
  if (calibrationResult.negative.passingTests.length > 0) {
    failureLines.push(`- negative-demo.html passed these tests (they should fail): ${calibrationResult.negative.passingTests.join(', ')}`);
  }

  const contextSuffix = `

A previous attempt at generating grader.ts failed calibration:
${failureLines.join('\n')}
Revise the grader to fix these issues.`;

  await runGraderGeneration(targetDir, BASE_PROMPT + contextSuffix);
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: gd dev <path/to/guide> --gen-grader');
    process.exit(1);
  }
  generateGrader(args[0]).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
