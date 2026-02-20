import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import config, { Agents } from '../harness/config.ts';
import { updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, createTrustedFolders } from '../harness/lib/agent-shared.ts';

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

const guideContent = fs.readFileSync(guidePath, 'utf8');
const demoContent = fs.readFileSync(demoPath, 'utf8');
const negativeDemoContent = fs.readFileSync(negativeDemoPath, 'utf8');
const expectationsContent = fs.readFileSync(expectationsPath, 'utf8');
const templateContent = fs.readFileSync(templatePath, 'utf8');

// Formulate prompt
const userPrompt = `
Based on guide.md and expectations.md, generate a Playwright test script to model the expectations.md requirements.
You should use template.grader.ts as the framework for the test.
The demo.html is a perfect working example (golden).
The negative-demo.html is an anti-example that fails the expectations.

<guide.md>
${guideContent}
</guide.md>

<expectations.md>
${expectationsContent}
</expectations.md>

<demo.html>
${demoContent}
</demo.html>

<negative-demo.html>
${negativeDemoContent}
</negative-demo.html>

<template.grader.ts>
${templateContent}
</template.grader.ts>

Generate a set of robust tests with functional and browser assertions to accurately grade an implementation against these expectations.
The output should be a single file named grader.ts. Do not modify any other files. Do this now.
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
  fs.readdirSync(baseDir).forEach(file => {
    copyFileIfExists(path.join(baseDir, file), path.join(workDir, file));
  });

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
