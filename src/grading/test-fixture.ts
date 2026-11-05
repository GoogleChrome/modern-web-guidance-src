import { test as base, chromium, type Page, type Browser, type BrowserContext, type Request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import * as net from 'net';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';
import { Project } from 'ts-morph';
import { parse, CSSStyleSheet, CSSStyleDeclaration } from 'cssomnom';
import { checkBaseline } from '../core/baseline.ts';
import { extractTargetFilesFromPatch } from '../core/patch-utils.ts';
import { baseAppsDir, ensureDiskNodeCompileCache } from '../core/paths.ts';

export { expect } from '@playwright/test';

export function skipUnless(conditions: { unsupported: string }): void {
  const current = (process.env.BASELINE_TARGET || 'widely').trim().toLowerCase();
  if (conditions.unsupported) {
    const tokens = conditions.unsupported.split(',').map(s => s.trim()).filter(Boolean);
    const anyUnsupported = tokens.some(t => !checkBaseline(current, t));
    base.skip(!anyUnsupported, `Requires unsupported: ${conditions.unsupported} (current target: ${current})`);
  }
}

export interface PageLoadResult {
  ok: boolean;
  errors: string[];
  buildWarning?: string;
  noPage?: boolean;
}

export interface CheckPageLoadOptions {
  gotoTimeoutMs?: number;
  networkIdleTimeoutMs?: number;
}

export interface StartedTargetServer {
  hasPage: boolean;
  url?: string;
  error?: string;
  buildWarning?: string;
  stop: () => void;
}

export interface ExpectNeverOptions<Arg = undefined> {
  forMs: number;
  arg?: Arg;
  message?: string;
}

/**
 * Continually observes `predicate` in the page on every animation frame (or at
 * most every 16ms) for `forMs` milliseconds, failing immediately if `predicate`
 * ever evaluates to a truthy value.
 */
export async function expectNever<Arg = undefined>(
  page: Page,
  predicate: (arg: Arg) => unknown,
  options: ExpectNeverOptions<Arg>,
): Promise<void> {
  const { forMs, arg, message } = options;
  if (!Number.isFinite(forMs) || forMs <= 0) {
    throw new Error(`expectNever requires a positive finite forMs (got ${String(forMs)})`);
  }

  const start = performance.now();
  while (true) {
    const matched = Boolean(await page.evaluate<unknown, any>(predicate, arg));
    if (matched) {
      const elapsed = Math.round(performance.now() - start);
      const prefix = message ? `${message}: ` : '';
      throw new Error(
        `${prefix}expectNever failed: predicate became truthy after ${elapsed}ms (observation window: ${forMs}ms)`,
      );
    }

    const elapsed = performance.now() - start;
    const remaining = forMs - elapsed;
    if (remaining <= 0) {
      return;
    }

    await page.evaluate(
      (maxWaitMs) =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, maxWaitMs);
          requestAnimationFrame(() => {
            clearTimeout(timer);
            resolve();
          });
        }),
      Math.min(16, remaining),
    );
  }
}

export type ServerWorkerFixtures = {
  _targetServer: StartedTargetServer;
  TARGET_URL: string;
};

const ANALYTICS_BEACON_URL = 'https://us-central1-web-devrel-apps.cloudfunctions.net/times_cdn/api/analytics';

async function installHermeticRoutes(context: BrowserContext): Promise<void> {
  await context.route(ANALYTICS_BEACON_URL, (route) =>
    route.fulfill({
      status: 204,
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' },
    }));
}

function isBrowser(browserOrContext: Browser | BrowserContext): browserOrContext is Browser {
  return 'newContext' in browserOrContext;
}

const RESERVED_PLACEHOLDER_DOMAINS = ['example.com', 'example.net', 'example.org'];
const RESERVED_PLACEHOLDER_TLDS = ['.test', '.example', '.invalid'];

/**
 * Returns true if `hostname` is an RFC 2606 / RFC 6761 reserved placeholder domain
 * (`example.com`, `example.net`, `example.org` and their subdomains, or `.test`, `.example`, `.invalid` TLDs).
 */
export function isReservedPlaceholderHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return false;
  if (RESERVED_PLACEHOLDER_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
    return true;
  }
  if (host === 'test' || host === 'example' || host === 'invalid') {
    return true;
  }
  return RESERVED_PLACEHOLDER_TLDS.some((tld) => host.endsWith(tld));
}

