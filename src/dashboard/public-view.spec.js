import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSuite, writeManifest } from '../harness/public/builder.ts';
import { LocalSuiteStore } from '../harness/public/suite-store.ts';

/**
 * The public, unauthenticated view must render entirely from `public-evals/`
 * and never contact the private bucket. These tests build a real public copy
 * with the harness builder, serve it to the page, and fail on any request to a
 * Google storage or console host, including from popups.
 */

const SUITE = 'nightly-2026-10-20_20-43-48-codex_cli';
const RUN = '1/security/daily-grind/guided';
const FIXTURE = path.join(import.meta.dirname, '..', 'harness', 'public', 'fixtures', 'nightly-sample.evals.json');
const GOOGLE_HOSTS = /https:\/\/[^/]*(googleapis\.com|cloud\.google\.com)\//;

/** @type {string} */
let publicDir;
/** @type {string} */
let rawEvalsJson;

test.beforeAll(async () => {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'public-view-store-'));
  const suiteDir = path.join(store, SUITE);
  fs.mkdirSync(path.join(suiteDir, RUN), { recursive: true });
  fs.copyFileSync(FIXTURE, path.join(suiteDir, 'evals.json'));
  fs.writeFileSync(path.join(suiteDir, RUN, 'agent.patch'), 'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -0,0 +1 @@\n+ok\n');
  fs.writeFileSync(path.join(suiteDir, RUN, 'modern-web.log'), 'GET /guides/security\n');
  rawEvalsJson = fs.readFileSync(FIXTURE, 'utf8');

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-view-out-'));
  const result = await buildSuite(SUITE, {
    store: new LocalSuiteStore(store),
    outDir,
    allowlist: { include: ['nightly-*'], exclude: [], overrides: [], releasedModels: ['example-model'] },
  });
  if (result.status !== 'built') throw new Error(`fixture build failed: ${result.reason}`);
  writeManifest(outDir);
  publicDir = path.join(outDir, 'public-evals');
});

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
  await page.context().route(GOOGLE_HOSTS, route => {
    googleRequests.push(route.request().url());
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
 * @returns {Promise<string>} the fake origin
 */
async function serveAsGitHubPages(page) {
  const origin = 'https://example.github.io';
  const devServer = test.info().project.use.baseURL ?? 'http://localhost:11432';
  await page.context().route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/public-evals/')) return route.fallback(); // served from the built fixture
    const response = await route.fetch({ url: devServer + url.pathname + url.search });
    return route.fulfill({ response });
  });
  return origin;
}

/**
 * Routes the private bucket to the raw fixture so signed-in mode can be exercised offline.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} Authorization header of every bucket request
 */
