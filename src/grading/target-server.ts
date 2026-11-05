import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { baseAppsDir, ensureDiskNodeCompileCache } from '../core/paths.ts';

export interface TargetServer {
  url: string;
  stop: () => Promise<void>;
  error?: string;
}

export type StartedTargetServer = TargetServer;

const STATIKK_PLAIN_RE = /^\s*pnpm\s+dlx\s+statikk\s+--port\s+\$\{PORT:-\d+\}(?:\s+\.)?\s*$/;

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
  });
}

const activeServerPids = new Set<number>();
let exitHandlersRegistered = false;

function registerExitServerCleanup(): void {
  if (exitHandlersRegistered) return;
  exitHandlersRegistered = true;
  const cleanupAll = () => {
    for (const pid of activeServerPids) {
      killServerProcessTree(pid);
    }
    activeServerPids.clear();
  };
  process.once('exit', cleanupAll);
}

/**
 * Returns `rootPid` plus every process in the same session (`SID === rootPid`), process group
 * (`PGID === rootPid`), or descendant `PPID` tree. Because `pnpm run start` spawns its child
 * server (`node ./dist/server/entry.mjs`) in a new process group (`PGID !== rootPid`) while keeping
 * the detached session ID (`SID === rootPid`), `process.kill(-rootPid)` alone can miss the child.
 */
export function getSessionAndTreePids(rootPid: number): number[] {
  if (!Number.isInteger(rootPid) || rootPid <= 1) {
    return [];
  }
  const pids = new Set<number>();
  try {
    process.kill(rootPid, 0);
    pids.add(rootPid);
  } catch {
    // rootPid itself has already exited; still scan for any surviving session/group/child members below
  }
  const childrenByPpid = new Map<number, number[]>();

  if (process.platform === 'linux' && fs.existsSync('/proc')) {
    try {
      for (const entry of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(entry)) continue;
        try {
          const stat = fs.readFileSync(`/proc/${entry}/stat`, 'utf8');
          const closeParen = stat.lastIndexOf(')');
          if (closeParen === -1) continue;
          const fields = stat.slice(closeParen + 2).split(' ');
          const state = fields[0];
          if (state === 'Z') continue; // Ignore zombie processes already being reaped
          const pid = Number(entry);
          const ppid = Number(fields[1]);
          const pgid = Number(fields[2]);
          const sid = Number(fields[3]);
          if (pid === rootPid || sid === rootPid || pgid === rootPid) {
            pids.add(pid);
          }
          const list = childrenByPpid.get(ppid);
          if (list) list.push(pid);
          else childrenByPpid.set(ppid, [pid]);
        } catch {
          // Process exited while scanning /proc
        }
      }
    } catch {
      // Fallback below if /proc cannot be read
    }
  } else if (process.platform !== 'win32') {
    try {
      const ps = spawnSync('ps', ['-eo', 'pid=,ppid=,pgid=,sid='], { encoding: 'utf8' });
      if (ps.status === 0 && ps.stdout) {
        for (const line of ps.stdout.split('\n')) {
          const parts = line.trim().split(/\s+/).map(Number);
          if (parts.length < 4 || parts.some(Number.isNaN)) continue;
          const [pid, ppid, pgid, sid] = parts;
          if (pid === rootPid || sid === rootPid || pgid === rootPid) {
            pids.add(pid);
          }
          const list = childrenByPpid.get(ppid);
          if (list) list.push(pid);
          else childrenByPpid.set(ppid, [pid]);
        }
      }
    } catch {
      // Ignore ps failure
    }
  }

  const queue = [rootPid, ...pids];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const child of childrenByPpid.get(cur) ?? []) {
      if (!pids.has(child)) {
        pids.add(child);
        queue.push(child);
      }
    }
  }
  return [...pids];
}

/**
 * Terminates a detached target server (`rootPid`) and all of its session/descendant processes.
 */
export function killServerProcessTree(rootPid: number): void {
  if (!Number.isInteger(rootPid) || rootPid <= 1) return;
  const pids = getSessionAndTreePids(rootPid);
  try {
    process.kill(-rootPid, 'SIGTERM');
  } catch {
    // Process group already exited
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process already exited
    }
  }
  const survivors = getSessionAndTreePids(rootPid);
  try {
    process.kill(-rootPid, 'SIGKILL');
  } catch {
    // Process group already exited
  }
  for (const pid of survivors) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Process already exited
    }
  }
}

