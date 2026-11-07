import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSuite, writeManifest } from '../harness/public/builder.ts';
import { LocalSuiteStore } from '../harness/public/suite-store.ts';
import { FIXTURE_MODEL, FIXTURE_SUITE, makeFixtureStore } from '../harness/public/fixtures/make-store.ts';

/**
 * The public, unauthenticated view must render entirely from `public-evals/`
 * and never contact the private bucket. These tests build a real public copy
 * with the harness builder, serve it to the page, and fail on any request to a
 * Google storage or console host, including from popups.
 */

const SUITE = FIXTURE_SUITE;
const GOOGLE_HOSTS = /https:\/\/[^/]*(googleapis\.com|cloud\.google\.com|accounts\.google\.com)\//;
/**
 * Every page carries a `<script src="https://accounts.google.com/gsi/client">` tag, so that one
 * request is expected on every load and is not counted against the zero-Google-host assertions.
 * It is still aborted, and `stubGoogleSignIn` stands in for the library it would have loaded.
 */
const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

/** @type {string} */
let publicDir;
/** @type {string} */
let rawEvalsJson;

test.beforeAll(async () => {
  const { root, baseApps } = makeFixtureStore();
  rawEvalsJson = fs.readFileSync(path.join(root, SUITE, 'evals.json'), 'utf8');

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-view-out-'));
  const result = await buildSuite(SUITE, {
    store: new LocalSuiteStore(root),
    outDir,
    baseAppsDir: baseApps,
    allowlist: { include: ['nightly-*'], exclude: [], overrides: [], releasedModels: [FIXTURE_MODEL] },
  });
  if (result.status !== 'built') throw new Error(`fixture build failed: ${result.reason}`);
  writeManifest(outDir, [result]);
  publicDir = path.join(outDir, 'public-evals');
});

/** The token the stubbed Google Identity Services client hands out when Sign in is clicked. */
const FRESH_TOKEN = 'fresh-token';

/**
 * Replaces the Google Identity Services client so the Sign in / Sign out button renders
 * without loading the real script (which `GOOGLE_HOSTS` blocks). Clicking Sign in
 * completes immediately with `FRESH_TOKEN` instead of opening a popup.
 * @param {import('@playwright/test').Page} page
 */
async function stubGoogleSignIn(page) {
  await page.context().addInitScript(token => {
    /** @type {any} */ (window).google = {
      accounts: {
        oauth2: {
          initTokenClient: (/** @type {{ callback: (response: { access_token: string }) => void }} */ config) => ({
            requestAccessToken() { config.callback({ access_token: token }); },
          }),
        },
      },
    };
  }, FRESH_TOKEN);
}

/**
 * Serves `public-evals/**` from the built fixture, blocks every Google host at the
 * context level (so popups are covered too), and records what tried to get through.
 * @param {import('@playwright/test').Page} page
 * @param {{ token?: string, manageToken?: boolean }} [options] `manageToken: false` leaves
 *   localStorage alone so a test can set and clear the token itself.
 * @returns {Promise<{ googleRequests: string[], popupOrigins: string[] }>}
 */
async function servePublicCopy(page, options = {}) {
  /** @type {string[]} */
  const googleRequests = [];
  /** @type {string[]} */
  const popupOrigins = [];
  if (options.manageToken !== false) {
    await page.context().addInitScript(t => {
      if (t) localStorage.setItem('gcs_access_token', t);
      else localStorage.removeItem('gcs_access_token');
    }, options.token ?? '');
  }
  await stubGoogleSignIn(page);
  await page.context().route(GOOGLE_HOSTS, route => {
    if (route.request().url() !== GSI_SCRIPT) googleRequests.push(route.request().url());
    return route.abort();
  });
  await page.context().route('**/public-evals/**', route => {
    const url = new URL(route.request().url());
    const rel = url.pathname.replace(/^.*\/public-evals\//, '');
    const file = path.join(publicDir, rel);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ path: file, contentType: rel.endsWith('.json') ? 'application/json' : 'text/plain' });
  });
  page.context().on('page', popup => popupOrigins.push(new URL(popup.url()).origin));
  return { googleRequests, popupOrigins };
}

/**
 * Serves the dev server's pages under a fake non-localhost origin so `resolveDataSource()`
 * behaves as it does on GitHub Pages instead of picking 'local'.
 * @param {import('@playwright/test').Page} page
 * @param {string} [basePath=''] Project-site prefix such as `/repo`, as on `user.github.io/repo/`.
 * @returns {Promise<string>} the fake origin
 */