function isIgnoredPlaceholderScriptFailure(urlStr: string, errorText: string): boolean {
  if (!errorText.includes('ERR_NAME_NOT_RESOLVED')) {
    return false;
  }
  try {
    const parsed = new URL(urlStr);
    return isReservedPlaceholderHost(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Loads `url` over HTTP in Chromium, waits for the `load` event plus bounded `networkidle`, and
 * records uncaught exceptions (`pageerror`) and failed script loads (`requestfailed` or HTTP
 * status >= 400 on `script` resources). `console.error` and warnings are intentionally ignored.
 */
export async function checkPageLoad(
  browserOrContext: Browser | BrowserContext,
  url: string,
  options: CheckPageLoadOptions = {},
): Promise<PageLoadResult> {
  const gotoTimeoutMs = options.gotoTimeoutMs ?? 15000;
  const networkIdleTimeoutMs = options.networkIdleTimeoutMs ?? 3000;
  const errors: string[] = [];
  const failedScriptRequests = new WeakSet<Request>();

  const ownsContext = isBrowser(browserOrContext);
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  const onPageError = (err: Error) => {
    errors.push(`[pageerror] ${err.stack || err.message || String(err)}`);
  };
  const onRequestFailed = (req: Request) => {
    if (req.resourceType() === 'script' && !failedScriptRequests.has(req)) {
      const failure = req.failure();
      const errorText = failure?.errorText || 'failed';
      if (isIgnoredPlaceholderScriptFailure(req.url(), errorText)) {
        return;
      }
      failedScriptRequests.add(req);
      errors.push(`[requestfailed] ${req.method()} ${req.url()}: ${errorText}`);
    }
  };
  const onResponse = (res: { status(): number; statusText(): string; url(): string; request(): Request }) => {
    const req = res.request();
    if (req.resourceType() === 'script' && res.status() >= 400 && !failedScriptRequests.has(req)) {
      failedScriptRequests.add(req);
      errors.push(`[response ${res.status()}] ${req.method()} ${res.url()} ${res.statusText()}`.trim());
    }
  };

  try {
    try {
      context = ownsContext ? await browserOrContext.newContext() : browserOrContext;
      if (ownsContext) {
        await installHermeticRoutes(context);
      }
      page = await context.newPage();
    } catch (err) {
      errors.push(`[browser] ${(err as Error).message || String(err)}`);
      return { ok: false, errors };
    }

    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);

    try {
      const response = await page.goto(url, { waitUntil: 'load', timeout: gotoTimeoutMs });
      if (response && response.status() >= 400) {
        errors.push(`[document ${response.status()}] GET ${url} ${response.statusText()}`.trim());
      }
      // Bounded networkidle wait so async module graphs and deferred scripts settle without fixed sleeps.
      await page.waitForLoadState('networkidle', { timeout: networkIdleTimeoutMs }).catch(() => {});
    } catch (err) {
      errors.push(`[navigation] ${(err as Error).message || String(err)}`);
    }
  } finally {
    if (page) {
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
      await page.close().catch(() => {});
    }
    if (ownsContext && context) {
      await context.close().catch(() => {});
    }
  }

  const uniqueErrors = Array.from(new Set(errors));
  return { ok: uniqueErrors.length === 0, errors: uniqueErrors };
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

const activeServerPids = new Set<number>();
let exitHandlersRegistered = false;

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

async function spawnAndWaitForTargetServer(
  targetDir: string,
  options: { exportTargetUrlEnv?: boolean } = {},
): Promise<{ url?: string; error?: string; stop: () => void }> {
  const noop = () => {};
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
        // Ignore if pid tracking file cannot be written
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
  const stop = () => {
    if (stopped) return;
    stopped = true;
    serverProcess.stderr?.destroy();
    if (serverPid) {
      activeServerPids.delete(serverPid);
      killServerProcessTree(serverPid);
    }
  };

  let isReady = false;
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
  for (let i = 0; i < 200; i++) {
    if (serverProcess.exitCode !== null) {
      break;
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        isReady = true;
        break;
      }
    } catch {
      // server not listening yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  if (!isReady) {
    stop();
    const detail = serverStderr.trim();
    return {
      error: `Server in ${targetDir} failed to start on port ${port}${detail ? `:\n${detail}` : ''}`,
      stop: noop,
    };
  }

  if (options.exportTargetUrlEnv) {
    process.env.TARGET_URL = url; // Exporting so legacy tests might use it if they read from process.env
  }
  return { url, stop };
}

/**
 * Builds (if `scripts.build` is defined) and starts the target app server in `targetDir`, returning
 * its entry URL and a `stop()` callback. If `scripts.build` fails, returns `error` and `buildWarning`
 * without starting the server so browser grader tests still fail on broken builds.
 */
export async function startTargetServer(
  targetDir: string,
  options: { exportTargetUrlEnv?: boolean } = { exportTargetUrlEnv: true },
): Promise<StartedTargetServer> {
  const exportTargetUrlEnv = options.exportTargetUrlEnv ?? true;
  const noop = () => {};
  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    if (process.env.TARGET_FILE) {
      const fallbackUrl = `http://localhost/${path.basename(process.env.TARGET_FILE)}`;
      if (exportTargetUrlEnv) {
        process.env.TARGET_URL = fallbackUrl;
      }
      return { hasPage: false, url: fallbackUrl, stop: noop };
    }
    return { hasPage: false, error: `package.json not found in target directory: ${targetDir}`, stop: noop };
  }

  let pkgJson: {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  } catch (err) {
    return { hasPage: true, error: `Failed to parse package.json in ${targetDir}: ${(err as Error).message}`, stop: noop };
  }

  if (!pkgJson.scripts || !pkgJson.scripts.start) {
    return { hasPage: false, error: `package.json in ${targetDir} is missing a "start" script.`, stop: noop };
  }

  const hasDependencies =
    Boolean(pkgJson.dependencies && Object.keys(pkgJson.dependencies).length > 0) ||
    Boolean(pkgJson.devDependencies && Object.keys(pkgJson.devDependencies).length > 0);

  const nodeCompileCache = ensureDiskNodeCompileCache(process.env, 'harness');
  const childEnv = { ...process.env, NODE_COMPILE_CACHE: nodeCompileCache };

  // Keep pnpm install when a target has dependencies: correct grading of apps that need their
  // dependencies matters more than matching the old arm.
  if (pkgJson.scripts.build || hasDependencies) {
    console.log(`[TEST-FIXTURE] Running pnpm install in ${targetDir}`);
    // Write a standalone pnpm-workspace.yaml that approves only the canonical base app's
    // onlyBuiltDependencies (never agent-added dependency build scripts) and anchors the
    // workspace root at targetDir without needing --ignore-workspace (which in pnpm 12 ignores allowBuilds).
    const allowedBuilds = getBaseAppAllowedBuilds(pkgJson.name);
    writeScopedPnpmWorkspace(targetDir, allowedBuilds);

    const installResult = spawnSync('pnpm', ['install', '--no-frozen-lockfile', '--prefer-offline'], {
      cwd: targetDir,
      env: childEnv,
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (installResult.status !== 0) {
      const output = [installResult.stdout, installResult.stderr].filter(Boolean).join('\n').trim();
      console.warn(`[TEST-FIXTURE] pnpm install failed in ${targetDir}${output ? `:\n${output}` : ''}`);
    }
  }

  if (pkgJson.scripts.build) {
    const buildResult = spawnSync('pnpm', ['--ignore-workspace', 'run', 'build'], {
      cwd: targetDir,
      env: childEnv,
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (buildResult.status !== 0) {
      const output = [buildResult.stdout, buildResult.stderr].filter(Boolean).join('\n').trim();
      const buildError = `Failed to build target app in ${targetDir}${output ? `:\n${output}` : ''}`;
      return {
        hasPage: true,
        error: buildError,
        buildWarning: buildError,
        stop: noop,
      };
    }
  }

  const started = await spawnAndWaitForTargetServer(targetDir, { exportTargetUrlEnv });
  if (started.error || !started.url) {
    return {
      hasPage: true,
      error: started.error,
      stop: noop,
    };
  }
  return {
    hasPage: true,
    url: started.url,
    stop: started.stop,
  };
}

/**
 * Diagnostic-only helper for the page-load check when `scripts.build` failed: attempts `pnpm run start`
 * and loads the page in an isolated server that is stopped immediately afterwards and never exposed to
 * the grader's `TARGET_URL` or `process.env.TARGET_URL`.
 */
async function diagnosePageLoadAfterBuildFailure(
  targetDir: string,
  buildWarning: string,
  browser: Browser,
): Promise<PageLoadResult> {
  const diagSrv = await spawnAndWaitForTargetServer(targetDir, { exportTargetUrlEnv: false });
  try {
    if (diagSrv.error || !diagSrv.url) {
      return {
        ok: false,
        errors: [`[server] ${buildWarning}\n${diagSrv.error || 'Target server failed to start'}`],
        buildWarning,
      };
    }
    const checkResult = await checkPageLoad(browser, diagSrv.url);
    return {
      ...checkResult,
      buildWarning,
    };
  } finally {
    diagSrv.stop();
  }
}

/**
 * Standalone helper to run the page-load check against a target directory when Playwright did not
 * invoke the worker fixture (or when probing a target directly without running its grader).
 */
export async function checkTargetPageLoad(
  targetDir: string,
  existingBrowser?: Browser,
): Promise<PageLoadResult | undefined> {
  let srv: StartedTargetServer;
  try {
    srv = await startTargetServer(targetDir, { exportTargetUrlEnv: false });
  } catch (err) {
    return { ok: false, errors: [`[server] ${(err as Error).message || String(err)}`] };
  }
  if (!srv.hasPage) {
    srv.stop();
    return undefined;
  }

  const ownsBrowser = !existingBrowser;
  let browser: Browser | undefined = existingBrowser;
  try {
    if (srv.buildWarning) {
      if (!browser) {
        browser = await chromium.launch();
      }
      return await diagnosePageLoadAfterBuildFailure(targetDir, srv.buildWarning, browser);
    }
    if (srv.error || !srv.url) {
      return {
        ok: false,
        errors: [`[server] ${srv.error || 'Target server failed to start'}`],
      };
    }
    if (!browser) {
      browser = await chromium.launch();
    }
    return await checkPageLoad(browser, srv.url);
  } catch (err) {
    return {
      ok: false,
      errors: [`[browser] ${(err as Error).message || String(err)}`],
      ...(srv.buildWarning ? { buildWarning: srv.buildWarning } : {}),
    };
  } finally {
    if (ownsBrowser && browser) {
      await browser.close().catch(() => {});
    }
    srv.stop();
  }
}

export const test = base.extend<{ page: Page; context: BrowserContext }, ServerWorkerFixtures>({
  // devtools-times loads a live analytics beacon (intentionally janky; it's a DevTools demo, and some
  // graders inspect its <script>). It POSTs to a Cloud Function whose CORS allowlist excludes localhost,
  // so every browser test logged a CORS error + failed request. Answer it locally so grading stays
  // hermetic and console/network errors only show real problems. The script itself still loads and runs.
  context: async ({ context }, use) => {
    await installHermeticRoutes(context);
    await use(context);
  },

  page: async ({ page }, use, testInfo) => {
    const diagnostics: string[] = [];

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        const loc = msg.location();
        const locSuffix = loc.url ? ` (${loc.url}:${loc.lineNumber})` : '';
        diagnostics.push(`[console.${type}] ${msg.text()}${locSuffix}`);
      }
    });

    page.on('pageerror', (err) => {
      diagnostics.push(`[pageerror] ${err.stack || err.message || String(err)}`);
    });

    page.on('requestfailed', (req) => {
      const failure = req.failure();
      diagnostics.push(`[requestfailed] ${req.method()} ${req.url()}: ${failure?.errorText || 'failed'}`);
    });

    page.on('response', (res) => {
      if (res.status() >= 400) {
        diagnostics.push(`[response ${res.status()}] ${res.request().method()} ${res.url()} ${res.statusText()}`);
      }
    });

    try {
      await use(page);
    } finally {
      const failed = (testInfo.status !== 'passed' && testInfo.status !== 'skipped') || testInfo.errors.length > 0;
      if (failed) {
        if (diagnostics.length > 0) {
          await testInfo.attach('browser-errors', {
            body: diagnostics.join('\n'),
            contentType: 'text/plain',
          });
        }
        if (!page.isClosed()) {
          // A crashed or hung page can't be snapshotted. Record why rather than failing fixture teardown.
          const body = await page.locator('body').ariaSnapshot({ timeout: 2000 })
            .catch((err: Error) => `(page snapshot unavailable: ${err.message})`);
          await testInfo.attach('page-snapshot', { body, contentType: 'text/plain' });
        }
      }
    }
  },

  // eslint-disable-next-line no-empty-pattern
  _targetServer: [async ({}, use) => {
    let srv: StartedTargetServer;
    try {
      srv = await startTargetServer(process.cwd());
    } catch (err) {
      srv = {
        hasPage: true,
        error: (err as Error).message || String(err),
        stop: () => {},
      };
    }
    try {
      await use(srv);
    } finally {
      srv.stop();
    }
  }, { scope: 'worker', timeout: 60000 }],

  TARGET_URL: [async ({ _targetServer }, use) => {
    if (_targetServer.error || !_targetServer.url) {
      throw new Error(_targetServer.error || `Server failed to start in ${process.cwd()}`);
    }
    await use(_targetServer.url);
  }, { scope: 'worker', timeout: 60000 }],
});

const BASE_APP_DEFAULT_FILES: Record<string, string[]> = {
  'daily-grind': ['index.html'],
  'devtools-times': [
    'src/components/ArticleTeaser.astro',
    'src/layouts/Layout.astro',
    'src/styles/global.css',
    'src/components/SearchFlyout.tsx',
    'src/components/ReadingListFlyout.tsx',
  ],
};

export function getTargetFiles(testFileUrl: string): string[] {
  const patchFile = process.env.PATCH_FILE;
  const rootDir = process.cwd();
  const baseAppName = path.basename(path.dirname(fileURLToPath(testFileUrl)));
  const patchTargetFiles = patchFile ? extractTargetFilesFromPatch(patchFile) : [];
  const defaultFiles = BASE_APP_DEFAULT_FILES[baseAppName] || [];
  const targetFiles = Array.from(new Set([...patchTargetFiles, ...defaultFiles]));
  return targetFiles.map((f: string) => path.resolve(rootDir, f));
}

const HTML_EXTS = /\.(html|htm|astro)$/i;
const CSS_EXTS = /\.css$/i;
const JS_EXTS = /\.(m?js|cjs|ts|tsx|jsx)$/i;
const TEST_FILE_EXTS = /\.(test|spec)\.(m?js|cjs|ts|tsx|jsx)$/i;

// Matches (1) comments and raw-text/RCDATA elements, which are passed through untouched, or
// (2) `<?...>` processing-instruction-like markup, captured for rewriting.
const PI_SCAN = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>|<\?([^>]*)>/gi;

/**
 * Browsers' HTML parsers turn `<?...>` into bogus comments (Comment nodes whose data starts
 * with `?`), but linkedom drops them entirely. Rewrite them as real comments so graders can
 * find markers such as `<?start name="x">`, `<?end>`, and `<?marker name="x">` via the DOM.
 */
function processingInstructionsToComments(content: string): string {
  if (!content.includes('<?')) return content;
  return content.replace(PI_SCAN, (match, _rawTextTag: string | undefined, pi: string | undefined) =>
    pi === undefined ? match : `<!--?${pi}-->`
  );
}

function parseHtmlDocument(file: string, content: string): any {
  const normalized = file.endsWith('.astro')
    ? content
        .replace(/^---[\r\n]+[\s\S]*?[\r\n]+---/, '')
        .replace(/\b(class(?::list)?)=\{((?:[^{}]|\{[^{}]*\})+)\}/g, (_, attr: string, expr: string) => {
          const clean = expr.replace(/\$\{[^{}]*\}/g, ' ');
          const classes = Array.from(clean.matchAll(/['"`]([a-zA-Z0-9_\s-]+)['"`]/g), (m) => m[1].trim()).join(' ');
          return `${attr}="${classes}"`;
        })
    : content;
  const { document } = parseHTML(processingInstructionsToComments(normalized));
  document.querySelectorAll('[class\\:list]').forEach((el: any) => {
    el.classList.add(...el.getAttribute('class:list').split(/\s+/).filter(Boolean));
  });
  return document;
}

function unwrapGlobalPseudo(css: string): string {
  let result = css;
  const token = ':global(';
  let idx = result.indexOf(token);
  while (idx !== -1) {
    let depth = 1;
    let i = idx + token.length;
    while (i < result.length && depth > 0) {
      if (result[i] === '(') depth++;
      else if (result[i] === ')') depth--;
      i++;
    }
    if (depth === 0) {
      const inner = result.slice(idx + token.length, i - 1);
      result = result.slice(0, idx) + inner + result.slice(i);
      idx = result.indexOf(token, idx + inner.length);
    } else {
      break;
    }
  }
  return result;
}

/**
 * Parses all CSS across standalone stylesheets (.css), HTML/Astro <style> tags,
 * and inline styles into a CSSOMNom CSSStyleSheet object.
 */
export function getCssStyleSheet(files: string[]): CSSStyleSheet {
  const cssBlocks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (CSS_EXTS.test(file)) {
      cssBlocks.push(content);
    } else if (HTML_EXTS.test(file)) {
      // Exclude <template> elements to avoid extracting inert component template styles as global page styles
      const withoutTemplates = content.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
      try {
        const document = parseHtmlDocument(file, content);
        document.querySelectorAll('template').forEach((el: any) => el.remove());
        document.querySelectorAll('style').forEach((style: any) => {
          if (style.textContent) cssBlocks.push(style.textContent);
        });
        document.querySelectorAll('[style]').forEach((el: any) => {
          const inlineStyle = el.getAttribute('style')?.trim();
          if (!inlineStyle) return;
          // Parse through CSSStyleDeclaration so unparsed JSX expressions (e.g. `{expr}`) yield
          // no declarations and are skipped, and valid ones serialize with balanced braces/strings.
          const decl = new CSSStyleDeclaration();
          decl.cssText = inlineStyle;
          if (decl.length > 0) {
            cssBlocks.push(`[style] { ${decl.cssText} }`);
          }
        });
        // Also extract <style> blocks from <script> tags (e.g. shadowRoot.innerHTML in web components)
        document.querySelectorAll('script').forEach((script: any) => {
          const scriptText = script.textContent || '';
          const styleMatches = scriptText.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
          if (styleMatches) {
            for (const match of styleMatches) {
              cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
            }
          }
        });
      } catch {
        const styleMatches = withoutTemplates.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatches) {
          for (const match of styleMatches) {
            cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
          }
        }
      }
    } else if (JS_EXTS.test(file)) {
      const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) {
        for (const match of styleMatches) {
          cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
        }
      }
    }
  }
  // Parse each block in isolation so CSS EOF error recovery closes any unterminated
  // block, string, url(, or comment at its own boundary instead of swallowing later blocks.
  const isolatedRules = cssBlocks.flatMap((block) =>
    Array.from(parse(unwrapGlobalPseudo(block)).cssRules, (rule) => rule.cssText)
  );
  return parse(isolatedRules.join('\n'));
}

export function populateJsProject(project: Project, files: string[]): void {
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    if (TEST_FILE_EXTS.test(file)) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (JS_EXTS.test(file) && !HTML_EXTS.test(file)) {
      project.createSourceFile(file, content, { overwrite: true });
    } else if (HTML_EXTS.test(file)) {
      try {
        if (file.endsWith('.astro')) {
          const frontmatter = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
          if (frontmatter && frontmatter[1]) {
            project.createSourceFile(`${file}_frontmatter.ts`, frontmatter[1], { overwrite: true });
          }
        }
        const document = parseHtmlDocument(file, content);
        document.querySelectorAll('script').forEach((script: any, idx: number) => {
          if (script.textContent) {
            project.createSourceFile(`${file}_script_${idx}.ts`, script.textContent, { overwrite: true });
          }
        });
      } catch {
        // Fallback for non-standard HTML fragments
      }
    }
  }
}

export function getJsProject(files: string[]): Project {
  const project = new Project({ useInMemoryFileSystem: true });
  populateJsProject(project, files);
  return project;
}

export function getHtmlDocuments(files: string[]): Array<{ file: string; document: any }> {
  const docs: Array<{ file: string; document: any }> = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    if (HTML_EXTS.test(file)) {
      const content = fs.readFileSync(file, 'utf8');
      docs.push({ file, document: parseHtmlDocument(file, content) });
    }
  }
  return docs;
}