/**
 * Reads `pnpm.onlyBuiltDependencies` from the canonical untouched base app in `src/harness/base-apps/<baseAppName>/package.json`.
 * Never trusts `targetDir/package.json` for build approvals so agent-added dependencies cannot execute install scripts on the host.
 */
export function getBaseAppAllowedBuilds(baseAppName?: string): string[] {
  if (!baseAppName || !/^[a-z0-9-]+$/i.test(baseAppName)) {
    return [];
  }
  const canonicalPkgPath = path.join(baseAppsDir, baseAppName, 'package.json');
  if (!fs.existsSync(canonicalPkgPath)) {
    return [];
  }
  try {
    const raw = JSON.parse(fs.readFileSync(canonicalPkgPath, 'utf8')) as {
      pnpm?: { onlyBuiltDependencies?: unknown };
    };
    const list = raw.pnpm?.onlyBuiltDependencies;
    if (!Array.isArray(list)) return [];
    return list.filter((item): item is string => typeof item === 'string' && /^[a-z0-9@/_.-]+$/i.test(item));
  } catch {
    return [];
  }
}

/**
 * Writes a standalone `pnpm-workspace.yaml` in `targetDir` that:
 * 1. Anchors `targetDir` as its own workspace root so pnpm does not walk up to the parent repository.
 * 2. Approves build scripts only for `allowedPackages` (via both `onlyBuiltDependencies` for pnpm 10 and `allowBuilds` for pnpm 11+).
 * 3. Sets `strictDepBuilds: false` so unapproved build scripts (e.g. `@parcel/watcher` or agent-added packages) are skipped without `ERR_PNPM_IGNORED_BUILDS`.
 */
export function writeScopedPnpmWorkspace(targetDir: string, allowedPackages: string[]): string {
  const unique = [...new Set(allowedPackages)];
  const lines: string[] = ['strictDepBuilds: false'];
  if (unique.length === 0) {
    lines.push('onlyBuiltDependencies: []');
    lines.push('allowBuilds: {}');
  } else {
    lines.push('onlyBuiltDependencies:');
    for (const pkg of unique) {
      lines.push(`  - ${JSON.stringify(pkg)}`);
    }
    lines.push('allowBuilds:');
    for (const pkg of unique) {
      lines.push(`  ${JSON.stringify(pkg)}: true`);
    }
  }
  const workspaceYamlPath = path.join(targetDir, 'pnpm-workspace.yaml');
  fs.writeFileSync(workspaceYamlPath, lines.join('\n') + '\n', 'utf8');
  return workspaceYamlPath;
}

function runPnpm(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    const chunks: string[] = [];
    child.stdout?.on('data', (d) => chunks.push(d.toString()));
    child.stderr?.on('data', (d) => chunks.push(d.toString()));
    child.on('error', (err) => resolve({ status: 1, output: err.message }));
    child.on('close', (status) => resolve({ status, output: chunks.join('').trim() }));
  });
}

export async function spawnPlainTargetServer(
  targetDir: string,
  options?: { exportTargetUrlEnv?: boolean },
): Promise<TargetServer> {
  const port = await getFreePort();
  const nodeCompileCache = ensureDiskNodeCompileCache(process.env, 'harness');
  const serverProcess = spawn('pnpm', ['--ignore-workspace', 'run', 'start'], {
    cwd: targetDir,
    env: { ...process.env, PORT: port.toString(), NODE_COMPILE_CACHE: nodeCompileCache },
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: process.platform === 'win32',
  });

  const serverPid = serverProcess.pid;
  if (serverPid) {
    registerExitServerCleanup();
    activeServerPids.add(serverPid);
    if (process.env.SERVER_PIDS_FILE) {
      try {
        fs.appendFileSync(process.env.SERVER_PIDS_FILE, `${serverPid}\n`, 'utf8');
      } catch {
        // ignore if cannot write pid file
      }
    }
  }

  let serverStderr = '';
  serverProcess.stderr?.on('data', (chunk: Buffer) => {
    if (serverStderr.length < 4096) {
      serverStderr += chunk.toString('utf8');
    }
  });
  serverProcess.unref();

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    serverProcess.stderr?.destroy();
    if (serverPid) {
      activeServerPids.delete(serverPid);
      killServerProcessTree(serverPid);
    }
  };

  let exited = false;
  serverProcess.once('exit', () => {
    exited = true;
  });

  let baseUrlPath = '/';
  const configPath = path.join(targetDir, 'astro.config.mjs');
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const baseMatch = configContent.match(/base:\s*['"`](.*?)['"`]/);
    if (baseMatch) {
      baseUrlPath = '/' + baseMatch[1].replace(/^\/|\/$/g, '') + '/';
    }
  }

  const url = `http://localhost:${port}${baseUrlPath}`;
  const deadline = Date.now() + 30_000;
  let isReady = false;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        isReady = true;
        break;
      }
    } catch {
      // ignore while server boots
    }
    if (exited) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  if (!isReady) {
    await stop();
    const detail = serverStderr.trim();
    throw new Error(`Server in ${targetDir} failed to start on port ${port}${detail ? `:\n${detail}` : ''}`);
  }

  if (options?.exportTargetUrlEnv) {
    process.env.TARGET_URL = url;
  }

  return { url, stop };
}

