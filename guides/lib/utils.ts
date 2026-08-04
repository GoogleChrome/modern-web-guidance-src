import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { rootDir, baseAppsDir } from '../../lib/paths.ts';
import { applyPatchSync } from '../../lib/patch-utils.ts';
import {
  createIsolatedHome,
  cleanupIsolatedHome,
  createTrustedFolders,
  spawnAsync,
  setupAgentCredentials,
  getAgentCommandAndArgs,
  type AgentName,
} from '../../harness/lib/agent-shared.ts';

export { setupAgentCredentials, getAgentCommandAndArgs, type AgentName };

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
    fs.cpSync(refBaseAppDir, workDir, { recursive: true });
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

export async function runCommand(command: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env || { ...process.env },
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

export async function runAgentForModel(
  agent: AgentName,
  prompt: string,
  workDir?: string,
  options: { captureOutput?: boolean } = {}
): Promise<string> {
  const { command, commandArgs } = getAgentCommandAndArgs(agent, prompt);
  const tempHome = workDir ? path.dirname(workDir) : undefined;
  const env = tempHome ? { ...process.env, HOME: tempHome } : { ...process.env };

  if (options.captureOutput) {
    return runCommand(command, commandArgs, workDir, env);
  }

  const exitCode = await spawnAsync(command, commandArgs, {
    cwd: workDir,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  if (exitCode !== 0) {
    throw new Error(`${agent} CLI exited with code ${exitCode}`);
  }

  return '';
}

export function setupIsolatedWorkDir(prefix: string, relativeWorkSubdir?: string, agent?: AgentName): string {
  const tempHome = createIsolatedHome(prefix);
  const workDir = relativeWorkSubdir ? path.join(tempHome, relativeWorkSubdir) : path.join(tempHome, 'work');
  fs.mkdirSync(workDir, { recursive: true });

  const geminiDest = path.join(tempHome, '.gemini');
  const effectiveAgent: AgentName = agent ?? (process.env.GD_DEV_USE_JETSKI === '1' ? 'jetski' : 'gemini');
  setupAgentCredentials(effectiveAgent, tempHome);

  createTrustedFolders(geminiDest, [tempHome]);

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
