import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import config from '../harness/config.ts';
import { createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, createTrustedFolders } from '../harness/lib/agent-shared.ts';

// Get the path to the guide folder from the command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: pnpm generate-grader <path/to/guide>');
  process.exit(1);
}

const targetDirRaw = args[0];
const targetDir = path.resolve(process.cwd(), targetDirRaw);

if (!fs.existsSync(targetDir)) {
  console.error(`Error: Directory not found: ${targetDir}`);
  process.exit(1);
}

// Read input files
const guidePath = path.join(targetDir, 'guide.md');
const demoPath = path.join(targetDir, 'demo.html');
const negativeDemoPath = path.join(targetDir, 'negative-demo.html');
const expectationsPath = path.join(targetDir, 'expectations.md');
const templatePath = path.join(__dirname, 'template.grader.ts');

if (!fs.existsSync(guidePath) || !fs.existsSync(demoPath) || !fs.existsSync(expectationsPath) || !fs.existsSync(negativeDemoPath) || !fs.existsSync(templatePath)) {
  console.error(`Error: Missing required files. Need guide.md, demo.html, negative-demo.html, expectations.md, and template.grader.ts in the respective directories.`);
  process.exit(1);
}

const userPrompt = `
Read the guide.md and expectations.md files to understand the guidance and expectations.
Then, read the demo.html file, which represents a perfect working example of the guides and expectations, and the negative-demo.html file, which represents an anti-example that fails the expectations.

Using template.grader.ts as a framework, write a Playwright test script to model the expectations.md requirements.
You should generate a set of robust tests with functional and browser assertions.
Design it so that the demo.html passes all tests at 100% success rate, and the negative-demo.html fails all tests at 0% success rate.

The grader can be run with the following commands:

TARGET_FILE=$(pwd)/demo.html npx playwright test grader.ts
TARGET_FILE=$(pwd)/negative-demo.html npx playwright test grader.ts

The output should be a single file named grader.ts. Do not modify any other files.
`;

/**
 * Sets up an isolated HOME and work directory to ensure isolation.
 */
function setupIsolatedWorkDir(baseDir: string): string {
  const tempHome = createIsolatedHome('ghh-grader-gen');
  // Copy over the source folder content as our working directory base
  const workDir = path.join(tempHome, 'work');
  fs.mkdirSync(workDir, { recursive: true });

  // copy files from target dir to work dir
  const filesToStage = ['guide.md', 'demo.html', 'expectations.md', 'negative-demo.html'];
  filesToStage.forEach(file => {
    copyFileIfExists(path.join(baseDir, file), path.join(workDir, file));
  });

  // copy template.grader.ts from the guides directory
  copyFileIfExists(path.join(__dirname, 'template.grader.ts'), path.join(workDir, 'template.grader.ts'));

  // Provide testing config to the agent
  copyFileIfExists(path.join(__dirname, 'playwright.config.ts'), path.join(workDir, 'playwright.config.ts'));

  const geminiSource = path.join(path.resolve(process.env.HOME || process.cwd()), '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');
  fs.mkdirSync(geminiDest, { recursive: true });

  // Copy necessary auth and identification files
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

  // Set environment variables
  process.env.HOME = tempHome;

  return workDir;
}

async function run() {
  const workDir = setupIsolatedWorkDir(targetDir);

  try {
    console.log(`Setting up Playwright in isolated environment...`);
    // Provide isolated Playwright install to the directory
    const { execSync } = await import('child_process');
    execSync('npm init -y', { cwd: workDir, stdio: 'ignore' });
    execSync('npm install -D @playwright/test', { cwd: workDir, stdio: 'ignore' });
    execSync('npx playwright install chromium', { cwd: workDir, stdio: 'ignore', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(workDir, '.cache', 'ms-playwright') } });

    console.log(`Starting Gemini CLI agent for grader generation in ${workDir}`);

    const command = config.environment.geminiCliBin;
    const commandArgs = [
      '-p', userPrompt,
      '--yolo' // Ensure it runs without user interaction
    ];

    console.log(`Executing prompt...`);

    const child = spawn(command, commandArgs, {
      cwd: workDir,
      env: { ...process.env }, // Pass through environment variables (including new HOME)
      stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout/stderr
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      process.stdout.write(chunk); // Mirror to console
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      process.stderr.write(chunk); // Mirror to console
    });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`Gemini CLI exited with code ${exitCode}`);
    }

    // After gemini cli finishes, copy grader.ts back to the original target dir
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
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

run();
