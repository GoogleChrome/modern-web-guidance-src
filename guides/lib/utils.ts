import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import config from '../../harness/config.ts';
import { rootDir, baseAppsDir, guidesDir } from '../../lib/paths.ts';
import { applyPatchSync } from '../../lib/patch-utils.ts';
import {
  createIsolatedHome,
  cleanupIsolatedHome,
  createTrustedFolders,
  spawnAsync,
} from '../../harness/lib/agent-shared.ts';
import { setupJetskiCliCredentials } from '../../harness/agents/jetski-cli-agent.ts';
import { setupGeminiCliCredentials } from '../../harness/agents/gemini-cli-agent.ts';

export function stageBaseAppWorkspace(
  baseApp: string,
  patchFile?: string,
  prefix: string = 'grade-run'
): { workDir: string; cleanup: () => void } {
  const tempHome = createIsolatedHome(prefix);
  const workDir = path.join(tempHome, baseApp);
  fs.mkdirSync(workDir, { recursive: true });

  const refBaseAppDir = path.join(baseAppsDir, baseApp);
  if (fs.existsSync(refBaseAppDir)) {
    fs.cpSync(refBaseAppDir, workDir, {
      recursive: true,
      filter: (src) => !src.includes('node_modules'),
    });
  }

  const sourceNodeModules = path.join(refBaseAppDir, 'node_modules');
  if (fs.existsSync(sourceNodeModules)) {
    try {
      fs.symlinkSync(sourceNodeModules, path.join(workDir, 'node_modules'));
    } catch (e) {}
  }

  if (patchFile && fs.existsSync(patchFile)) {
    if (fs.readFileSync(patchFile, 'utf8').trim().length > 0) {
      applyPatchSync(workDir, patchFile);
    }
  }

  const cleanup = () => {
    try {
      cleanupIsolatedHome(tempHome);
    } catch (e) {}
  };

  return { workDir, cleanup };
}

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

export async function runAgent(
  prompt: string,
  workDir?: string,
  options: { captureOutput?: boolean } = {}
): Promise<string> {
  const useJetski = process.env.GD_DEV_USE_JETSKI === '1';
  const command = useJetski ? config.environment.jetskiCliBin : config.environment.geminiCliBin;
  const commandArgs = ['-p', prompt];

  if (useJetski) {
    const model = process.env.JETSKI_MODEL;
    if (model) commandArgs.push('--model', model);
    commandArgs.push('--dangerously-skip-permissions');
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

export function setupIsolatedWorkDir(prefix: string, relativeWorkSubdir?: string): string {
  const tempHome = createIsolatedHome(prefix);
  const workDir = relativeWorkSubdir ? path.join(tempHome, relativeWorkSubdir) : path.join(tempHome, 'work');
  fs.mkdirSync(workDir, { recursive: true });

  const geminiDest = path.join(tempHome, '.gemini');
  if (process.env.GD_DEV_USE_JETSKI === '1') {
    setupJetskiCliCredentials(tempHome);
  } else {
    setupGeminiCliCredentials(tempHome);
  }

  createTrustedFolders(geminiDest, [tempHome]);
  process.env.HOME = tempHome;

  // Symlink host node_modules to tempHome/node_modules and tempHome/guides/node_modules for local typechecking inside the sandbox
  const hostNodeModules = path.join(rootDir, 'node_modules');
  if (fs.existsSync(hostNodeModules)) {
    fs.symlinkSync(hostNodeModules, path.join(tempHome, 'node_modules'));
  }
  const hostGuidesNodeModules = path.join(rootDir, 'guides', 'node_modules');
  if (fs.existsSync(hostGuidesNodeModules)) {
    fs.mkdirSync(path.join(tempHome, 'guides'), { recursive: true });
    fs.symlinkSync(hostGuidesNodeModules, path.join(tempHome, 'guides', 'node_modules'));
  }

  // Write a dummy package.json at tempHome with type: module so tsc compiles test-fixture.ts as ESM
  fs.writeFileSync(
    path.join(tempHome, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2)
  );
  
  return workDir;
}

export function escapeLeftAngleBracket(text: string): string {
  return text.replaceAll('<', '&lt;');
}

export interface PassRates {
  unguided: string;
  guided: string;
  guidesConsumed?: string[];
}

export function parsePassRates(output: string): Record<string, PassRates> | null {
  const rates: Record<string, PassRates> = {};
  const lines = output.split('\n');
  let currentBaseApp = '';

  for (const line of lines) {
    const baseAppMatch = line.match(/Running agent test for target:\s*(\S+)/);
    if (baseAppMatch) {
      currentBaseApp = baseAppMatch[1].trim();
      continue;
    }

    const unguidedMatch = line.match(/Unguided:\s+\d+\/\d+\s+checks passed\s+\((\d+)%\)/);
    if (unguidedMatch) {
      const app = currentBaseApp || 'demo';
      if (!rates[app]) {
        rates[app] = { unguided: '', guided: '', guidesConsumed: [] };
      }
      rates[app].unguided = unguidedMatch[1];
    }

    const guidedMatch = line.match(/Guided:\s+\d+\/\d+\s+checks passed\s+\((\d+)%\)/);
    if (guidedMatch) {
      const app = currentBaseApp || 'demo';
      if (!rates[app]) {
        rates[app] = { unguided: '', guided: '', guidesConsumed: [] };
      }
      rates[app].guided = guidedMatch[1];
    }

    const guidesMatch = line.match(/Guides consumed:\s+\[(.*)\]/);
    if (guidesMatch) {
      const app = currentBaseApp || 'demo';
      if (!rates[app]) {
        rates[app] = { unguided: '', guided: '', guidesConsumed: [] };
      }
      rates[app].guidesConsumed = guidesMatch[1]
        ? guidesMatch[1].split(',').map(g => g.trim())
        : [];
    }
  }

  return Object.keys(rates).length > 0 ? rates : null;
}
