import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { rootDir, baseAppsDir } from '../../core/paths.ts';
import {
  createIsolatedHome,
  spawnAsync,
  setupAgentCredentials,
  getAgentCommandAndArgs,
  sanitizeAgentChildEnv,
} from './agent-shared.ts';
import { Agents } from '../config.ts';
import { getDefaultSolutionAgent } from '../../core/guide-validation.ts';
import { buildSandboxPolicy, wrapCommandInSandbox } from './sandbox.ts';

export async function copyBaseAppToWorkspace(baseApp: string, destDir: string): Promise<void> {
  const refBaseAppDir = path.join(baseAppsDir, baseApp);
  if (!fs.existsSync(refBaseAppDir)) {
    console.warn(`Source base app not found at ${refBaseAppDir}`);
    return;
  }
  await fs.promises.cp(refBaseAppDir, destDir, {
    recursive: true,
    filter: (src) => !src.includes('/dist') && !src.includes('/.astro') && !src.includes('node_modules'),
  });
}


export async function runCommand(command: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
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
  agent: Agents,
  prompt: string,
  workDir?: string,
  options: { captureOutput?: boolean; homeDir?: string } = {}
): Promise<string> {
  const raw = getAgentCommandAndArgs(agent, prompt, options.homeDir);
  const { command, commandArgs } = options.homeDir
    ? wrapCommandInSandbox(raw.command, raw.commandArgs, buildSandboxPolicy(options.homeDir, 'unguided'))
    : raw;
  const env = sanitizeAgentChildEnv(process.env, {
    ...raw.envOverrides,
    ...(options.homeDir ? { HOME: options.homeDir, ZDOTDIR: options.homeDir } : {}),
    ...(workDir ? { PWD: workDir } : {}),
  });

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

export function setupGuideDevWorkDir(
  suffix: string,
  relativeWorkSubdir?: string,
  agent?: Agents
): { workDir: string; tempHome: string } {
  const tempHome = createIsolatedHome(`gd-gen-${suffix}`);
  const workDir = relativeWorkSubdir ? path.join(tempHome, relativeWorkSubdir) : path.join(tempHome, 'work');
  fs.mkdirSync(workDir, { recursive: true });

  const effectiveAgent: Agents = agent ?? (getDefaultSolutionAgent() as Agents);
  setupAgentCredentials(effectiveAgent, tempHome);

  // Symlink host node_modules to tempHome/node_modules and tempHome/guides/node_modules for local typechecking inside the sandbox
  const hostNodeModules = path.join(rootDir, 'node_modules');
  if (fs.existsSync(hostNodeModules)) {
    fs.symlinkSync(hostNodeModules, path.join(tempHome, 'node_modules'));
  }

  // Write a dummy package.json at tempHome with type: module so tsc compiles test-fixture.ts as ESM
  fs.writeFileSync(
    path.join(tempHome, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2)
  );
  
  return { workDir, tempHome };
}
