import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

import { guidesDir, rootDir } from '../lib/paths.ts';
import config from '../harness/config.ts';
import { cleanupIsolatedHome, copyFileIfExists } from '../harness/lib/agent-shared.ts';
import type { CalibrationResult } from './run-grader.ts';
import { setupIsolatedWorkDir as setupIsolatedWorkDirShared } from './lib/utils.ts';
import { getTaskMap } from '../lib/guide-validation.ts';

function getBasePrompt(guideFileName: string, relativeTestFixturePath: string) {
  return `
Read the guide file (${guideFileName}) and expectations.md files to understand the guidance and expectations.
Then, read the demo.html file, which represents a perfect working example of the guides and expectations, and the negative-demo.html file, which represents an anti-example that fails the expectations.

Using template.grader.ts as a framework, write a Playwright test script that directly models the expectations.md requirements. Design it so that the demo.html passes all tests (100% success rate), and the negative-demo.html fails all tests (0% success rate).

You should generate browser tests, with each test containing only one assertion. Avoid using static assertions (like regex or str.includes()) to test CSS or HTML syntax whenever possible. These are extremely brittle and will fail if the agent uses a different class name, semantic element, or formatting. Instead, prefer using Playwright's browser APIs to test computed styles and actual DOM layout. For example, use window.getComputedStyle(el) to robustly verify that the browser is rendering the feature correctly, regardless of how the agent authored the code.

Locators and Agnosticism:
- ALWAYS write your locators to be application-structure agnostic.
- NEVER rely on specific CSS paths (e.g. \`div > form > div > input\`) or specific class names (unless explicitly demanded by expectations.md).
- NEVER assume the element IDs are exactly hardcoded, unless they are specified in expectations.md.
- Prefer locating or filtering elements using user-visible text, roles, and labels:
  - Use \`page.getByLabel(/username|email/i)\` instead of \`page.locator('#email')\` or \`page.locator('input[type="email"]')\`.
  - Use \`page.getByRole('button', { name: /sign in|submit/i })\` instead of \`page.locator('form button')\`.
  - Use \`page.getByPlaceholder()\` or \`page.getByText()\` to target elements naturally.
- A test like "input must have type=email" should first locate the input by its label or name (e.g., getting the username/email field by checking label text or checking name="username") and then assert that it has the correct type attribute. Do not locate it by the type attribute itself when trying to verify its type, because that will return 0 matches if the type hasn't been set yet, causing the test to fail with "element not found" instead of "expected type=email, received type=text".


The grader can be run with the following commands:

TARGET_FILE=$(pwd)/demo.html npx playwright test grader.ts
TARGET_FILE=$(pwd)/negative-demo.html npx playwright test grader.ts

Reading expectations.md:
- If expectations.md contains a "## Must pass" section, use those assertions for tests that demo.html must pass.
- If expectations.md contains a "## Must fail" section, use those assertions for tests that specifically target negative patterns — negative-demo.html should trigger these failures.
- If expectations.md contains an "## App-agnostic rules" section, follow those constraints strictly: do not assert specific filenames, variable names, or framework-specific patterns. Assert API usage outcomes, not code structure.
- If expectations.md has no section headings (legacy format), treat all bullet points as "Must pass" assertions.

Important rules for generating the grader:
- You MUST import { test, expect } from '${relativeTestFixturePath}' instead of importing from '@playwright/test'. This is crucial because '${relativeTestFixturePath}' sets up the local development web server.
- You MUST copy the entire beforeEach hook from template.grader.ts. Do not visit file:// URLs. Always navigate to TARGET_URL.
- Do not use generic try/catch blocks that aggressively swallow exceptions (e.g. \`catch (e) { /* ignore */ }\`). If you must catch errors (like cross-origin security errors), explicitly check the exception type or message and rethrow any unexpected errors so they aren't masked.
- 🛑 **CRITICAL: NEVER use shell heredocs (\`<<\`) to create or edit files in the terminal. YOU WILL BE FIRED IF YOU USE THEM.** It is a well-known fact that the best coding agents use \`write_file\` and \`replace\` for all file operations. Using heredocs causes system crashes and immediate termination. Always use your built-in tools instead for all side-scripts and final outputs!
- Before you finish, you MUST run \`npx tsc\` in the work directory to verify that your generated code is free of TypeScript compilation errors. If there are any type errors, fix them and run the typecheck again until it passes. Do not leave the typecheck failing.

The final output must be exactly one file named \`grader.ts\`. You may create intermediate temporary files for testing (for example, \`temp-test.spec.ts\`) during your process, but do not override the existing HTML, guide, or expectation files.
`;
}

