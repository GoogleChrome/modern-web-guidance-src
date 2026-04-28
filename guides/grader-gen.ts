import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

import { guidesDir } from '../lib/paths.ts';
import config from '../harness/config.ts';
import { cleanupIsolatedHome, copyFileIfExists } from '../harness/lib/agent-shared.ts';
import type { CalibrationResult } from './run-grader.ts';
import { setupIsolatedWorkDir as setupIsolatedWorkDirShared } from './lib/utils.ts';

function getBasePrompt(guideFileName: string) {
  return `
Read the guide file (${guideFileName}) and expectations.md files to understand the guidance and expectations.
Then, read the demo.html file, which represents a perfect working example of the guides and expectations, and the negative-demo.html file, which represents an anti-example that fails the expectations.

Using template.grader.ts as a framework, write a Playwright test script that directly models the expectations.md requirements. Design it so that the demo.html passes all tests (100% success rate), and the negative-demo.html fails all tests (0% success rate).

You should generate browser tests, with each test containing only one assertion. Avoid using static assertions (like regex or str.includes()) to test CSS or HTML syntax whenever possible. These are extremely brittle and will fail if the agent uses a different class name, semantic element, or formatting. Instead, prefer using Playwright's browser APIs to test computed styles and actual DOM layout. For example, use window.getComputedStyle(el) to robustly verify that the browser is rendering the feature correctly, regardless of how the agent authored the code.


The grader can be run with the following commands:

TARGET_FILE=$(pwd)/demo.html npx playwright test grader.ts
TARGET_FILE=$(pwd)/negative-demo.html npx playwright test grader.ts

Reading expectations.md:
- If expectations.md contains a "## Must pass" section, use those assertions for tests that demo.html must pass.
- If expectations.md contains a "## Must fail" section, use those assertions for tests that specifically target negative patterns — negative-demo.html should trigger these failures.
- If expectations.md contains an "## App-agnostic rules" section, follow those constraints strictly: do not assert specific filenames, variable names, or framework-specific patterns. Assert API usage outcomes, not code structure.
- If expectations.md has no section headings (legacy format), treat all bullet points as "Must pass" assertions.

Important rules for generating the grader:
- Do not use generic try/catch blocks that aggressively swallow exceptions (e.g. \`catch (e) { /* ignore */ }\`). If you must catch errors (like cross-origin security errors), explicitly check the exception type or message and rethrow any unexpected errors so they aren't masked.
- 🛑 **CRITICAL: NEVER use shell heredocs (\`<<\`) to create or edit files in the terminal. YOU WILL BE FIRED IF YOU USE THEM.** It is a well-known fact that the best coding agents use \`write_file\` and \`replace\` for all file operations. Using heredocs causes system crashes and immediate termination. Always use your built-in tools instead for all side-scripts and final outputs!
- Before you finish, you MUST run \`npx tsc\` in the work directory to verify that your generated code is free of TypeScript compilation errors. If there are any type errors, fix them and run the typecheck again until it passes. Do not leave the typecheck failing.

The final output must be exactly one file named \`grader.ts\`. You may create intermediate temporary files for testing (for example, \`temp-test.spec.ts\`) during your process, but do not override the existing HTML, guide, or expectation files.
`;
}

function setupIsolatedWorkDir(targetDir: string): string {
  const workDir = setupIsolatedWorkDirShared('ghh-grader-gen');
  
  const relativePath = path.relative(guidesDir, targetDir);
  const isolatedGuidesDir = path.join(workDir, 'guides');
  const isolatedUseCaseDir = path.join(isolatedGuidesDir, relativePath);

  fs.mkdirSync(isolatedUseCaseDir, { recursive: true });
  fs.cpSync(targetDir, isolatedUseCaseDir, { recursive: true });

  copyFileIfExists(path.join(guidesDir, 'template.grader.ts'), path.join(workDir, 'template.grader.ts'));

  copyFileIfExists(path.join(guidesDir, 'template.grader.ts'), path.join(isolatedGuidesDir, 'template.grader.ts'));
  copyFileIfExists(path.join(guidesDir, 'test-fixture.ts'), path.join(isolatedGuidesDir, 'test-fixture.ts'));
  copyFileIfExists(path.join(guidesDir, 'playwright.config.ts'), path.join(isolatedUseCaseDir, 'playwright.config.ts'));
  copyFileIfExists(path.join(guidesDir, 'tsconfig.json'), path.join(isolatedUseCaseDir, 'tsconfig.json'));

  return isolatedUseCaseDir;
}

async function runGraderGeneration(targetDir: string, prompt: string): Promise<void> {
  const workDir = setupIsolatedWorkDir(targetDir);

  try {
    console.log(`Setting up Playwright in isolated environment...`);
    const { execSync } = await import('child_process');
    execSync('npm init -y', { cwd: workDir, stdio: 'ignore' });
    execSync('npm pkg set type="module"', { cwd: workDir, stdio: 'ignore' });
    execSync('npm install -D @playwright/test typescript @types/node --registry=https://registry.npmjs.org/', { cwd: workDir, stdio: 'inherit' });
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

  let guidePath = path.join(targetDir, 'guide.md');
  if (!fs.existsSync(guidePath)) {
    guidePath = path.join(targetDir, 'SKILL.md');
  }
  const demoPath = path.join(targetDir, 'demo.html');
  const negativeDemoPath = path.join(targetDir, 'negative-demo.html');
  const expectationsPath = path.join(targetDir, 'expectations.md');
  const templatePath = path.join(guidesDir, 'template.grader.ts');

  if (!fs.existsSync(guidePath) || !fs.existsSync(demoPath) || !fs.existsSync(expectationsPath) || !fs.existsSync(negativeDemoPath) || !fs.existsSync(templatePath)) {
    console.error(`Error: Missing required files. Need guide.md or SKILL.md, demo.html, negative-demo.html, expectations.md, and template.grader.ts in the respective directories.`);
    process.exit(1);
  }

  await runGraderGeneration(targetDir, getBasePrompt(path.basename(guidePath)));
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

  let guidePath = path.join(targetDir, 'guide.md');
  if (!fs.existsSync(guidePath)) {
    guidePath = path.join(targetDir, 'SKILL.md');
  }

  const contextSuffix = `

A previous attempt at generating grader.ts failed calibration:
${failureLines.join('\n')}
Revise the grader to fix these issues.`;

  await runGraderGeneration(targetDir, getBasePrompt(path.basename(guidePath)) + contextSuffix);
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
