import fs from 'fs';
import path from 'path';
import { execSync, spawn, type SpawnOptions } from 'child_process';
import { Agents, type SuiteConfig } from '../config.ts';
import {
  ALLOWED_CHILD_ENV_KEYS,
  ALLOWED_ENV_PREFIXES,
  copySanitizedNpmrc,
  filterAllowedEnv,
  sanitizeTextSecrets,
} from './secret-guard.ts';
import { ZERO_PASSRATE_PATCH_FILE } from '../../core/guide-validation.ts';
import { DEFAULT_GUIDED_MWGRC } from '../../core/feature-gates.ts';
import { MODERN_WEB_LOG_FILE } from '../../core/constants.ts';
import { normalizeBaselineTarget, type MwgConfig } from '../../core/mwgrc.ts';
import { rootDir } from '../../core/paths.ts';
import { capturePatchFromGit, initGitRepo } from '../../core/patch-utils.ts';
import { gitExec } from '../../core/git-utils.ts';
import { buildSandboxPolicy, wrapCommandInSandbox } from './sandbox.ts';
import { generateNormalizedTrajectory } from './trajectory-normalizer.ts';

import { setupJetskiCliCredentials, getJetskiCliCommandAndArgs } from '../agents/jetski-cli-agent.ts';
import { setupClaudeCodeCredentials, getClaudeCodeCommandAndArgs } from '../agents/claude-code-agent.ts';
import { setupCodexCliCredentials, getCodexCliCommandAndArgs } from '../agents/codex-cli-agent.ts';
import { setupPiCredentials, getPiCommandAndArgs, getPiEnvOverrides } from '../agents/pi-agent.ts';
import { setupAntigravityCliCredentials, getAntigravityCliCommandAndArgs } from '../agents/antigravity-cli-agent.ts';

export function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

export function isEnoent(err: unknown): boolean {
  return isNodeError(err) && err.code === 'ENOENT';
}

function readUtf8IfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

/**
 * macOS resolves the login keychain relative to $HOME, where JetSki and agy store
 * their OAuth tokens. Without linking the real keychain dir into the isolated HOME,
 * silent auth fails and the CLI falls back to an interactive login prompt.
 */
