import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';

export interface TargetServer {
  url: string;
  stop: () => Promise<void>;
}

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

function runPnpm(args: string[], cwd: string): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', args, {
      cwd,
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

export async function startTargetServer(
  targetDir: string,
  options?: { targetFile?: string; quiet?: boolean }
): Promise<TargetServer> {
  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    if (options?.targetFile) {
      return {
        url: `http://localhost/${path.basename(options.targetFile)}`,
        stop: async () => {},
      };
    }
    throw new Error(`package.json not found in target directory: ${targetDir}`);
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  if (pkgJson.scripts?.build) {
    if (!options?.quiet) {
      console.log(`[TEST-FIXTURE] Running pnpm install in ${targetDir}`);
    }
    // --no-frozen-lockfile: pnpm defaults to frozen installs when CI=true, which would fail
    // if a solution patch adds a dependency to package.json without updating pnpm-lock.yaml.
    const installResult = await runPnpm(
      ['--ignore-workspace', 'install', '--prefer-offline', '--no-frozen-lockfile'],
      targetDir
    );
    if (installResult.status !== 0 && !options?.quiet) {
      console.warn(
        `[TEST-FIXTURE] pnpm install failed in ${targetDir}${installResult.output ? `:\n${installResult.output}` : ''}`
      );
    }

    const buildResult = await runPnpm(['--ignore-workspace', 'run', 'build'], targetDir);
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
    return {
      url: `${url}/`,
      stop: () =>
        new Promise<void>((resolve) => {
          server.closeAllConnections?.();
          server.close(() => resolve());
        }),
    };
  }

  const port = await getFreePort();
  const serverProcess = spawn('pnpm', ['--ignore-workspace', 'run', 'start'], {
    cwd: targetDir,
    env: { ...process.env, PORT: port.toString() },
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });

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
    if (serverProcess.pid) {
      try {
        process.kill(-serverProcess.pid);
      } catch {
        // ignore
      }
    }
    throw new Error(`Server in ${targetDir} failed to start on port ${port}`);
  }

  return {
    url,
    stop: async () => {
      if (serverProcess.pid) {
        try {
          process.kill(-serverProcess.pid);
        } catch {
          // ignore
        }
      }
    },
  };
}