async function serveAsGitHubPages(page, basePath = '') {
  const origin = 'https://example.github.io';
  const devServer = test.info().project.use.baseURL ?? 'http://localhost:11432';
  await page.context().route(`${origin}${basePath}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith(`${basePath}/public-evals/`)) return route.fallback(); // served from the built fixture
    const response = await route.fetch({ url: devServer + url.pathname.slice(basePath.length) + url.search });
    return route.fulfill({ response });
  });
  return origin;
}

/**
 * Routes the private bucket to the raw fixture so signed-in mode can be exercised offline.
 * Registered after `servePublicCopy`, so it takes precedence over the `GOOGLE_HOSTS` block
 * for the bucket only; every other Google host stays blocked.
 * @param {import('@playwright/test').Page} page
 * @param {{ status?: number }} [options] Reject every bucket request with this status instead.
 * @returns {Promise<string[]>} Authorization header of every bucket request
 */
async function mockPrivateBucket(page, options = {}) {
  /** @type {string[]} */
  const authHeaders = [];
  await page.context().route(/storage\.googleapis\.com/, route => {
    if (options.status) {
      authHeaders.push(route.request().headers()['authorization'] ?? '');
      return route.fulfill({ status: options.status, body: 'unauthorized' });
    }
    const url = new URL(route.request().url());
    authHeaders.push(route.request().headers()['authorization'] ?? '');
    const object = decodeURIComponent(url.pathname.replace(/^.*\/o\//, ''));
    if (object === 'suites.gen.json') {
      const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'suites.gen.json'), 'utf8'));
      return route.fulfill({ json: manifest });
    }
    if (object === `${SUITE}/evals.json`) {
      return route.fulfill({ body: rawEvalsJson, contentType: 'application/json' });
    }
    if (url.pathname.endsWith('/o') || url.pathname.endsWith('/o/')) {
      return route.fulfill({ json: { items: [] } });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });
  return authHeaders;
}

test.describe('Public view', () => {
  test('landing lists published suites without touching Google hosts', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    await page.goto('/?source=public');

    const row = page.locator('.suite-table-row', { hasText: 'codex' }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('.source-cell')).toHaveText('public');
    await expect(row.locator('a.suite-link')).toHaveAttribute('href', /source=public/);
    await expect(page.locator('.suite-table-row', { hasText: 'example-result' })).toHaveCount(0);
    await expect(page.locator('#auth-btn')).toHaveText(/Sign in/);
    expect(googleRequests).toEqual([]);
  });

  test('suite page renders, and Diff and Log open from public-evals only', async ({ page }) => {
    const { googleRequests, popupOrigins } = await servePublicCopy(page);
    await page.goto(`/dashboard.html?testId=${SUITE}&source=public`);

    await expect(page.locator('#test-header')).toContainText(SUITE);
    await expect(page.locator('#test-header')).not.toContainText('Serving Mode');
    const security = page.locator('.task-accordion[data-guide="security"]').first();
    await security.locator('.task-toggle').click();
    await expect(security.locator('.tfoot-action-btn').first()).toBeVisible();

    await security.locator('.tfoot-action-btn', { hasText: 'Diff' }).first().click();
    await expect(page.locator('#modal')).toBeVisible();
    await expect(page.locator('#modal')).toContainText('a/src/app.ts');
    await page.keyboard.press('Escape');

    await security.locator('.tfoot-action-btn', { hasText: 'Log' }).first().click();
    await expect(page.locator('#modal')).toContainText('GET /guides/security');
    await page.keyboard.press('Escape');

    // Only the artifacts the builder publishes get a button; nothing that would 404 or need the bucket.
    const buttonLabels = await security.locator('.tfoot-action-btn').allInnerTexts();
    const labelSet = new Set(buttonLabels.map(label => label.trim()));
    expect(labelSet).toEqual(new Set(['Diff', 'Log']));
    await expect(page.locator('#view-gcs-artifacts-btn')).toBeHidden();
    await expect(page.locator('#view-log-btn')).toBeHidden();

    expect(googleRequests).toEqual([]);
    expect(popupOrigins).toEqual([]);
  });

  test('suite page shows the recorded task prompt without fetching task files', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    /** @type {string[]} */
    const promptSourceRequests = [];
    page.on('request', request => {
      if (/\/tasks\/|run\.mjs/.test(request.url())) promptSourceRequests.push(request.url());
    });
    await page.goto(`/dashboard.html?testId=${SUITE}&source=public`);

    const security = page.locator('.task-accordion[data-guide="security"]').first();
    await security.locator('.task-toggle').click();
    await expect(security.locator('.task-prompt-text')).toContainText('Audit the Daily Grind web app');
    await expect(security.locator('.task-prompt-meta-value')).toHaveText('daily-grind');
    expect(promptSourceRequests).toEqual([]);
    expect(googleRequests).toEqual([]);
  });

  test('public evals.json uses the same 10-minute cache bucket as the manifest', async ({ page }) => {
    await servePublicCopy(page);
    /** @type {string[]} */
    const busters = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (/\/public-evals\/.*\.json$/.test(url.pathname)) busters.push(url.searchParams.get('t') ?? '');
    });
    await page.goto(`/dashboard.html?testId=${SUITE}&source=public`);
    await expect(page.locator('#test-header')).toContainText(SUITE);

    expect(busters.length).toBeGreaterThan(0);
    for (const t of busters) {
      expect(Math.abs(Number(t) - Math.floor(Date.now() / 600_000))).toBeLessThanOrEqual(1);
    }
  });

  test('a 404 from public-evals shows an error that names no bucket', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    await page.goto('/dashboard.html?testId=nightly-does-not-exist&source=public');

    const body = page.locator('body');
    await expect(body).toContainText('Error loading dashboard data');
    await expect(body).not.toContainText('guidance-evals');
    expect(googleRequests).toEqual([]);
  });

  test('?source=public wins over a stale token', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { token: 'stale-token' });
    await page.goto('/?source=public');

    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toBeVisible();
    expect(googleRequests).toEqual([]);
  });

  test('?source=remote without a token reads the public copy, not the bucket', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    await page.goto('/?source=remote');

    const row = page.locator('.suite-table-row', { hasText: 'codex' }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('.source-cell')).toHaveText('public');
    expect(googleRequests).toEqual([]);
  });

  test('with no token off the dev server, the public copy loads without ?source=', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/`);
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toBeVisible();
    await expect(page.locator('#hero-auth-btn')).toBeHidden();
    expect(googleRequests).toEqual([]);
  });

  test('guide page renders the public manifest without touching Google hosts', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    await page.goto('/guide.html?guide=security&source=public');

    await expect(page.locator('#guide-name-header')).toHaveText('security');
    await expect(page.locator('.timeline-point').first()).toBeVisible();
    expect(googleRequests).toEqual([]);
  });

  test('guide Prev / Next navigation keeps ?source=public', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    await page.goto('/guide.html?guide=security&source=public');
    await expect(page.locator('#guide-name-header')).toHaveText('security');

    await page.locator('#next-guide-btn').click();
    await page.waitForURL(url => url.pathname.endsWith('/guide.html') && url.searchParams.get('guide') !== 'security');
    expect(new URL(page.url()).searchParams.get('source')).toBe('public');
    await expect(page.locator('.timeline-point').first()).toBeVisible();
    expect(googleRequests).toEqual([]);
  });

  test('a capped agent.patch placeholder is shown as text, not as an empty diff', async ({ page }) => {
    await servePublicCopy(page);
    const placeholder = '# diff omitted: 1.5 MB exceeds the 1 MB cap\n';
    // Registered after servePublicCopy so it wins for this one artifact.
    await page.context().route('**/public-evals/**/agent.patch', route => route.fulfill({ body: placeholder, contentType: 'text/plain' }));
    await page.goto(`/dashboard.html?testId=${SUITE}&source=public`);

    const security = page.locator('.task-accordion[data-guide="security"]').first();
    await security.locator('.task-toggle').click();
    await security.locator('.tfoot-action-btn', { hasText: 'Diff' }).first().click();
    await expect(page.locator('#modal')).toContainText('# diff omitted: 1.5 MB exceeds the 1 MB cap');
    await expect(page.locator('#modal .diff-file-details')).toHaveCount(0);
    await expect(page.locator('#modal')).not.toContainText('diff --git');
  });

  test('a missing public manifest is not an error', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    // Registered after servePublicCopy so it takes precedence over the fixture for every public-evals file.
    await page.context().route('**/public-evals/**', route => route.fulfill({ status: 404, body: '' }));
    /** @type {string[]} */
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/?source=public');
    await expect(page.locator('.suites-empty-row')).toBeVisible();
    await expect(page.locator('.suite-table-row')).toHaveCount(0);
    await expect(page.locator('#hero-status-text')).toHaveText('No published results yet. Googlers can sign in to see internal runs.');
    await expect(page.locator('#hero-auth-btn')).toBeVisible();
    expect(errors.filter(e => e.includes('public suites'))).toEqual([]);
    expect(googleRequests).toEqual([]);
  });

  test('Sign in from the public view reloads the page from the bucket', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { manageToken: false });
    const authHeaders = await mockPrivateBucket(page);
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/?source=public`);
    const row = () => page.locator('.suite-table-row', { hasText: 'codex' }).first();
    await expect(row().locator('.source-cell')).toHaveText('public');
    expect(authHeaders).toEqual([]);

    await page.locator('#auth-btn').click();
    await page.waitForURL(url => url.origin === origin && url.pathname === '/' && url.search === '');
    await expect(page.locator('#auth-btn')).toHaveText('Sign out');
    await expect(row().locator('.source-cell')).toHaveText('remote');
    await expect(page.locator('.suite-table-row', { hasText: 'codex' })).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('gcs_access_token'))).toBe(FRESH_TOKEN);
    expect(authHeaders).toContain(`Bearer ${FRESH_TOKEN}`);
    expect(googleRequests).toEqual([]);
  });
});

test.describe('Signed-in view', () => {
  test('still reads the private bucket with a bearer token and renders', async ({ page }) => {
    await servePublicCopy(page, { token: 'googler-token' });
    const authHeaders = await mockPrivateBucket(page);

    await page.goto(`/dashboard.html?testId=${SUITE}&source=remote`);
    await expect(page.locator('#test-header')).toContainText(SUITE);
    await expect(page.locator('.task-accordion').first()).toBeVisible();
    await expect(page.locator('#auth-btn')).toHaveText('Sign out');

    expect(authHeaders.length).toBeGreaterThan(0);
    expect(authHeaders.every(h => h === 'Bearer googler-token')).toBe(true);
  });

  test('on the dev server, a rejected token does not mix the public copy into the local view', async ({ page }) => {
    await servePublicCopy(page, { token: 'expired-token' });
    await mockPrivateBucket(page, { status: 403 });
    /** @type {string[]} */
    const publicRequests = [];
    page.on('request', request => { if (request.url().includes('/public-evals/')) publicRequests.push(request.url()); });

    // No ?source=, on localhost: local mode, with the bucket merged in for a signed-in user.
    await page.goto('/');
    await expect(page.locator('.suite-table-row', { hasText: 'example-result' }).first()).toBeVisible();
    await expect(page.locator('.suite-table-row', { hasText: 'codex' })).toHaveCount(0);
    expect(publicRequests).toEqual([]);
  });

  test('Sign out forgets the token and returns to the public view', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { manageToken: false });
    await mockPrivateBucket(page);
    const origin = await serveAsGitHubPages(page);

    // Seed the token once (not via an init script, which would re-add it after sign-out navigates).
    await page.goto(`${origin}/?source=public`);
    await page.evaluate(() => localStorage.setItem('gcs_access_token', 'googler-token'));
    await page.goto(`${origin}/`);
    const authBtn = page.locator('#auth-btn');
    await expect(authBtn).toHaveText('Sign out');
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('.source-cell')).toHaveText('remote');

    await authBtn.click();
    await page.waitForURL(url => url.origin === origin && url.pathname === '/' && url.search === '');
    expect(await page.evaluate(() => localStorage.getItem('gcs_access_token'))).toBeNull();
    await expect(page.locator('#auth-btn')).toHaveText(/Sign in/);
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('.source-cell')).toHaveText('public');
    expect(googleRequests).toEqual([]);
  });

  test('Sign out from a suite page lands on the public landing page', async ({ page }) => {
    await servePublicCopy(page, { manageToken: false });
    await mockPrivateBucket(page);
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/?source=public`);
    await page.evaluate(() => localStorage.setItem('gcs_access_token', 'googler-token'));
    await page.goto(`${origin}/dashboard.html?testId=${SUITE}`);
    await expect(page.locator('#test-header')).toContainText(SUITE);
    await expect(page.locator('#view-gcs-artifacts-btn')).toBeVisible();

    // A private suite may not exist in the public copy, so reloading in place would error.
    await page.locator('#auth-btn').click();
    await page.waitForURL(url => url.origin === origin && url.pathname === '/' && url.search === '');
    expect(await page.evaluate(() => localStorage.getItem('gcs_access_token'))).toBeNull();
    await expect(page.locator('#auth-btn')).toHaveText(/Sign in/);
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('.source-cell')).toHaveText('public');
  });

  test('on a project site under /repo/, links, Sign out, and public-evals stay under /repo/', async ({ page }) => {
    await servePublicCopy(page, { manageToken: false });
    await mockPrivateBucket(page);
    const origin = await serveAsGitHubPages(page, '/repo');
    /** @type {string[]} */
    const publicPaths = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === origin && url.pathname.includes('public-evals/')) publicPaths.push(url.pathname);
    });

    await page.goto(`${origin}/repo/?source=public`);
    await page.evaluate(() => localStorage.setItem('gcs_access_token', 'googler-token'));
    await page.goto(`${origin}/repo/`);
    await page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('a.suite-link').click();
    await expect(page.locator('#test-header')).toContainText(SUITE);
    expect(new URL(page.url()).pathname).toBe('/repo/dashboard.html');

    await page.locator('#auth-btn').click();
    await page.waitForURL(url => url.origin === origin && url.pathname === '/repo/' && url.search === '');
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('.source-cell')).toHaveText('public');
    expect(publicPaths.length).toBeGreaterThan(0);
    expect(publicPaths.every(p => p.startsWith('/repo/public-evals/'))).toBe(true);
  });

  test('a token the bucket rejects is cleared and the landing falls back to the public copy', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { token: 'expired-token' });
    const authHeaders = await mockPrivateBucket(page, { status: 401 });
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/`);
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('.source-cell')).toHaveText('public');
    await expect(page.locator('#auth-btn')).toHaveText(/Sign in/);
    expect(authHeaders).toContain('Bearer expired-token');
    expect(await page.evaluate(() => localStorage.getItem('gcs_access_token'))).toBeNull();
    expect(googleRequests).toEqual([]);
  });

  test('a 403 from the bucket falls back to the public copy but keeps the token', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { token: 'outsider-token' });
    const authHeaders = await mockPrivateBucket(page, { status: 403 });
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/`);
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('.source-cell')).toHaveText('public');
    await expect(page.locator('#auth-btn')).toHaveText('Sign out');
    expect(authHeaders).toContain('Bearer outsider-token');
    expect(await page.evaluate(() => localStorage.getItem('gcs_access_token'))).toBe('outsider-token');
    expect(googleRequests).toEqual([]);
  });

  test('after a 403 fallback, breakdown guide links carry source=public so the guide page does not bounce', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { token: 'outsider-token' });
    await mockPrivateBucket(page, { status: 403 });
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/`);
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('.source-cell')).toHaveText('public');

    const drawer = page.locator('#breakdowns');
    await drawer.locator('summary').click();
    const guideLink = page.locator('a.pivot-link', { hasText: 'security' }).first();
    await expect(guideLink).toHaveAttribute('href', /source=public/);

    await guideLink.click();
    await page.waitForURL(url => url.pathname === '/guide.html');
    await expect(page.locator('#guide-name-header')).toHaveText('security');
    await expect(page.locator('.timeline-point').first()).toBeVisible();
    expect(new URL(page.url()).searchParams.get('source')).toBe('public');
    expect(googleRequests).toEqual([]);
  });

  test('a 403 fallback onto an empty public copy shows public-empty status without a Sign in CTA', async ({ page }) => {
    await servePublicCopy(page, { token: 'outsider-token' });
    await page.context().route('**/public-evals/**', route => route.fulfill({ status: 404, body: '' }));
    await mockPrivateBucket(page, { status: 403 });
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/`);
    await expect(page.locator('#hero-status-text')).toHaveText('No published results yet. Googlers can sign in to see internal runs.');
    await expect(page.locator('#hero-auth-btn')).toBeHidden();
    await expect(page.locator('#auth-btn')).toHaveText('Sign out');
  });

  test('a 403 on a suite page returns to the public landing page and keeps the token', async ({ page }) => {
    await servePublicCopy(page, { manageToken: false });
    await mockPrivateBucket(page, { status: 403 });
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/?source=public`);
    await page.evaluate(() => localStorage.setItem('gcs_access_token', 'outsider-token'));
    await page.goto(`${origin}/dashboard.html?testId=${SUITE}`);
    await page.waitForURL(url => url.origin === origin && url.pathname === '/' && url.search === '');
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first().locator('.source-cell')).toHaveText('public');
    await expect(page.locator('#auth-btn')).toHaveText('Sign out');
    expect(await page.evaluate(() => localStorage.getItem('gcs_access_token'))).toBe('outsider-token');
  });

  test('remote manifest keeps its cache-buster', async ({ page }) => {
    await servePublicCopy(page, { token: 'googler-token' });
    /** @type {string[]} */
    const urls = [];
    await page.context().route(/storage\.googleapis\.com/, route => {
      urls.push(route.request().url());
      return route.fulfill({ json: [] });
    });
    await page.goto('/?source=remote');
    await expect.poll(() => urls.some(u => u.includes('suites.gen.json') && /[?&]t=\d+/.test(u))).toBe(true);
  });
});