export function linkMacKeychains(originalHome: string, tempHome: string): void {
  if (process.platform !== 'darwin') return;
  const src = path.join(originalHome, 'Library', 'Keychains');
  const dest = path.join(tempHome, 'Library', 'Keychains');
  if (!fs.existsSync(src) || fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.symlinkSync(src, dest);
}

export function setupAgentCredentials(agent: Agents, tempHome: string): void {
  switch (agent) {
    case Agents.JETSKI_CLI:
      setupJetskiCliCredentials(tempHome);
      break;
    case Agents.CLAUDE_CODE:
      setupClaudeCodeCredentials(tempHome);
      break;
    case Agents.CODEX_CLI:
      setupCodexCliCredentials(tempHome);
      break;
    case Agents.PI:
      setupPiCredentials(tempHome);
      break;
    case Agents.ANTIGRAVITY_CLI:
      setupAntigravityCliCredentials(tempHome);
      break;
    default:
      throw new Error(`Unsupported agent: ${agent}`);
  }
}

export function getAgentCommandAndArgs(
  agent: Agents,
  prompt: string,
  homeDir?: string,
  extraArgs: string[] = [],
): { command: string; commandArgs: string[]; envOverrides?: NodeJS.ProcessEnv } {
  switch (agent) {
    case Agents.JETSKI_CLI:
      return getJetskiCliCommandAndArgs(prompt);
    case Agents.CLAUDE_CODE:
      return getClaudeCodeCommandAndArgs(prompt, extraArgs);
    case Agents.CODEX_CLI:
      return getCodexCliCommandAndArgs(prompt);
    case Agents.PI:
      return { ...getPiCommandAndArgs(prompt, extraArgs), envOverrides: getPiEnvOverrides(homeDir) };
    case Agents.ANTIGRAVITY_CLI:
      return getAntigravityCliCommandAndArgs(prompt);
    default:
      throw new Error(`Unsupported agent: ${agent}`);
  }
}

export function setupInterceptorShims(homeDir: string, runType: string = 'guided'): string {
  const shimDir = path.join(homeDir, '.gd-bin');
  fs.mkdirSync(shimDir, { recursive: true });
  const templatePath = path.join(import.meta.dirname, '..', 'npx-intercept.template.ts');
  const localCliPath = runType === 'guided'
    ? path.join(rootDir, 'dist', 'skills-cli', 'skills/modern-web-guidance/modern-web.mjs')
    : '';
  const templateContent = fs.readFileSync(templatePath, 'utf8').replace('__LOCAL_CLI_PATH__', localCliPath);
  for (const binName of ['npx', 'pnpx', 'pnpm']) {
    const wrapperPath = path.join(shimDir, binName);
    fs.writeFileSync(wrapperPath, templateContent, { mode: 0o755 });
    fs.chmodSync(wrapperPath, 0o755);
  }
  return shimDir;
}

export function setupIsolatedWorkDir(
  agent: Agents,
  templateDir: string,
  runType: string,
): string {
  const tempHome = createIsolatedHome(`ghh-${agent}`);
  const shimDir = setupInterceptorShims(tempHome, runType);
  setupIsolatedShellProfiles(tempHome, shimDir);
  const workDir = createWorkDir(templateDir, tempHome, runType);

  setupAgentCredentials(agent, tempHome);
  process.env.HOME = tempHome;
  process.env.ZDOTDIR = tempHome;

  if (runType === 'guided') {
    const suiteConfig = getSuiteConfig();
    copySkills(tempHome, agent, suiteConfig.skillsToEnable);
  }

  return workDir;
}

export interface GuideUsage {
  retrievedGuides: string[];
  fileReadGuides: string[];
}

/**
 * Gets the suite configuration from environment variables or returns default.
 */
export function getSuiteConfig(): SuiteConfig {
  const configEnv = process.env.GD_SUITE_CONFIG;
  if (!configEnv) {
    throw new Error('GD_SUITE_CONFIG environment variable is missing.');
  }
  try {
    const configContent = configEnv.trim().startsWith('{')
      ? configEnv
      : fs.readFileSync(configEnv, 'utf8');
    return JSON.parse(configContent);
  } catch (e) {
    throw new Error(`Failed to parse GD_SUITE_CONFIG environment variable: ${e}`, { cause: e });
  }
}

/**
 * Promisified version of child_process.spawn.
 */
export function spawnAsync(command: string, args: string[], options: SpawnOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', reject);
  });
}

/**
 * Sets up shell profile files (.bashrc, .bash_profile, .zshrc, .zprofile, .profile) in the isolated HOME directory
 * to ensure that shimDir (containing our npx interceptor shim) remains at the front of PATH even if
 * an external binary or login shell invokes /usr/libexec/path_helper and resets PATH.
 * @param homeDir Path to the isolated HOME directory
 * @param shimDir Path to the directory containing our intercepted binaries (like npx)
 */
export function setupIsolatedShellProfiles(homeDir: string, shimDir: string): void {
  const profileContent = `export PATH="${shimDir}:$PATH"\n`;
  const profileFiles = ['.bashrc', '.bash_profile', '.zshrc', '.zprofile', '.profile'];
  for (const file of profileFiles) {
    fs.writeFileSync(path.join(homeDir, file), profileContent, 'utf8');
  }
}

/** Env var through which run.mjs assigns the isolated HOME path for each agent attempt. */
export const ISOLATED_HOME_ENV = 'GD_ISOLATED_HOME';

/**
 * Creates a unique isolated HOME directory in /tmp.
 * @param prefix The prefix for the directory name
 * @param targetDir Optional path to the target directory containing intercepted binaries
 * @returns The path to the created directory.
 */