async function mockPrivateBucket(page) {
  /** @type {string[]} */
  const authHeaders = [];
  await page.context().route(/storage\.googleapis\.com/, route => {
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
    await expect(row).toContainText('public');
    await expect(row.locator('a.suite-link')).toHaveAttribute('href', /source=public/);
    expect(googleRequests).toEqual([]);
  });

  test('suite page renders, and Diff and Log open from public-evals only', async ({ page }) => {
    const { googleRequests, popupOrigins } = await servePublicCopy(page);
    await page.goto(`/dashboard.html?testId=${SUITE}&source=public`);

    await expect(page.locator('#test-header')).toContainText(SUITE);
    const security = page.locator('.task-accordion-header', { hasText: 'security' }).first();
    await security.click();
    await expect(page.locator('.run-card').first()).toBeVisible();

    await page.locator('.tfoot-action-btn', { hasText: 'Diff' }).first().click();
    await expect(page.locator('#modal')).toBeVisible();
    await expect(page.locator('#modal')).toContainText('a/src/app.ts');
    await page.keyboard.press('Escape');

    await page.locator('.tfoot-action-btn', { hasText: 'Log' }).first().click();
    await expect(page.locator('#modal')).toContainText('GET /guides/security');

    // Only the artifacts the builder publishes get a button; nothing that would 404 or need the bucket.
    const buttonLabels = await page.locator('.tfoot-action-btn').allInnerTexts();
    const labelSet = new Set(buttonLabels.map(label => label.trim()));
    expect(labelSet).toEqual(new Set(['Diff', 'Log']));
    await expect(page.locator('#view-gcs-artifacts-btn')).toBeHidden();
    await expect(page.locator('#view-log-btn')).toBeHidden();

    expect(googleRequests).toEqual([]);
    for (const origin of popupOrigins) {
      expect(origin).toBe(new URL(page.url()).origin);
    }
  });

  test('uplift comparisons omit the By Serving panel in public mode', async ({ page }) => {
    await servePublicCopy(page);
    await page.goto('/?source=public');
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toBeVisible();

    await page.getByText('Uplift Comparisons').click();
    await expect(page.locator('.insights-panel-title', { hasText: 'By Guide' })).toBeVisible();
    await expect(page.locator('.insights-panel-title', { hasText: 'By Agent' })).toBeVisible();
    await expect(page.locator('.insights-panel-title', { hasText: 'By Serving' })).toHaveCount(0);
  });

  test('a 404 from public-evals shows an error that names no bucket', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    await page.goto('/dashboard.html?testId=nightly-does-not-exist&source=public');

    const body = page.locator('body');
    await expect(body).toContainText('Error loading dashboard data');
    await expect(body).not.toContainText('guidance-evals');
    expect(googleRequests).toEqual([]);
  });

  test('?source=public wins over a stale token, and the sign-in button is offered', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { token: 'stale-token' });
    await page.goto('/?source=public');

    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toBeVisible();
    expect(googleRequests).toEqual([]);
  });

  test('a token the bucket rejects is cleared and the page falls back to public', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { token: 'outsider-token' });
    await page.context().unroute(GOOGLE_HOSTS);
    /** @type {string[]} */
    const bucketRequests = [];
    await page.context().route(/storage\.googleapis\.com/, route => {
      bucketRequests.push(route.request().url());
      return route.fulfill({ status: 403, body: 'forbidden' });
    });
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/`);
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toBeVisible();
    expect(bucketRequests.length).toBeGreaterThan(0);
    expect(await page.evaluate(() => localStorage.getItem('gcs_access_token'))).toBeNull();
    expect(googleRequests).toEqual([]);
  });

  test('with no token off the dev server, the public copy loads without ?source=', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    const origin = await serveAsGitHubPages(page);

    await page.goto(`${origin}/`);
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toBeVisible();
    expect(googleRequests).toEqual([]);
  });

  test('on the dev server with no token, public suites appear next to local ones', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page);
    await page.goto('/');

    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toContainText('public');
    await expect(page.locator('.suite-table-row', { hasText: 'example-result' }).first()).toContainText('local');
    expect(googleRequests).toEqual([]);
  });

  test('a missing public manifest is not an error', async ({ page }) => {
    await page.context().addInitScript(() => localStorage.removeItem('gcs_access_token'));
    await page.context().route('**/public-evals/**', route => route.fulfill({ status: 404, body: '' }));
    /** @type {string[]} */
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await expect(page.locator('.suite-table-row').first()).toBeVisible();
    expect(errors.filter(e => e.includes('public suites'))).toEqual([]);
  });
});

test.describe('Signed-in view', () => {
  test('still reads the private bucket with a bearer token and renders', async ({ page }) => {
    await servePublicCopy(page, { token: 'googler-token' });
    await page.context().unroute(GOOGLE_HOSTS);
    const authHeaders = await mockPrivateBucket(page);

    await page.goto(`/dashboard.html?testId=${SUITE}&source=remote`);
    await expect(page.locator('#test-header')).toContainText(SUITE);
    await expect(page.locator('.task-accordion-header').first()).toBeVisible();

    expect(authHeaders.length).toBeGreaterThan(0);
    expect(authHeaders.every(h => h === 'Bearer googler-token')).toBe(true);
  });

  test('Sign out forgets the token and returns to the public view', async ({ page }) => {
    const { googleRequests } = await servePublicCopy(page, { manageToken: false });
    await page.context().unroute(GOOGLE_HOSTS);
    await mockPrivateBucket(page);

    // Seed the token once (not via an init script, which would re-add it after sign-out reloads).
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('gcs_access_token', 'googler-token'));
    await page.goto('/?source=remote');
    const authBtn = page.locator('#auth-btn');
    await expect(authBtn).toHaveText('Sign out');
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toContainText('remote');

    await authBtn.click();
    await page.waitForURL(url => !url.search.includes('source=remote'));
    expect(await page.evaluate(() => localStorage.getItem('gcs_access_token'))).toBeNull();
    await expect(page.locator('#auth-btn')).toHaveText('Sign in with Google');
    await expect(page.locator('.suite-table-row', { hasText: 'codex' }).first()).toContainText('public');
    expect(googleRequests).toEqual([]);
  });

  test('remote manifest keeps its cache-buster', async ({ page }) => {
    await servePublicCopy(page, { token: 'googler-token' });
    await page.context().unroute(GOOGLE_HOSTS);
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
