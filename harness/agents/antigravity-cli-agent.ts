import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { Agents } from '../config.ts';
import {
  cleanupIsolatedHome,
  parseAgentArgs,
  watchLogFile,
  exportTrajectories,
  runCliAgentCommand,
  setupIsolatedWorkDir,
  isEnoent
} from '../lib/agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import {
  type TrajectorySummary,
  finalizeTrajectorySummary,
  generateNormalizedTrajectory
} from '../lib/trajectory-normalizer.ts';
// agy stores conversations in the same SQLite step schema as Jetski CLI, so the parser is shared.
// TODO: The shared SQLite parser is lossy (it scrapes JSON fragments from protobuf payloads, so it can
// drop or invent steps and doesn't attribute subagent steps). agy also writes structured data that
// would give more accurate trajectories:
//   - `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript_full.jsonl`
//     (one JSON line per step with tool names/args; subagent links in `.system_generated/subagents/*.json`)
//   - `--output-format stream-json` on stdout (tool calls, outputs, and per-step token usage)
// Neither includes the model name, so keep `gen_metadata` (or pass `--model` explicitly) for that.
// Switch agy to these sources when/if Jetski CLI is removed and this parser no longer needs to be shared.
import { parseJetskiCliSession } from './jetski-cli-agent.ts';

/** agy app data directory, relative to HOME. */
const AGY_APP_DATA_SUBDIR = path.join('.gemini', 'antigravity-cli');
/** OAuth token file agy writes to its app data directory on Linux. */
const AGY_OAUTH_TOKEN_FILE = 'antigravity-oauth-token';

interface AgySettings {
  gcp?: { project?: string; location?: string };
  trustedWorkspaces?: string[];
}

function readAgySettings(settingsPath: string): AgySettings {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
    return {};
  }
}

/**
 * macOS resolves the login keychain relative to $HOME, and agy stores its OAuth
 * token there. Link the real keychain dir into the isolated HOME so auth works.
 */
function linkMacKeychains(originalHome: string, tempHome: string): void {
  if (process.platform !== 'darwin') return;
  const src = path.join(originalHome, 'Library', 'Keychains');
  const dest = path.join(tempHome, 'Library', 'Keychains');
  if (!fs.existsSync(src) || fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.symlinkSync(src, dest);
}

export function setupAntigravityCliCredentials(tempHome: string): void {
  const originalHome = process.env.HOME || os.homedir();
  const agySource = path.join(originalHome, AGY_APP_DATA_SUBDIR);
  const agyDest = path.join(tempHome, AGY_APP_DATA_SUBDIR);

  fs.mkdirSync(agyDest, { recursive: true });

  const sourceSettings = readAgySettings(path.join(agySource, 'settings.json'));
  const project = config.environment.antigravityGcpProject || sourceSettings.gcp?.project;
  if (!project) {
    console.log('No GCP project configured for agy; using the signed-in Antigravity account.');
  }

  const settings: AgySettings = {
    ...(project ? { gcp: { project, location: sourceSettings.gcp?.location || 'global' } } : {}),
    trustedWorkspaces: [tempHome]
  };
  fs.writeFileSync(path.join(agyDest, 'settings.json'), JSON.stringify(settings, null, 2));

  // On Linux, agy stores its OAuth token as a file in the app data dir rather than a keychain.
  // Copy (not symlink) so concurrent workers refreshing the token don't clobber each other.
  const tokenSource = path.join(agySource, AGY_OAUTH_TOKEN_FILE);
  if (fs.existsSync(tokenSource)) {
    fs.copyFileSync(tokenSource, path.join(agyDest, AGY_OAUTH_TOKEN_FILE));
  }

  linkMacKeychains(originalHome, tempHome);
}

export function getAntigravityCliCommandAndArgs(prompt: string): { command: string; commandArgs: string[] } {
  const command = config.environment.antigravityCliBin;
  const model = process.env.ANTIGRAVITY_MODEL;
  const commandArgs = [
    '-p', prompt,
    '--dangerously-skip-permissions',
    ...(model ? ['--model', model] : [])
  ];
  return { command, commandArgs };
}

function exportAntigravityTrajectories(workDir: string, targetDir: string): void {
  const conversationsDir = path.join(path.dirname(workDir), AGY_APP_DATA_SUBDIR, 'conversations');
  exportTrajectories(conversationsDir, '*.db', targetDir);
}

export async function parseAntigravityTrajectory(dirPath: string): Promise<TrajectorySummary> {
  return finalizeTrajectorySummary({ ...parseJetskiCliSession(dirPath), agent: Agents.ANTIGRAVITY_CLI });
}

async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('antigravity-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.ANTIGRAVITY_CLI, templateDir, runType, targetDir);

  if (!workDir) {
    throw new Error('Failed to initialize working directory');
  }

  try {
    console.log(`Starting Antigravity CLI agent in: ${workDir}`);

    const { command, commandArgs } = getAntigravityCliCommandAndArgs(userPrompt);
    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    process.env.MODERN_WEB_LOG_DIR = targetDir;
    let stopWatchingMcpLog = () => { };

    try {
      stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));
      await runCliAgentCommand(command, commandArgs, workDir, targetDir, 'Antigravity CLI', runType);
    } finally {
      stopWatchingMcpLog();
      exportAntigravityTrajectories(workDir, targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.ANTIGRAVITY_CLI, userPrompt);
    }

    console.log('Antigravity CLI agent finished successfully.');
  } catch (err) {
    console.error('Error during Antigravity CLI execution:', err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