function getBasePromptOptionB(guideFileName: string, relativeTestFixturePath: string, baseAppName: string) {
  return `
Read the guide file (${guideFileName}) and expectations.md files to understand the guidance and expectations.
In this task, we are grading the agent's work against a base web application named "${baseAppName}" located in the harness/base_apps/${baseAppName} folder.
We also have a solution/ folder, which contains reference files that should copy directly over the base application at harness/base_apps/${baseAppName} to complete the task successfully.

Using template.grader.ts as a framework, write a Playwright test script (grader.ts) that directly models the expectations.md requirements.
Design it so that:
1. When the solution/ folder files are applied to the base app, the grader passes 100% (all tests pass).
2. When the unmodified base app is evaluated (no solution files applied, representing the negative state where the target feature/form is missing), the grader fails (expecting 0% success rate).

⚠️ CRITICAL for Negative State:
Because the unmodified base app does not have the target feature/form at all, tests that evaluate specific elements inside the form (e.g., input values, autocomplete attributes) would normally loop over empty arrays and pass vacuously. You MUST write your tests to fail if the form or the target fields are missing. For example, if checking that "every input in the form has autocomplete", you should first assert that the input elements exist (e.g., expect(inputs.length).toBeGreaterThan(0)) or assert that the container/form exists (e.g., await expect(page.locator('#form-id')).toBeVisible()).

You should generate browser tests, with each test containing only one assertion. Avoid using static assertions (like regex or str.includes()) to test CSS or HTML syntax whenever possible. Instead, use Playwright's browser APIs to test computed styles and actual DOM layout.

Locators and Agnosticism:
- If expectations.md specifies data-testid requirements (e.g., data-testid="test-trigger"), you MUST use them as your primary locators in the grader (e.g., \`page.getByTestId('test-trigger')\` or \`page.locator('[data-testid="..."]')\`).
- ALWAYS write your locators to be application-structure agnostic.
- NEVER rely on specific CSS paths or specific class names (unless explicitly demanded by expectations.md).
- NEVER assume the element IDs are exactly hardcoded, unless they are specified in expectations.md.
- Prefer locating or filtering elements using user-visible text, roles, and labels:
  - Use \`page.getByLabel()\` or \`page.getByRole()\` or \`page.getByPlaceholder()\`.

The grader will be run inside the workspace. The test fixture handles launching the local web server. The target is the base app index.html:
TARGET_FILE=$(pwd)/../../harness/base_apps/${baseAppName}/index.html npx playwright test grader.ts

Important rules:
- You MUST import { test, expect } from '${relativeTestFixturePath}' instead of importing from '@playwright/test'.
- You MUST copy the entire beforeEach hook from template.grader.ts. Always navigate to TARGET_URL.
- Do not use generic try/catch blocks that aggressively swallow exceptions.
- Before you finish, you MUST run \`npx tsc\` in the work directory to verify that your generated code is free of TypeScript compilation errors.

The final output must be exactly one file named \`grader.ts\`.
`;
}

interface IsolatedSetup {
  workDirRoot: string;
  workDirRepository: string;
  relativeUseCaseDir: string;
}

