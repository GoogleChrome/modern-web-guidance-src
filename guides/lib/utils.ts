import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import config from '../../harness/config.ts';
import {
  createIsolatedHome,
  copyFileIfExists,
  createTrustedFolders,
  spawnAsync,
  cleanupIsolatedHome,
} from '../../harness/lib/agent-shared.ts';

export async function runCommand(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, GEMINI_CLI_TRUST_WORKSPACE: 'true' },
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

export async function runAgent(
  prompt: string,
  workDir?: string,
  options: { captureOutput?: boolean } = {}
): Promise<string> {
  const useJetski = process.env.GD_USE_JETSKI === '1';
  const command = useJetski ? config.environment.jetskiCliBin : config.environment.geminiCliBin;
  const commandArgs = ['-p', prompt];
  
  if (useJetski) {
    const model = process.env.JETSKI_MODEL;
    if (model) commandArgs.push('--model', model);
  } else {
    commandArgs.push('--yolo');
  }

  if (options.captureOutput) {
    return runCommand(command, commandArgs, workDir);
  }

  const exitCode = await spawnAsync(command, commandArgs, {
    cwd: workDir,
    env: { ...process.env },
    stdio: 'inherit',
  });

  if (exitCode !== 0) {
    throw new Error(`${useJetski ? 'Jetski' : 'Gemini'} CLI exited with code ${exitCode}`);
  }

  return '';
}

export interface Sandbox {
  workDir: string;
  tempHome: string;
  cleanup: () => void;
}

const activeSandboxes = new Set<string>();

export function setupIsolatedWorkDir(prefix: string, relativeWorkSubdir?: string): Sandbox {
  const tempHome = createIsolatedHome(prefix);
  const workDir = relativeWorkSubdir ? path.join(tempHome, relativeWorkSubdir) : path.join(tempHome, 'work');
  fs.mkdirSync(workDir, { recursive: true });

  const originalHome = process.env.HOME || process.cwd();
  const geminiSource = path.join(originalHome, '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');
  fs.mkdirSync(geminiDest, { recursive: true });

  for (const file of ['oauth_creds.json', 'google_accounts.json', 'installation_id', 'settings.json']) {
    copyFileIfExists(path.join(geminiSource, file), path.join(geminiDest, file));
  }

  // Setup Jetski credentials
  const jetskiSource = path.join(geminiSource, 'jetski');
  const jetskiDest = path.join(geminiDest, 'jetski');
  fs.mkdirSync(jetskiDest, { recursive: true });
  for (const file of ['installation_id', 'user_settings.pb']) {
    copyFileIfExists(path.join(jetskiSource, file), path.join(jetskiDest, file));
  }
  process.env.JETSKI_DIR = jetskiDest;

  // Setup gcloud credentials for Google SDK calls inside the sandbox
  const gcloudSource = path.join(originalHome, '.config', 'gcloud');
  const gcloudDest = path.join(tempHome, '.config', 'gcloud');
  if (fs.existsSync(gcloudSource)) {
    fs.mkdirSync(path.dirname(gcloudDest), { recursive: true });
    try {
      fs.cpSync(gcloudSource, gcloudDest, { recursive: true, errorOnExist: false });
    } catch (err) {
      console.warn(`Warning: Could not copy gcloud credentials: ${err}`);
    }
  }

  createTrustedFolders(geminiDest, [tempHome]);
  process.env.HOME = tempHome;

  activeSandboxes.add(tempHome);

  const cleanup = () => {
    if (activeSandboxes.has(tempHome)) {
      cleanupIsolatedHome(tempHome);
      activeSandboxes.delete(tempHome);
    }
  };

  return { workDir, tempHome, cleanup };
}

// Global cleanup handlers for exit and termination signals
function globalCleanup() {
  for (const homeDir of activeSandboxes) {
    try {
      cleanupIsolatedHome(homeDir);
    } catch {}
  }
  activeSandboxes.clear();
}

process.on('exit', globalCleanup);
process.on('SIGINT', () => { globalCleanup(); process.exit(130); });
process.on('SIGTERM', () => { globalCleanup(); process.exit(143); });

export function escapeLeftAngleBracket(text: string): string {
  return text.replaceAll('<', '&lt;');
}

export interface PassRates {
  unguided: string;
  guided: string;
}

export function parsePassRates(output: string): PassRates | null {
  const unguidedMatch = output.match(
    /Unguided:\s+\d+\/\d+\s+checks passed\s+\((\d+)%\)/,
  );
  const guidedMatch = output.match(
    /Guided:\s+\d+\/\d+\s+checks passed\s+\((\d+)%\)/,
  );

  if (unguidedMatch && guidedMatch) {
    return {unguided: unguidedMatch[1], guided: guidedMatch[1]};
  }
  return null;
}
