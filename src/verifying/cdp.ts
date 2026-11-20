/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CdpEventHandler = (params: Record<string, unknown>) => void;

export interface PageSession {
  send<T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T>;
  on(method: string, handler: CdpEventHandler): () => boolean;
}

export interface PageSessionOptions {
  mobile?: boolean;
  cpuThrottle?: number;
}

export interface LaunchBrowserOptions {
  executablePath?: string;
  launchTimeoutMs?: number;
}

export interface HeadlessBrowser {
  executablePath: string;
  withPageSession<T>(
    options: PageSessionOptions,
    fn: (session: PageSession) => Promise<T>,
  ): Promise<T>;
  close(): Promise<void>;
}

interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
}

function findPlaywrightHeadlessShell(cacheRoot: string | undefined): string | null {
  if (!cacheRoot || !existsSync(cacheRoot)) return null;
  let dirs: string[];
  try {
    dirs = readdirSync(cacheRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('chromium'))
      .map((d) => d.name)
      .sort()
      .reverse();
  } catch {
    return null;
  }
  for (const dir of dirs) {
    for (const rel of [
      'chrome-headless-shell-linux64/chrome-headless-shell',
      'chrome-linux/headless_shell',
      'chrome-linux/chrome',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    ]) {
      const candidate = path.join(cacheRoot, dir, rel);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function findPlaywrightChromiumExecutable(): string | null {
  const home = os.homedir();
  return (
    findPlaywrightHeadlessShell(process.env.PLAYWRIGHT_BROWSERS_PATH) ||
    findPlaywrightHeadlessShell(path.join(home, '.cache', 'ms-playwright')) ||
    findPlaywrightHeadlessShell('/var/cache/ms-playwright') ||
    findPlaywrightHeadlessShell(path.join(home, 'Library', 'Caches', 'ms-playwright'))
  );
}

export function findChromiumExecutable(): string | null {
  for (const envVar of [process.env.MODERN_WEB_CHROME_PATH, process.env.CHROME_BIN]) {
    if (envVar && existsSync(envVar)) return envVar;
  }
  const pwHit = findPlaywrightChromiumExecutable();
  if (pwHit) return pwHit;

  for (const bin of [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]) {
    if (existsSync(bin)) return bin;
  }
  return null;
}

export class CdpConnection {
  readonly wsUrl: string;
  private ws: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingCommand>();
  private readonly listeners = new Map<string, Set<CdpEventHandler>>();

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  async connect(timeoutMs = 5000): Promise<void> {
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`CDP WebSocket timeout: ${this.wsUrl}`)),
        timeoutMs,
      );
      ws.addEventListener(
        'open',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      ws.addEventListener(
        'error',
        (ev) => {
          clearTimeout(timer);
          const msg =
            'message' in ev && typeof ev.message === 'string' ? ev.message : 'connection failed';
          reject(new Error(`CDP WebSocket error: ${msg}`));
        },
        { once: true },
      );
    });

    ws.addEventListener('message', (event) => {
      let msg: {
        id?: number;
        method?: string;
        params?: Record<string, unknown>;
        result?: unknown;
        error?: { message?: string };
      };
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)) as typeof msg;
      } catch {
        return;
      }
      if (typeof msg.id === 'number') {
        const entry = this.pending.get(msg.id);
        if (!entry) return;
        this.pending.delete(msg.id);
        clearTimeout(entry.timer);
        if (msg.error) {
          entry.reject(new Error(`CDP ${entry.method}: ${msg.error.message || JSON.stringify(msg.error)}`));
        } else {
          entry.resolve(msg.result);
        }
        return;
      }
      if (msg.method) {
        const handlers = this.listeners.get(msg.method);
        if (handlers) {
          for (const fn of Array.from(handlers)) fn(msg.params ?? {});
        }
      }
    });

    ws.addEventListener('close', () => {
      for (const [, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error('CDP connection closed'));
      }
      this.pending.clear();
    });
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 8000,
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`CDP socket not open for ${method}`));
    }
    const ws = this.ws;
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: (val) => resolve(val as T), reject, timer, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method: string, handler: CdpEventHandler): () => boolean {
    let set = this.listeners.get(method);
    if (!set) {
      set = new Set();
      this.listeners.set(method, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  close(): void {
    if (!this.ws) return;
    try {
      this.ws.close();
    } catch {
      // Ignore close errors.
    }
    this.ws = null;
  }
}

export async function launchHeadlessBrowser(
  options: LaunchBrowserOptions = {},
): Promise<HeadlessBrowser> {
  const executablePath = options.executablePath || findChromiumExecutable();
  if (!executablePath) {
    throw new Error(
      'No Chromium/Chrome executable found. Set MODERN_WEB_CHROME_PATH (or CHROME_BIN) or install Playwright Chromium.',
    );
  }

  const isHeadlessShell = path.basename(executablePath).includes('headless');
  const userDataDir = isHeadlessShell
    ? null
    : mkdtempSync(path.join(os.tmpdir(), 'mw-verify-chrome-'));
  const args = [
    ...(isHeadlessShell ? ['--headless', '--single-process'] : ['--headless=new']),
    '--remote-debugging-port=0',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-extensions',
    '--disable-sync',
    '--no-first-run',
    '--mute-audio',
    '--no-proxy-server',
    '--password-store=basic',
    '--use-mock-keychain',
    '--window-size=1280,800',
    ...(userDataDir ? [`--user-data-dir=${userDataDir}`] : []),
    'about:blank',
  ];

  const proc = spawn(executablePath, args, {
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  const signalProc = (sig: NodeJS.Signals): void => {
    if (!proc.pid) return;
    try {
      process.kill(-proc.pid, sig);
    } catch {
      try {
        proc.kill(sig);
      } catch {
        // Already exited.
      }
    }
  };

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      proc.stderr?.destroy();
    } catch {
      // Ignore destroy errors.
    }
    if (proc.exitCode === null) {
      await new Promise<void>((resolve) => {
        proc.once('exit', () => resolve());
        signalProc('SIGTERM');
        const killTimer = setTimeout(() => {
          signalProc('SIGKILL');
          resolve();
        }, 300);
        if (typeof killTimer === 'object' && 'unref' in killTimer) killTimer.unref();
      });
    }
    proc.unref();
    if (userDataDir) {
      try {
        rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup races.
      }
    }
  };

  let wsUrl: string;
  try {
    wsUrl = await new Promise<string>((resolve, reject) => {
      let stderrText = '';
      const timer = setTimeout(
        () => reject(new Error(`Timed out launching Chromium (${executablePath}): ${stderrText.slice(-300)}`)),
        options.launchTimeoutMs ?? 8000,
      );
      const onData = (chunk: Buffer): void => {
        stderrText += chunk.toString('utf8');
        const match = stderrText.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          proc.stderr?.off('data', onData);
          resolve(match[1]);
        }
      };
      proc.stderr?.on('data', onData);
      proc.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      proc.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Chromium exited prematurely (code ${code}): ${stderrText.slice(-300)}`));
      });
    });
  } catch (err) {
    await close();
    throw err;
  }

  proc.stderr?.resume();
  const httpBase = wsUrl.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.*$/, '');
  let warmTabClaimed = false;

  const withPageSession = async <T>(
    sessionOpts: PageSessionOptions,
    fn: (session: PageSession) => Promise<T>,
  ): Promise<T> => {
    let target: { id?: string; type?: string; webSocketDebuggerUrl?: string } | null = null;
    let createdNewTab = false;

    if (!warmTabClaimed) {
      warmTabClaimed = true;
      const list = (await fetch(`${httpBase}/json/list`).then((r) => r.json())) as unknown;
      if (Array.isArray(list)) {
        target =
          (list as Array<{ id?: string; type?: string; webSocketDebuggerUrl?: string }>).find(
            (t) => t.type === 'page' && Boolean(t.webSocketDebuggerUrl),
          ) ?? null;
      }
    }
    if (!target?.webSocketDebuggerUrl) {
      target = (await fetch(`${httpBase}/json/new?about:blank`, { method: 'PUT' }).then((r) =>
        r.json(),
      )) as { id?: string; webSocketDebuggerUrl?: string };
      createdNewTab = true;
    }
    if (!target?.webSocketDebuggerUrl) {
      throw new Error('Failed to acquire CDP page target WebSocket URL.');
    }

    const pageCdp = new CdpConnection(target.webSocketDebuggerUrl);
    await pageCdp.connect();
    const session: PageSession = {
      send: <R = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, timeoutMs = 8000) =>
        pageCdp.send<R>(method, params, timeoutMs),
      on: (method: string, handler: CdpEventHandler) => pageCdp.on(method, handler),
    };

    try {
      const mobile = Boolean(sessionOpts.mobile);
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: mobile ? 390 : 1280,
        height: mobile ? 844 : 800,
        deviceScaleFactor: mobile ? 3 : 1,
        mobile,
      });
      if (mobile) {
        await session.send('Emulation.setTouchEmulationEnabled', { enabled: true }).catch(() => {});
      }
      if (sessionOpts.cpuThrottle && sessionOpts.cpuThrottle > 1) {
        await session.send('Emulation.setCPUThrottlingRate', { rate: sessionOpts.cpuThrottle });
      }
      return await fn(session);
    } finally {
      pageCdp.close();
      if (createdNewTab && target.id) {
        await fetch(`${httpBase}/json/close/${target.id}`).catch(() => {});
      }
    }
  };

  return { executablePath, withPageSession, close };
}