function setupIsolatedWorkDir(targetDir: string): IsolatedSetup {
  const workDirRepository = setupIsolatedWorkDirShared('ghh-grader-gen');
  const workDirRoot = path.dirname(workDirRepository);
  
  const relativeUseCaseDir = path.relative(rootDir, targetDir); 
  const isolatedUseCaseDir = path.join(workDirRepository, relativeUseCaseDir);

  fs.mkdirSync(isolatedUseCaseDir, { recursive: true });
  fs.cpSync(targetDir, isolatedUseCaseDir, { recursive: true });

  const isolatedGuidesDir = path.join(workDirRepository, 'guides');
  fs.mkdirSync(isolatedGuidesDir, { recursive: true });

  copyFileIfExists(path.join(guidesDir, 'template.grader.ts'), path.join(isolatedGuidesDir, 'template.grader.ts'));
  copyFileIfExists(path.join(guidesDir, 'test-fixture.ts'), path.join(isolatedGuidesDir, 'test-fixture.ts'));
  copyFileIfExists(path.join(guidesDir, 'playwright.config.ts'), path.join(isolatedUseCaseDir, 'playwright.config.ts'));
  copyFileIfExists(path.join(rootDir, 'tsconfig.json'), path.join(isolatedUseCaseDir, 'tsconfig.json'));

  // Mirror base app into the isolated environment if task exists
  const useCaseName = path.basename(targetDir);
  const taskMap = getTaskMap();
  const taskInfo = taskMap.get(`${useCaseName}/task`);
  if (taskInfo) {
    const baseAppName = taskInfo.baseApp;
    const baseAppSrc = path.join(rootDir, 'harness', 'base_apps', baseAppName);
    if (fs.existsSync(baseAppSrc)) {
      const baseAppDest = path.join(workDirRepository, 'harness', 'base_apps', baseAppName);
      console.log(`Copying base app ${baseAppName} to isolated workspace...`);
      fs.mkdirSync(path.dirname(baseAppDest), { recursive: true });
      fs.cpSync(baseAppSrc, baseAppDest, {
        recursive: true,
        filter: (srcPath) => !srcPath.includes('node_modules') && !srcPath.includes('.cache')
      });

      const pkgJsonDest = path.join(baseAppDest, 'package.json');
      if (fs.existsSync(pkgJsonDest)) {
        console.log(`Installing dependencies in isolated base app: ${baseAppName}...`);
        try {
          execSync('pnpm install', { cwd: baseAppDest, stdio: 'ignore' });
        } catch (err: any) {
          console.warn(`Warning: pnpm install failed in isolated base app: ${err.message}`);
        }
      }
    }
  }

  return { workDirRoot, workDirRepository, relativeUseCaseDir };
}