export function createIsolatedHome(prefix: string, targetDir?: string): string {
  // Use /tmp/ deliberately because os.tmpdir() on macOS can return paths that are
  // too long for valid Unix socket paths, which causes issues for some JetSki/VS Code components.
  // run.mjs assigns the path via GD_ISOLATED_HOME so it can remove the directory after each
  // attempt, even when the attempt is killed by the timeout before cleanupIsolatedHome runs.
  const tempHome = process.env[ISOLATED_HOME_ENV] || `/tmp/${prefix}-${Math.random().toString(36).substring(7)}`;
  fs.mkdirSync(tempHome, { recursive: true });

  if (targetDir) {
    setupIsolatedShellProfiles(tempHome, targetDir);
  }

  // Copy sanitized npm config so isolated runs don't inherit host auth tokens or broken private registries
  const userConfig = process.env.NPM_CONFIG_USERCONFIG || process.env.npm_config_userconfig;
  const originalHome = process.env.HOME || process.cwd();
  copySanitizedNpmrc(userConfig || path.join(originalHome, '.npmrc'), path.join(tempHome, '.npmrc'));

  // Configure default timeouts for curl to prevent hanging on unreachable or stalled sockets
  fs.writeFileSync(path.join(tempHome, '.curlrc'), 'max-time = 15\nconnect-timeout = 5\n', 'utf8');

  console.log(`Setting up isolated HOME at ${tempHome}...`);
  return tempHome;
}

/**
 * Clean up the isolated HOME directory.
 * @param homeDir Path to the directory to remove.
 */
export function cleanupIsolatedHome(homeDir: string): void {
  if (!homeDir) return;
  console.log(`\nCleaning up isolated HOME.`);
  fs.rmSync(homeDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

/**
 * Helper to copy a file if it exists.
 * @param src Source path
 * @param dest Destination path
 */
export function copyFileIfExists(src: string, dest: string): void {
  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    if (!isEnoent(err)) {
      console.warn(`Warning: Failed to copy ${src} to ${dest}:`, err);
    }
  }
}

/**
 * Safely reads and parses a JSONL file, filtering out empty or malformed lines.
 */
export function parseJsonlFile<T = any>(filePath: string): T[] {
  const content = readUtf8IfExists(filePath);
  if (content === null) return [];

  const items: T[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      items.push(JSON.parse(line) as T);
    } catch {
      // Skip malformed JSONL line
    }
  }
  return items;
}

const AGENT_SKILLS_DIRS: Record<Agents, string> = {
  [Agents.CLAUDE_CODE]: path.join('.claude', 'skills'),
  [Agents.CODEX_CLI]: path.join('.agents', 'skills'),
  [Agents.PI]: path.join('.agents', 'skills'),
  [Agents.JETSKI_CLI]: path.join('.gemini', 'jetski', 'skills'),
  [Agents.ANTIGRAVITY_CLI]: path.join('.gemini', 'antigravity-cli', 'skills'),
};

/**
 * Copies the enabled Skills into the isolated home directory for the agent.
 * modern-web-guidance (and its resources) is installed from the skills-cli distribution.
 * @param homeDir Path to the isolated home directory
 * @param agent The agent type
 * @param skillsToEnable Names of the skills to make available to the agent
 * @returns True if successful, false otherwise
 */
