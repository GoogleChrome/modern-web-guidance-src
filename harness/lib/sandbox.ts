/**
 * @file sandbox.ts
 * @description Wraps eval agent commands in an OS-level filesystem sandbox that
 * hides this repository from the agent. Without it, agents can discover the repo
 * (e.g. via $PATH or by searching the filesystem) and read guides, expectations
 * and graders directly, invalidating eval results.
 *
 * - Linux: bubblewrap (`bwrap`) mounts an empty tmpfs over the repo root.
 * - macOS: `sandbox-exec` denies reads/writes under the repo root.
 *
 * A small set of paths the harness genuinely needs are re-exposed (see
 * {@link buildSandboxPolicy}). If no sandbox tool is available we fail loudly
 * rather than silently running an unprotected eval. Set GD_UNSAFE_NO_SANDBOX=1
 * to bypass (local debugging only).
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { rootDir, harnessDir } from '../../lib/paths.ts';

export const UNSAFE_NO_SANDBOX_ENV = 'GD_UNSAFE_NO_SANDBOX';

export interface SandboxPolicy {
  /** Directory that is hidden from the agent. */
  hiddenDir: string;
  /** Paths inside hiddenDir re-exposed read-only. */
  readOnlyPaths: string[];
  /** Paths inside hiddenDir re-exposed read-write. */
  writablePaths: string[];
}

