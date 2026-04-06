import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

import config from '../harness/config.ts';
import { createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, createTrustedFolders } from '../harness/lib/agent-shared.ts';

export async function generateNegative(targetDirRaw: string) {
  const targetDir = path.resolve(process.cwd(), targetDirRaw);
  
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory not found: ${targetDir}`);
    process.exit(1);
  }
  
  // Read input files
  let guidePath = path.join(targetDir, 'guide.md');
  if (!fs.existsSync(guidePath)) {
    guidePath = path.join(targetDir, 'SKILL.md');
  }
  const demoPath = path.join(targetDir, 'demo.html');
  const expectationsPath = path.join(targetDir, 'expectations.md');
  
  if (!fs.existsSync(guidePath) || !fs.existsSync(demoPath) || !fs.existsSync(expectationsPath)) {
    console.error(`Error: Missing required files in ${targetDir}. Need guide.md or SKILL.md, demo.html, and expectations.md.`);
    process.exit(1);
  }
  
  // Formulate prompt
  const userPrompt = `
Read the guide file (${path.basename(guidePath)}) and expectations.md files to understand the guidance and expectations.
Then read the demo.html file, which represents a perfect working example of the guides and expectations.

With this information, create another example file that represents an anti-example of what is outlined in the guide and expectations.
Make sure that it does not fulfill anything that the expectations and guide suggest.

Within the generated code, do not include any comments, and do not indicate in any way that this is a negative example.
The output should be a single file named negative-demo.html. Do not modify any other files.

- When writing files, you MUST use your built-in structured file editing tools (e.g., \`write_file\` or \`replace\`). Do not use shell commands (like \`cat\`, \`echo\`, or heredocs \`<<\`) to create files in the terminal.
  `;
  
  /**
   * Sets up an isolated HOME and work directory to ensure isolation.
   */
  function setupIsolatedWorkDir(baseDir: string): string {
    const tempHome = createIsolatedHome('ghh-negative-gen');
    // Copy over the source folder content as our working directory base
    const workDir = path.join(tempHome, 'work');
    fs.mkdirSync(workDir, { recursive: true });
  
    // copy all files and folders from target dir to work dir
    fs.cpSync(baseDir, workDir, { recursive: true });
  
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

  const workDir = setupIsolatedWorkDir(targetDir);

  try {
    const command = config.environment.geminiCliBin;
    const commandArgs = [
      '-p', userPrompt,
      '--yolo' // Ensure it runs without user interaction
    ];

    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`Starting Gemini CLI agent for negative generation in ${workDir} (Attempt ${attempt}/${maxRetries})`);
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

    // After gemini cli finishes, copy negative-demo.html back to the original target dir
    const generatedFile = path.join(workDir, 'negative-demo.html');
    const destFile = path.join(targetDir, 'negative-demo.html');
    if (fs.existsSync(generatedFile)) {
      fs.copyFileSync(generatedFile, destFile);
      console.log(`Successfully generated negative-demo.html at ${destFile}`);
    } else {
      console.error(`Error: negative-demo.html was not generated by Gemini CLI in ${workDir}`);
    }

    console.log("Negative demo generation finished.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: gd dev <path/to/guide> --gen-negative');
    process.exit(1);
  }
  generateNegative(args[0]).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
