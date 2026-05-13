import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import config from '../../harness/config.ts';
import {
  createIsolatedHome,
  copyFileIfExists,
  createTrustedFolders,
} from '../../harness/lib/agent-shared.ts';

export async function runCommand(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';
    child.stdout.on('data', (d) => { stdoutData += d; });
    child.stderr.on('data', (d) => { stderrData += d; });

    child.on('error', (err) => {
      reject(new Error(`Failed to start command ${command}: ${err.message}`));
    });

    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(`Command ${command} failed with code ${exitCode}. Stderr: ${stderrData}`));
      } else {
        resolve(stdoutData.trim());
      }
    });
  });
}

export async function runGemini(prompt: string, workDir?: string): Promise<string> {
  const command = config.environment.geminiCliBin;
  const commandArgs = ['-p', prompt, '--yolo'];
  
  process.env.GEMINI_CLI_TRUST_WORKSPACE = 'true';
  return runCommand(command, commandArgs, workDir);
}

export function setupIsolatedWorkDir(prefix: string): string {
  const tempHome = createIsolatedHome(prefix);
  const workDir = path.join(tempHome, 'work');
  fs.mkdirSync(workDir, { recursive: true });

  const originalHome = process.env.HOME || process.cwd();
  const geminiSource = path.join(originalHome, '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');
  fs.mkdirSync(geminiDest, { recursive: true });

  for (const file of ['oauth_creds.json', 'google_accounts.json', 'installation_id', 'settings.json']) {
    copyFileIfExists(path.join(geminiSource, file), path.join(geminiDest, file));
  }

  createTrustedFolders(geminiDest, [workDir]);
  process.env.HOME = tempHome;
  
  return workDir;
}

export function escapeLeftAngleBracket(text: string): string {
  return text.replaceAll('<', '&lt;');
}
