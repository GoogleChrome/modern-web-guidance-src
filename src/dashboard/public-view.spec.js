import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSuite, writeManifest } from '../harness/public/builder.ts';
import { LocalSuiteStore } from '../harness/public/suite-store.ts';

/**
 * The public, unauthenticated view must render entirely from `public-evals/`
 * and never contact the private bucket. These tests build a real public copy
 * with the harness builder, serve it to the page, and fail on any request to
 * storage.googleapis.com.
 */

const SUITE = 'nightly-2026-10-20_20-43-48-codex_cli';
const FIXTURE = path.join(import.meta.dirname, '..', 'harness', 'public', 'fixtures', 'nightly-sample.evals.json');

/** @type {string} */
let publicDir;

test.beforeAll(async () => {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'public-view-store-'));
  fs.mkdirSync(path.join(store, SUITE));
  fs.copyFileSync(FIXTURE, path.join(store, SUITE, 'evals.json'));

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
 * Serves `public-evals/**` from the built fixture and records any request to GCS.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} URLs of requests that reached the private bucket
 */
async function servePublicCopy(page) {
  /** @type {string[]} */
  const gcsRequests = [];
  await page.addInitScript(() => localStorage.removeItem('gcs_access_token'));
  await page.route('**/storage.googleapis.com/**', route => {
    gcsRequests.push(route.request().url());
    return route.abort();
  });
  await page.route('**/public-evals/**', route => {
    const url = new URL(route.request().url());
    const rel = url.pathname.replace(/^.*\/public-evals\//, '');
    const file = path.join(publicDir, rel);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ path: file, contentType: rel.endsWith('.json') ? 'application/json' : 'text/plain' });
  });
  return gcsRequests;
}

test.describe('Public view', () => {
  test('landing lists published suites without touching GCS', async ({ page }) => {
    const gcsRequests = await servePublicCopy(page);
    await page.goto('/?source=public');

    const row = page.locator('.suite-table-row', { hasText: 'codex' }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('public');
    await expect(row.locator('a.suite-link')).toHaveAttribute('href', /source=public/);
    expect(gcsRequests).toEqual([]);
  });

  test('suite page renders from public-evals without touching GCS', async ({ page }) => {
    const gcsRequests = await servePublicCopy(page);
    await page.goto(`/dashboard.html?testId=${SUITE}&source=public`);

    await expect(page.locator('#test-header')).toContainText(SUITE);
    await expect(page.locator('.task-accordion-header').first()).toBeVisible();
    await page.locator('.task-accordion-header').first().click();
    await expect(page.locator('.run-card').first()).toBeVisible();
    expect(gcsRequests).toEqual([]);
  });

  test('a 404 from public-evals shows an error instead of falling back to GCS', async ({ page }) => {
    const gcsRequests = await servePublicCopy(page);
    await page.goto('/dashboard.html?testId=nightly-does-not-exist&source=public');

    await expect(page.locator('body')).toContainText('Error loading dashboard data');
    expect(gcsRequests).toEqual([]);
  });
});