export async function startTargetServer(
  targetDir: string,
  options?: { targetFile?: string; quiet?: boolean; exportTargetUrlEnv?: boolean }
): Promise<TargetServer> {
  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    if (options?.targetFile) {
      const url = `http://localhost/${path.basename(options.targetFile)}`;
      if (options?.exportTargetUrlEnv !== false) {
        process.env.TARGET_URL = url;
      }
      return {
        url,
        stop: async () => {},
      };
    }
    throw new Error(`package.json not found in target directory: ${targetDir}`);
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  const hasDependencies =
    Boolean(pkgJson.dependencies && Object.keys(pkgJson.dependencies).length > 0) ||
    Boolean(pkgJson.devDependencies && Object.keys(pkgJson.devDependencies).length > 0);

  const nodeCompileCache = ensureDiskNodeCompileCache(process.env, 'harness');
  const childEnv = { ...process.env, NODE_COMPILE_CACHE: nodeCompileCache };

  if (pkgJson.scripts?.build || hasDependencies) {
    if (!options?.quiet) {
      console.log(`[TEST-FIXTURE] Running pnpm install in ${targetDir}`);
    }
    // Write a standalone pnpm-workspace.yaml that approves only the canonical base app's
    // onlyBuiltDependencies (never agent-added dependency build scripts) and anchors the
    // workspace root at targetDir without needing --ignore-workspace.
    const allowedBuilds = getBaseAppAllowedBuilds(pkgJson.name);
    writeScopedPnpmWorkspace(targetDir, allowedBuilds);

    const installResult = await runPnpm(
      ['install', '--prefer-offline', '--no-frozen-lockfile'],
      targetDir,
      childEnv,
    );
    if (installResult.status !== 0 && !options?.quiet) {
      console.warn(
        `[TEST-FIXTURE] pnpm install failed in ${targetDir}${installResult.output ? `:\n${installResult.output}` : ''}`
      );
    }
  }

  if (pkgJson.scripts?.build) {
    const buildResult = await runPnpm(['--ignore-workspace', 'run', 'build'], targetDir, childEnv);
    if (buildResult.status !== 0) {
      throw new Error(
        `Failed to build target app in ${targetDir}${buildResult.output ? `:\n${buildResult.output}` : ''}`
      );
    }
  }

  if (!pkgJson.scripts?.start) {
    throw new Error(`package.json in ${targetDir} is missing a "start" script.`);
  }

  if (!pkgJson.scripts.build && STATIKK_PLAIN_RE.test(pkgJson.scripts.start)) {
    const { default: statikk } = await import('statikk');
    const { url, server } = await statikk({ root: targetDir, port: 0 });
    const fullUrl = `${url}/`;
    if (options?.exportTargetUrlEnv !== false) {
      process.env.TARGET_URL = fullUrl;
    }
    return {
      url: fullUrl,
      stop: () =>
        new Promise<void>((resolve) => {
          server.closeAllConnections?.();
          server.close(() => resolve());
        }),
    };
  }

  const server = await spawnPlainTargetServer(targetDir, options);
  if (options?.exportTargetUrlEnv !== false) {
    process.env.TARGET_URL = server.url;
  }
  return server;
}