function realpathOrSelf(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * Builds the sandbox policy for an agent run.
 * @param targetDir The per-run results directory (holds the npx shim and modern-web.log)
 * @param runType The run type; the skills-cli dist is only exposed for guided runs
 * @param repoRoot Repository root to hide (defaults to this repo)
 */
export function buildSandboxPolicy(targetDir: string, runType: string, repoRoot: string = rootDir): SandboxPolicy {
  const hiddenDir = realpathOrSelf(repoRoot);
  const readOnlyPaths = [
    // Agent CLI binaries (claude/codex/gemini) and their pnpm-linked dependencies.
    path.join(harnessDir, 'node_modules'),
    path.join(repoRoot, 'node_modules'),
  ];
  const writablePaths = [targetDir];
  if (runType === 'guided') {
    // The npx shim redirects `npx modern-web-guidance@latest` to this local build.
    const skillsCliDir = path.join(repoRoot, 'dist', 'skills-cli');
    readOnlyPaths.push(skillsCliDir);
    // The bundled transformers.js tokenizer caches downloads next to the skill.
    const tokenizerCacheDir = path.join(skillsCliDir, 'skills', '.cache');
    if (fs.existsSync(skillsCliDir)) {
      fs.mkdirSync(tokenizerCacheDir, { recursive: true });
      writablePaths.push(tokenizerCacheDir);
    }
  }

  const isInside = (p: string) => p === hiddenDir || p.startsWith(hiddenDir + path.sep);
  const resolveExisting = (paths: string[]) =>
    paths.filter(p => fs.existsSync(p)).map(realpathOrSelf).filter(isInside);

  return {
    hiddenDir,
    readOnlyPaths: resolveExisting(readOnlyPaths),
    writablePaths: resolveExisting(writablePaths),
  };
}

function hasBinary(name: string): boolean {
  return spawnSync('which', [name], { stdio: 'ignore' }).status === 0;
}

function bindOrSymlink(args: string[], p: string): void {
  try {
    const lst = fs.lstatSync(p);
    if (lst.isSymbolicLink()) {
      args.push('--symlink', fs.readlinkSync(p), p);
    } else {
      args.push('--bind', p, p);
    }
  } catch {
    // Ignore transient entries in /run
  }
}

/**
 * Inside bwrap's unprivileged user namespace, only the current user's UID is
 * mapped; root-owned directories on the host appear owned by `nobody` (65534).
 * Tools that verify ancestor directory ownership for user runtime/credential
 * files under `/run` (e.g. `/run/user/<uid>`) reject paths whose parents are
 * owned by `nobody`. Re-creating `/run` and any immediate subdirectory containing
 * current-user entries with mode 0755 makes them owned by the current user
 * inside the namespace while preserving all `/run` entries.
 */
function appendRunDirMounts(args: string[], runDir: string = '/run'): void {
  const uid = process.getuid?.();
  if (uid === undefined || !fs.existsSync(runDir)) return;

  let entries: string[];
  try {
    entries = fs.readdirSync(runDir);
  } catch {
    return;
  }

  const dirsWithUserEntries = new Map<string, string[]>();
  for (const name of entries) {
    const p = path.join(runDir, name);
    try {
      if (!fs.lstatSync(p).isDirectory()) continue;
      const subEntries = fs.readdirSync(p);
      const hasUserEntry = subEntries.some(sub => {
        try {
          return fs.lstatSync(path.join(p, sub)).uid === uid;
        } catch {
          return false;
        }
      });
      if (hasUserEntry) dirsWithUserEntries.set(name, subEntries);
    } catch {
      // Ignore unreadable or transient entries in /run
    }
  }

  if (dirsWithUserEntries.size === 0) return;

  args.push('--perms', '0755', '--tmpfs', runDir);
  for (const name of entries) {
    const p = path.join(runDir, name);
    const subEntries = dirsWithUserEntries.get(name);
    if (subEntries) {
      args.push('--perms', '0755', '--dir', p);
      for (const sub of subEntries) {
        bindOrSymlink(args, path.join(p, sub));
      }
    } else {
      bindOrSymlink(args, p);
    }
  }
}

export function buildBwrapArgs(command: string, commandArgs: string[], policy: SandboxPolicy, runDir: string = '/run'): string[] {
  const args = ['--dev-bind', '/', '/', '--die-with-parent', '--tmpfs', policy.hiddenDir];
  for (const p of policy.readOnlyPaths) args.push('--ro-bind', p, p);
  for (const p of policy.writablePaths) args.push('--bind', p, p);
  appendRunDirMounts(args, runDir);
  args.push('--', command, ...commandArgs);
  return args;
}

/**
 * Returns every ancestor directory of `p` up to and including `root`.
 */
function ancestorsWithin(p: string, root: string): string[] {
  const result: string[] = [];
  let current = path.dirname(p);
  while (current.startsWith(root) && current.length >= root.length) {
    result.push(current);
    if (current === root) break;
    current = path.dirname(current);
  }
  return result;
}

export function buildSeatbeltArgs(command: string, commandArgs: string[], policy: SandboxPolicy): string[] {
  const params: string[] = ['-D', `HIDDEN=${policy.hiddenDir}`];
  const rules: string[] = [
    '(version 1)',
    '(allow default)',
    '(deny file-read* file-write* (subpath (param "HIDDEN")))',
  ];

  // Later rules take precedence in SBPL. Allow stat() (but not listing) on the
  // ancestors of re-exposed paths so path resolution through the hidden dir works.
  const ancestors = new Set<string>();
  for (const p of [...policy.readOnlyPaths, ...policy.writablePaths]) {
    for (const a of ancestorsWithin(p, policy.hiddenDir)) ancestors.add(a);
  }

  let i = 0;
  const addParam = (value: string) => {
    const name = `P${i++}`;
    params.push('-D', `${name}=${value}`);
    return `(param "${name}")`;
  };
  for (const a of ancestors) rules.push(`(allow file-read-metadata (literal ${addParam(a)}))`);
  for (const p of policy.readOnlyPaths) rules.push(`(allow file-read* (subpath ${addParam(p)}))`);
  for (const p of policy.writablePaths) rules.push(`(allow file-read* file-write* (subpath ${addParam(p)}))`);

  return [...params, '-p', rules.join('\n'), command, ...commandArgs];
}

/**
 * Wraps a command so it runs inside the filesystem sandbox.
 * @throws If no supported sandbox tool is available (unless GD_UNSAFE_NO_SANDBOX=1).
 */
export function wrapCommandInSandbox(
  command: string,
  commandArgs: string[],
  policy: SandboxPolicy,
  platform: NodeJS.Platform = process.platform
): { command: string; commandArgs: string[] } {
  if (process.env[UNSAFE_NO_SANDBOX_ENV] === '1') {
    console.warn(`⚠️  ${UNSAFE_NO_SANDBOX_ENV}=1: running agent WITHOUT a filesystem sandbox. The agent can read guides and graders.`);
    return { command, commandArgs };
  }

  if (platform === 'linux') {
    if (!hasBinary('bwrap')) {
      throw new Error(`bubblewrap (bwrap) is required to sandbox eval agents on Linux. Install it (e.g. 'sudo apt install bubblewrap') or set ${UNSAFE_NO_SANDBOX_ENV}=1 for local debugging.`);
    }
    return { command: 'bwrap', commandArgs: buildBwrapArgs(command, commandArgs, policy) };
  }

  if (platform === 'darwin') {
    if (!hasBinary('sandbox-exec')) {
      throw new Error(`sandbox-exec is required to sandbox eval agents on macOS. Set ${UNSAFE_NO_SANDBOX_ENV}=1 for local debugging.`);
    }
    return { command: 'sandbox-exec', commandArgs: buildSeatbeltArgs(command, commandArgs, policy) };
  }

  throw new Error(`No filesystem sandbox is available on platform '${platform}'. Set ${UNSAFE_NO_SANDBOX_ENV}=1 to run unsandboxed.`);
}