export function copySkills(homeDir: string, agent: Agents, skillsToEnable: string[] = ['modern-web-guidance']): boolean {
  const skillsRelDir = AGENT_SKILLS_DIRS[agent];
  if (!skillsRelDir) {
    throw new Error(`Unsupported agent: ${agent}`);
  }
  const destDir = path.join(homeDir, skillsRelDir);

  try {
    fs.mkdirSync(destDir, { recursive: true });

    if (skillsToEnable.some(s => s.startsWith('modern-web'))) {
      // Add modern-web-guidance Skill (& resources) from skills-cli dist
      const distSource = path.join(rootDir, 'dist/skills-cli/skills/modern-web-guidance');
      const destSkillDir = path.join(destDir, 'modern-web-guidance');
      // Clear dest first to ensure clean state
      fs.rmSync(destSkillDir, { recursive: true, force: true });

      try {
        fs.cpSync(distSource, destSkillDir, { recursive: true });
      } catch (err) {
        if (!isEnoent(err)) throw err;
        console.log(`skills-cli distribution not found at ${distSource}. Running 'pnpm run build-dist' automatically...`);
        execSync('pnpm run build-dist', { cwd: rootDir, stdio: 'inherit' });
        console.log('Distribution generated successfully.');
        fs.cpSync(distSource, destSkillDir, { recursive: true });
      }
    }

    console.log(`Copied Skills to ${destDir}`);
    return true;
  } catch (err) {
    console.error(`Failed to copy guides: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export interface AgentArgs {
  userPrompt: string;
  runType: string;
  targetDir: string;
  templateDir: string;
}

/**
 * Parses command line arguments for agents.
 * Usage: node <agent-script> <prompt> <runType> <targetDir> <templateDir>
 *
 * @param scriptName Name of the script for usage message
 * @returns Parsed arguments
 */
export function parseAgentArgs(scriptName: string): AgentArgs {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    // Single task scenario (no template directory is passed)
    if (args.length === 3) {
      args.push('');
    } else {
      console.error(`Usage: node ${scriptName} <prompt> <runType> <targetDir> <templateDir>`);
      process.exit(1);
    }
  }
  const [userPrompt, runType, targetDirectoryRaw, templateDirRaw] = args;
  return {
    userPrompt,
    runType,
    targetDir: path.resolve(targetDirectoryRaw),
    templateDir: templateDirRaw ? path.resolve(templateDirRaw) : '',
  };
}

function hasGitCommit(workDir: string, ceilingDir: string): boolean {
  try {
    gitExec(['rev-parse', '--verify', 'HEAD'], {
      cwd: workDir,
      isolated: true,
      stdio: 'ignore',
      env: { GIT_CEILING_DIRECTORIES: ceilingDir },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates the working directory for the agent.
 * @param templateDir Path to the template directory
 * @param homeDir Path to the isolated home directory
 * @param runType The type of run
 * @returns The path to the working directory within the isolated home
 */
export function createWorkDir(templateDir: string, homeDir: string, runType: string): string {
  const isSingleTask = templateDir === '';
  const workDir = isSingleTask
    ? path.join(homeDir, runType)
    : path.join(homeDir, path.basename(templateDir));

  if (isSingleTask) {
    fs.mkdirSync(workDir, { recursive: true });
  } else {
    fs.cpSync(templateDir, workDir, { recursive: true });
  }

  // Guided sandboxes are pre-opted-in so gated guides can be retrieved; .mwgrc must land in the
  // root commit so it stays out of agent.patch (suite templates arrive with .git already).
  // Also write to homeDir so agents that `cd /tmp` before running `npx modern-web-guidance`
  // still resolve the sandbox's .mwgrc via the HOME fallback.
  if (runType === 'guided') {
    const mwgConfig: MwgConfig = { ...DEFAULT_GUIDED_MWGRC };
    const normalizedBaseline = normalizeBaselineTarget(process.env.BASELINE_TARGET);
    if (normalizedBaseline && normalizedBaseline !== 'widely') {
      mwgConfig.baseline = normalizedBaseline;
    }
    const serialized = JSON.stringify(mwgConfig, null, 2) + '\n';
    fs.writeFileSync(path.join(workDir, '.mwgrc'), serialized, 'utf8');
    fs.writeFileSync(path.join(homeDir, '.mwgrc'), serialized, 'utf8');
  }

  if (isSingleTask || !hasGitCommit(workDir, homeDir)) {
    initGitRepo(workDir);
  } else if (runType === 'guided') {
    gitExec(['add', '.mwgrc'], { cwd: workDir, isolated: true, stdio: 'ignore' });
    gitExec(['commit', '-q', '--amend', '--no-edit'], { cwd: workDir, isolated: true, stdio: 'ignore' });
  }
  return workDir;
}

/**
 * Copies results from the working directory to the target directory.
 * @param workDir The working directory where execution happened
 * @param targetDir The target directory to copy results to
 */
export function copyResultsToTarget(workDir: string, targetDir: string): void {
  const isLegacyTask = path.basename(path.dirname(targetDir)) === 'task';

  if (isLegacyTask) {
    // For legacy single-page guides, copy workspace files directly excluding .git and node_modules
    try {
      fs.cpSync(workDir, targetDir, {
        recursive: true,
        force: true,
        filter: (src) => {
          const base = path.basename(src);
          return base !== '.git' && base !== 'node_modules';
        },
      });
      console.log(`Copied results from ${workDir} to: ${targetDir}`);
    } catch (e) {
      console.warn(`Failed to copy results from ${workDir} to ${targetDir}: ${e}`);
    }
  } else {
    // For target-based guides, capture agent.patch for patch-only storage
    capturePatchFromGit(workDir, path.join(targetDir, 'agent.patch'));
    console.log(`Saved agent patch in: ${targetDir}`);
  }
}

/**
 * Watches a log file and prints new lines to stdout.
 * @param logPath The path to the log file
 * @returns A function to stop watching
 */
export function watchLogFile(logPath: string): () => void {
  let prevData = readUtf8IfExists(logPath) ?? '';
  const interval = setInterval(() => {
    try {
      const currentData = readUtf8IfExists(logPath);
      if (!currentData || currentData.length <= prevData.length) return;
      const newLogs = currentData.slice(prevData.length).trim();
      if (newLogs) {
        const formattedLogs = newLogs.split('\n').map(line => `\x1b[33m[Modern Web Log]:\x1b[0m ${line}`).join('\n');
        console.log(formattedLogs);
      }
      prevData = currentData;
    } catch (e) {
      console.error('Failed to read log file:', e);
    }
  }, 500);
  return () => clearInterval(interval);
}

/**
 * Builds the sanitized environment for child agent processes using an explicit allowlist,
 * preventing host credentials and session markers from leaking into agent sandboxes.
 */
export function sanitizeAgentChildEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env,
  overrides?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return filterAllowedEnv(sourceEnv, ALLOWED_CHILD_ENV_KEYS, ALLOWED_ENV_PREFIXES, overrides, {
    filterKiroTerm: true,
  });
}

function recordGenerationFailure(
  targetDir: string,
  agentName: string,
  timedOut: boolean,
  recordedExit: number,
  stdoutData: string,
  stderrData: string,
  errMsg: string,
): void {
  const finalExitCode = timedOut ? 'TIMEOUT (15m)' : recordedExit;
  const rawFailureStderr = timedOut && !stderrData ? 'Agent timed out after 15 minutes' : (stderrData || errMsg);

  // Save generation failure info so results collector registers early failure
  const failureFile = path.join(targetDir, 'generation_failed.json');
  fs.writeFileSync(
    failureFile,
    JSON.stringify(
      {
        agentName,
        exitCode: finalExitCode,
        stderr: sanitizeTextSecrets(rawFailureStderr),
        stdout: sanitizeTextSecrets(stdoutData),
      },
      null,
      2,
    ),
  );
  console.log(`Saved generation failure info to: ${failureFile}`);

  // Save whatever we have to agent_stderr.log on failure
  const stderrLogPath = path.join(targetDir, 'agent_stderr.log');
  const fallbackContent = `Execution failed: ${errMsg}\n${stderrData ? `\nCaptured stderr:\n${stderrData}` : ''}`;
  fs.writeFileSync(stderrLogPath, sanitizeTextSecrets(fallbackContent), 'utf8');
  console.log(`Saved fallback error log to: ${stderrLogPath}`);
}

/**
 * Runs a CLI agent command, capturing output to the terminal and to log files.
 * @param command The binary to run
 * @param commandArgs The arguments
 * @param workDir The working directory
 * @param targetDir The target directory for logs and results
 * @param agentName Name of the agent (for error messages)
 * @param runType The run type ('guided' or 'unguided'); controls what the sandbox exposes
 * @param envOverrides Optional environment variables to set after sanitizing process.env
 */
export async function runCliAgentCommand(
  command: string,
  commandArgs: string[],
  workDir: string,
  targetDir: string,
  agentName: string,
  runType: string,
  envOverrides?: NodeJS.ProcessEnv,
): Promise<void> {
  const tempHome = path.dirname(workDir);
  const shimDir = path.join(tempHome, '.gd-bin');
  const resultsRoot = path.join(rootDir, 'results');
  const sanitizedEnv = sanitizeAgentChildEnv(process.env, envOverrides);
  sanitizedEnv.PWD = workDir;
  sanitizedEnv.PATH = [
    shimDir,
    ...(sanitizedEnv.PATH || '')
      .split(path.delimiter)
      .filter(p => p && p !== targetDir && !p.startsWith(targetDir + path.sep) && !p.startsWith(resultsRoot + path.sep)),
  ].join(path.delimiter);
  sanitizedEnv.PWTEST_CACHE_DIR = path.join(
    sanitizedEnv.HOME || process.env.HOME || workDir,
    '.cache',
    'playwright-transform',
  );

  const isolatedLogPath = path.join(tempHome, MODERN_WEB_LOG_FILE);
  let stopWatchingMcpLog = () => {};
  if (runType === 'guided') {
    sanitizedEnv.MODERN_WEB_LOG_DIR = tempHome;
    sanitizedEnv.ENABLE_FILE_LOGGING = 'true';
    stopWatchingMcpLog = watchLogFile(isolatedLogPath);
  }

  // Hide the repo from the agent so it can't read guides/expectations/graders.
  const sandboxed = wrapCommandInSandbox(command, commandArgs, buildSandboxPolicy(tempHome, runType));
  const child = spawn(sandboxed.command, sandboxed.commandArgs, {
    cwd: workDir,
    env: sanitizedEnv,
    stdio: ['ignore', 'pipe', 'pipe'], // 'pipe' captures output for log files but does NOT print to terminal natively
    detached: true,
  });

  let stdoutData = '';
  let stderrData = '';
  let timedOut = false;
  let recordedExit = -1;

  const killChildGroup = (sig: NodeJS.Signals = 'SIGKILL') => {
    try {
      if (child.pid) process.kill(-child.pid, sig);
    } catch {
      // Process group already exited
    }
  };

  let killEscalationTimer: ReturnType<typeof setTimeout> | null = null;
  const terminateChildGroup = () => {
    killChildGroup('SIGTERM');
    if (!killEscalationTimer) {
      killEscalationTimer = setTimeout(() => {
        killChildGroup('SIGKILL');
        child.stdout?.destroy();
        child.stderr?.destroy();
      }, 150);
      killEscalationTimer.unref();
    }
  };

  // Catch SIGTERM from run.mjs's spawnSync timeout so the caller's finally block
  // (trajectory export + isolatedHome cleanup) runs instead of dying immediately.
  const onSigTerm = () => {
    timedOut = true;
    terminateChildGroup();
  };
  process.on('SIGTERM', onSigTerm);

  child.stdout?.on('data', (data) => {
    const chunk = data.toString();
    stdoutData += chunk;
    process.stdout.write(chunk);
  });

  child.stderr?.on('data', (data) => {
    const chunk = data.toString();
    stderrData += chunk;
    process.stderr.write(chunk);
  });

  try {
    try {
      recordedExit = await new Promise<number>((resolve, reject) => {
        let exitedCode: number | null = null;
        child.on('exit', (code) => {
          exitedCode = code ?? 1;
          terminateChildGroup();
        });
        child.on('close', (code) => resolve(code ?? exitedCode ?? 1));
        child.on('error', reject);
      });
    } catch (spawnErr) {
      const msg = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
      console.error(`Error in runCliAgentCommand:`, spawnErr);
      recordGenerationFailure(targetDir, agentName, timedOut, recordedExit, stdoutData, stderrData, msg);
      throw spawnErr;
    }

    // Save output to chat_log.txt
    const chatLogPath = path.join(targetDir, 'chat_log.txt');
    fs.writeFileSync(chatLogPath, sanitizeTextSecrets(stdoutData), 'utf8');
    console.log(`Saved output to: ${chatLogPath}`);

    copyResultsToTarget(workDir, targetDir);

    if (timedOut || recordedExit !== 0) {
      const exitLabel = timedOut ? 'TIMEOUT (15m)' : recordedExit;
      const err = new Error(`${agentName} exited with code ${exitLabel}`);
      console.error(`Error in runCliAgentCommand:`, err);
      recordGenerationFailure(targetDir, agentName, timedOut, recordedExit, stdoutData, stderrData, err.message);
      throw err;
    }

    // Save stderr to agent_stderr.log to surface unexpected problems on successful runs
    if (stderrData.length > 0) {
      const stderrLogPath = path.join(targetDir, 'agent_stderr.log');
      fs.writeFileSync(stderrLogPath, sanitizeTextSecrets(stderrData), 'utf8');
      console.log(`Saved stderr to: ${stderrLogPath}`);
    }
  } finally {
    stopWatchingMcpLog();
    if (runType === 'guided') {
      const rawLog = readUtf8IfExists(isolatedLogPath);
      if (rawLog !== null) {
        fs.writeFileSync(path.join(targetDir, MODERN_WEB_LOG_FILE), sanitizeTextSecrets(rawLog), 'utf8');
      }
    }
    process.off('SIGTERM', onSigTerm);
  }
}

export interface RunAgentCliOptions {
  agent: Agents;
  displayName: string;
  scriptName: string;
  extraArgs?: string[];
  beforeSetup?: () => Promise<void> | void;
  exportTrajectories: (workDir: string, targetDir: string) => void;
}

/**
 * Shared CLI entrypoint lifecycle for all agent runner scripts (`src/harness/agents/*-agent.ts`).
 * Sets up the isolated HOME and working directory, executes the agent CLI inside the sandbox,
 * exports raw and normalized trajectories on completion or timeout, and cleans up the isolated HOME.
 */
export async function runAgentCliEntrypoint(options: RunAgentCliOptions): Promise<void> {
  const { agent, displayName, scriptName, extraArgs, beforeSetup, exportTrajectories } = options;
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs(scriptName);
  await beforeSetup?.();
  const workDir = setupIsolatedWorkDir(agent, templateDir, runType);
  const tempHome = path.dirname(workDir);

  try {
    console.log(`Starting ${displayName} agent in: ${workDir}`);
    const { command, commandArgs, envOverrides } = getAgentCommandAndArgs(agent, userPrompt, tempHome, extraArgs);
    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    try {
      await runCliAgentCommand(command, commandArgs, workDir, targetDir, displayName, runType, envOverrides);
    } finally {
      exportTrajectories(workDir, targetDir);
      await generateNormalizedTrajectory(targetDir, agent, userPrompt);
    }

    console.log(`${displayName} agent finished successfully.`);
  } catch (err) {
    console.error(`Error during ${displayName} execution:`, err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(tempHome);
  }
}

/**
 * Generates the content for the grader script used to run Playwright tests.
 */
export function getGraderScriptContent(
  targetDir: string,
  graderPath: string,
  guideName: string,
  baselineTarget?: string,
): string {
  const runGraderModulePath = path.join(rootDir, 'src/grading/run-grader.ts');
  const targetFile = path.join(targetDir, 'index.html');
  const graderResults = path.join(targetDir, `${guideName}_results.json`);
  const agentPatch = path.join(targetDir, 'agent.patch');
  const zeroPassratePatch = path.join(path.dirname(graderPath), ZERO_PASSRATE_PATCH_FILE);
  const resolvedBaselineTarget = baselineTarget || 'widely';

  return `import fs from 'fs';
import { runPlaywright } from ${JSON.stringify(runGraderModulePath)};

async function run() {
  try {
    const patchFile = fs.existsSync(${JSON.stringify(agentPatch)}) ? ${JSON.stringify(agentPatch)} : undefined;
    const zeroPassrateFile = fs.existsSync(${JSON.stringify(zeroPassratePatch)}) ? ${JSON.stringify(zeroPassratePatch)} : undefined;
    const json = await runPlaywright(
      ${JSON.stringify(targetFile)},
      ${JSON.stringify(graderPath)},
      {
        stdio: 'inherit',
        patchFile,
        zeroPassrateFile,
        baselineTarget: ${JSON.stringify(resolvedBaselineTarget)},
      }
    );
    fs.writeFileSync(${JSON.stringify(graderResults)}, JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Playwright test execution failed:", err);
    process.exit(1); 
  }
}

run();`.trim();
}
