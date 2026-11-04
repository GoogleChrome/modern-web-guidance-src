import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';

const DEFAULT_GIT_MAX_BUFFER = 64 * 1024 * 1024;
const FAST_GIT_FLAGS = ['-c', 'core.fsmonitor=false', '-c', 'commit.gpgSign=false', '-c', 'core.quotePath=false'] as const;
const NULL_DEVICE = process.platform === 'win32' ? 'NUL' : '/dev/null';

export interface GitExecOptions extends Omit<ExecFileSyncOptionsWithStringEncoding, 'encoding'> {
  /** Skip user ~/.gitconfig as well as system /etc/gitconfig (for temporary/sandbox repos). */
  isolated?: boolean;
}

export interface GitBatchObject {
  type: string;
  content: Buffer;
}

/**
 * Runs a local git command with system config hooks/telemetry disabled and fsmonitor off.
 */
export function gitExec(args: readonly string[], options?: GitExecOptions): string {
  const { isolated = false, env, maxBuffer = DEFAULT_GIT_MAX_BUFFER, ...rest } = options ?? {};
  return execFileSync('git', [...FAST_GIT_FLAGS, ...args], {
    ...rest,
    encoding: 'utf8',
    maxBuffer,
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      ...(isolated ? { GIT_CONFIG_GLOBAL: NULL_DEVICE } : {}),
      ...env,
    },
  });
}

/**
 * Reads multiple git objects (blobs, commits, trees, or `<rev>:<path>` specs) in one `cat-file --batch` call.
 */
export function readGitObjectsBatch(cwd: string, specs: readonly string[]): Map<string, GitBatchObject | null> {
  const results = new Map<string, GitBatchObject | null>();
  if (specs.length === 0) return results;

  const outBuf = execFileSync('git', [...FAST_GIT_FLAGS, 'cat-file', '--batch'], {
    cwd,
    input: `${specs.join('\n')}\n`,
    maxBuffer: DEFAULT_GIT_MAX_BUFFER,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
  });

  let pos = 0;
  for (const spec of specs) {
    const headerEnd = outBuf.indexOf(0x0a, pos);
    if (headerEnd === -1) {
      throw new Error(`Truncated git cat-file --batch output while reading ${spec}`);
    }
    const header = outBuf.toString('utf8', pos, headerEnd);
    pos = headerEnd + 1;
    if (header.endsWith(' missing')) {
      results.set(spec, null);
      continue;
    }

    const firstSpace = header.indexOf(' ');
    const secondSpace = header.indexOf(' ', firstSpace + 1);
    const type = firstSpace !== -1 && secondSpace !== -1 ? header.slice(firstSpace + 1, secondSpace) : '';
    const size = secondSpace !== -1 ? Number(header.slice(secondSpace + 1)) : Number.NaN;
    if (!type || !Number.isInteger(size) || size < 0 || pos + size > outBuf.length) {
      throw new Error(`Invalid git cat-file --batch entry "${header}" for ${spec}`);
    }

    results.set(spec, { type, content: outBuf.subarray(pos, pos + size) });
    pos += size + 1; // skip trailing LF
  }

  return results;
}