async function runGraderGeneration(targetDir: string, prompt: string): Promise<void> {
  const { workDirRoot, workDirRepository, relativeUseCaseDir } = setupIsolatedWorkDir(targetDir);

  try {
    console.log(`Setting up Playwright in isolated environment...`);
    const { execSync } = await import('child_process');
    execSync('npm init -y', { cwd: workDirRepository, stdio: 'ignore' });
    execSync('npm pkg set type="module"', { cwd: workDirRepository, stdio: 'ignore' });
    execSync('npm install -D @playwright/test typescript @types/node --registry=https://registry.npmjs.org/', { cwd: workDirRepository, stdio: 'inherit' });
    execSync('npx playwright install chromium', { cwd: workDirRepository, stdio: 'ignore', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(workDirRepository, '.cache', 'ms-playwright') } });

    const command = config.environment.geminiCliBin;
    const commandArgs = [
      '-p', prompt,
      '--yolo'
    ];

    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`Starting Gemini CLI agent for grader generation in ${workDirRepository} (Attempt ${attempt}/${maxRetries})`);
      console.log(`Executing prompt...`);

      const child = spawn(command, commandArgs, {
        cwd: workDirRepository,
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

    const useCaseName = path.basename(targetDir);
    const taskMap = getTaskMap();
    const taskInfo = taskMap.get(`${useCaseName}/task`);
    const baseAppName = taskInfo?.baseApp || 'daily-grind';

    const targetsDir = path.join(targetDir, 'targets', baseAppName);
    const hasTargets = fs.existsSync(targetsDir);
    const isLegacy = fs.existsSync(path.join(targetDir, 'grader.ts')) && !fs.existsSync(path.join(targetDir, 'targets'));

    let destFile: string;
    if (isLegacy) {
      destFile = path.join(targetDir, 'grader.ts');
    } else {
      fs.mkdirSync(targetsDir, { recursive: true });
      destFile = path.join(targetsDir, 'grader.ts');
    }

    const generatedFile = path.join(workDirRepository, relativeUseCaseDir, 'grader.ts');
    if (fs.existsSync(generatedFile)) {
      fs.copyFileSync(generatedFile, destFile);
      console.log(`Successfully generated grader.ts at ${destFile}`);
    } else {
      console.error(`Error: grader.ts was not generated by Gemini CLI in ${path.join(workDirRepository, relativeUseCaseDir)}`);
    }

    console.log("Grader generation finished.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    throw err;
  } finally {
    cleanupIsolatedHome(workDirRoot);
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
  const expectationsPath = path.join(targetDir, 'expectations.md');
  const templatePath = path.join(guidesDir, 'template.grader.ts');
  const useCaseName = path.basename(targetDir);
  const taskMap = getTaskMap();
  const taskInfo = taskMap.get(`${useCaseName}/task`);
  const baseAppName = taskInfo?.baseApp || 'daily-grind';

  const hasSolutionFolder = fs.existsSync(path.join(targetDir, 'solution'));
  const hasSolutionPatch = fs.existsSync(path.join(targetDir, 'solution.patch'));
  const hasTargets = fs.existsSync(path.join(targetDir, 'targets', baseAppName));
  const hasSolution = hasSolutionFolder || hasSolutionPatch || hasTargets;

  if (hasSolution) {
    if (!fs.existsSync(guidePath) || !fs.existsSync(expectationsPath) || !fs.existsSync(templatePath)) {
      console.error(`Error: Missing required files for solution-based guide. Need guide.md/SKILL.md, expectations.md, and template.grader.ts`);
      process.exit(1);
    }
  } else {
    const demoPath = path.join(targetDir, 'demo.html');
    const negativeDemoPath = path.join(targetDir, 'negative-demo.html');
    if (!fs.existsSync(guidePath) || !fs.existsSync(demoPath) || !fs.existsSync(expectationsPath) || !fs.existsSync(negativeDemoPath) || !fs.existsSync(templatePath)) {
      console.error(`Error: Missing required files. Need guide.md/SKILL.md, demo.html, negative-demo.html, expectations.md, and template.grader.ts`);
      process.exit(1);
    }
  }

  const relativePath = path.relative(guidesDir, targetDir);
  const pathParts = relativePath.split(path.sep).filter(Boolean);
  const relativeTestFixturePath = pathParts.length > 0
    ? pathParts.map(() => '..').join('/') + '/test-fixture.ts'
    : './test-fixture.ts';

  let prompt: string;
  if (hasSolution) {
    prompt = getBasePromptOptionB(path.basename(guidePath), relativeTestFixturePath, baseAppName);
  } else {
    prompt = getBasePrompt(path.basename(guidePath), relativeTestFixturePath);
  }

  await runGraderGeneration(targetDir, prompt);
}

export async function generateGraderWithContext(targetDirRaw: string, calibrationResult: CalibrationResult): Promise<void> {
  const targetDir = path.resolve(process.cwd(), targetDirRaw);

  if (!fs.existsSync(targetDir)) {
    throw new Error(`Directory not found: ${targetDir}`);
  }

  const useCaseName = path.basename(targetDir);
  const taskMap = getTaskMap();
  const taskInfo = taskMap.get(`${useCaseName}/task`);
  const baseAppName = taskInfo?.baseApp || 'daily-grind';

  const hasSolutionFolder = fs.existsSync(path.join(targetDir, 'solution'));
  const hasSolutionPatch = fs.existsSync(path.join(targetDir, 'solution.patch'));
  const hasTargets = fs.existsSync(path.join(targetDir, 'targets', baseAppName));
  const hasSolution = hasSolutionFolder || hasSolutionPatch || hasTargets;

  const failureLines: string[] = [];
  if (calibrationResult.demo.failingTests.length > 0) {
    const runName = hasSolution ? 'solution-patched base app' : 'demo.html';
    failureLines.push(`- ${runName} failed these tests (they should pass): ${calibrationResult.demo.failingTests.join(', ')}`);
  }
  if (calibrationResult.negative.passingTests.length > 0) {
    const runName = hasSolution ? 'unmodified base app' : 'negative-demo.html';
    failureLines.push(`- ${runName} passed these tests (they should fail): ${calibrationResult.negative.passingTests.join(', ')}`);
  }

  let guidePath = path.join(targetDir, 'guide.md');
  if (!fs.existsSync(guidePath)) {
    guidePath = path.join(targetDir, 'SKILL.md');
  }

  const contextSuffix = `

A previous attempt at generating grader.ts failed calibration:
${failureLines.join('\n')}
Revise the grader to fix these issues.`;

  const relativePath = path.relative(guidesDir, targetDir);
  const pathParts = relativePath.split(path.sep).filter(Boolean);
  const relativeTestFixturePath = pathParts.length > 0
    ? pathParts.map(() => '..').join('/') + '/test-fixture.ts'
    : './test-fixture.ts';

  let prompt: string;
  if (hasSolution) {
    prompt = getBasePromptOptionB(path.basename(guidePath), relativeTestFixturePath, baseAppName);
  } else {
    prompt = getBasePrompt(path.basename(guidePath), relativeTestFixturePath);
  }

  await runGraderGeneration(targetDir, prompt + contextSuffix);
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
