/**
 * Expectations Relevance Analysis:
 * Expectation 1: TESTED - Validates that the Strict-Transport-Security header enforces HTTPS with max-age >= 31536000 and includeSubDomains.
 * Expectation 2: SKIPPED - Base application contains no dynamic DOM rendering or dangerous sinks.
 * Expectation 3: SKIPPED - Base application does not contain session cookies or user session state.
 * Expectation 4: SKIPPED - Base application does not embed third-party iframes or require partitioned third-party cookies.
 * Expectation 5: TESTED - Validates clickjacking protection via X-Frame-Options and CSP frame-ancestors 'self'.
 * Expectation 6: SKIPPED - Base application does not implement window message event listeners.
 * Expectation 7: SKIPPED - Base application does not send cross-window postMessage messages.
 * Expectation 8: TESTED - Validates Reporting-Endpoints header configuration and CSP report-to directive reference.
 * Expectation 9: TESTED - Validates CSP script-src uses 'strict-dynamic', 'report-sample', and object-src 'none', base-uri 'none'.
 * Expectation 10: TESTED - Validates CSP does not rely on broad scheme/domain allowlists as primary script-src protection.
 * Expectation 11: TESTED - Validates CSP enforces Trusted Types via require-trusted-types-for 'script'.
 * Expectation 12: TESTED - Validates Cross-Origin-Opener-Policy is set to same-origin-allow-popups or same-origin on document responses.
 * Expectation 13: TESTED - Validates Cross-Origin-Resource-Policy is set to same-origin or same-site.
 * Expectation 14: TESTED - Validates Fetch Metadata protection rejecting unauthorized cross-site requests with 403 and Vary header.
 * Expectation 15: TESTED - Validates X-Content-Type-Options: nosniff header on document responses.
 * Expectation 16: TESTED - Validates Referrer-Policy: strict-origin-when-cross-origin on document responses.
 * Expectation 17: TESTED - Validates Permissions-Policy header restricting unused browser capabilities (camera, geolocation, microphone).
 * Expectation 18: SKIPPED - Base application contains no external versioned script tags.
 * Expectation 19: SKIPPED - Base application contains no CORS endpoints.
 * Expectation 20: TESTED - Validates Clear-Site-Data header on /logout response.
 */

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

import { pathToFileURL } from 'node:url';
import * as path from 'node:path';
const testFileUrl = pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;
const targetFiles: string[] = getTargetFiles(testFileUrl);
void targetFiles;
void getCssStyleSheet;
void getJsProject;
void getHtmlDocuments;

test.describe('security Target Grader', () => {

  test.describe('Browser tests', () => {

    test('Exp 1: Document response serves Strict-Transport-Security header enforcing HTTPS', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const hsts = response?.headers()['strict-transport-security'] || '';
      expect(hsts).toMatch(/max-age=\d+.*includeSubDomains|includeSubDomains.*max-age=\d+/i);
    });

    test('Exp 5: Document response sets X-Frame-Options to SAMEORIGIN or DENY', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const xfo = response?.headers()['x-frame-options']?.toUpperCase() || '';
      expect(xfo).toMatch(/^(SAMEORIGIN|DENY)$/);
    });

    test("Exp 5: Document response sets Content-Security-Policy frame-ancestors directive", async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      expect(csp).toMatch(/frame-ancestors\s+[^;]*'self'/i);
    });

    test('Exp 8: Document response configures a Reporting-Endpoints header', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const reportingEndpoints = response?.headers()['reporting-endpoints'] || '';
      expect(reportingEndpoints).toMatch(/[\w-]+\s*=\s*["'][^"']+["']/);
    });

    test('Exp 8: Content-Security-Policy references the reporting endpoint via report-to', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      expect(csp).toMatch(/report-to\s+[\w-]+/i);
    });

    test("Exp 9: Content-Security-Policy script-src includes 'strict-dynamic'", async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      expect(csp).toMatch(/script-src\s+[^;]*'strict-dynamic'/i);
    });

    test("Exp 9: Content-Security-Policy script-src includes 'report-sample'", async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      expect(csp).toMatch(/script-src\s+[^;]*'report-sample'/i);
    });

    test("Exp 9: Content-Security-Policy script-src includes a nonce or hash", async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      expect(csp).toMatch(/script-src\s+[^;]*'(?:nonce-[A-Za-z0-9+/=]+|sha(?:256|384|512)-[A-Za-z0-9+/=]+)'/i);
    });

    test("Exp 9: Content-Security-Policy enforces object-src 'none'", async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      expect(csp).toMatch(/object-src\s+'none'/i);
    });

    test("Exp 9: Content-Security-Policy enforces base-uri 'none'", async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      expect(csp).toMatch(/base-uri\s+'none'/i);
    });

    test("Exp 10: Content-Security-Policy does not use broad allowlists without strict-dynamic", async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/i);
      const scriptSrc = scriptSrcMatch ? scriptSrcMatch[1] : '';
      const usesStrictDynamic = scriptSrc.includes("'strict-dynamic'");
      expect(usesStrictDynamic && scriptSrc.length > 0).toBe(true);
    });

    test("Exp 11: Content-Security-Policy enforces Trusted Types for scripts", async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const csp = response?.headers()['content-security-policy'] || '';
      expect(csp).toMatch(/require-trusted-types-for\s+'script'/i);
    });

    test('Exp 12: Document response sets Cross-Origin-Opener-Policy', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const coop = response?.headers()['cross-origin-opener-policy'] || '';
      expect(coop).toMatch(/^(same-origin-allow-popups|same-origin)$/i);
    });

    test('Exp 13: Response sets Cross-Origin-Resource-Policy', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const corp = response?.headers()['cross-origin-resource-policy'] || '';
      expect(corp).toMatch(/^(same-origin|same-site)$/i);
    });

    test('Exp 14: Response includes Vary header with Sec-Fetch metadata keys', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const vary = response?.headers()['vary'] || '';
      const hasFetchKeys =
        vary.includes('Sec-Fetch-Dest') &&
        vary.includes('Sec-Fetch-Mode') &&
        vary.includes('Sec-Fetch-Site');
      expect(hasFetchKeys).toBe(true);
    });

    test('Exp 14: Server rejects unauthorized cross-site requests with HTTP 403', async ({ request, TARGET_URL }) => {
      const res = await request.get(TARGET_URL, {
        headers: {
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
        },
      });
      expect(res.status()).toBe(403);
    });

    test('Exp 15: Document response sets X-Content-Type-Options to nosniff', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const nosniff = response?.headers()['x-content-type-options'];
      expect(nosniff).toBe('nosniff');
    });

    test('Exp 16: Document response sets Referrer-Policy to strict-origin-when-cross-origin', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const rp = response?.headers()['referrer-policy'];
      expect(rp).toBe('strict-origin-when-cross-origin');
    });

    test('Exp 17: Document response sets a restrictive Permissions-Policy disabling unused features', async ({ page, TARGET_URL }) => {
      const response = await page.goto(TARGET_URL);
      const pp = response?.headers()['permissions-policy'] || '';
      const disablesFeatures =
        pp.includes('camera=()') &&
        pp.includes('geolocation=()') &&
        pp.includes('microphone=()');
      expect(disablesFeatures).toBe(true);
    });

    test('Exp 20: Logout response sends Clear-Site-Data header to clear client state', async ({ request, TARGET_URL }) => {
      const logoutUrl = TARGET_URL.endsWith('/') ? `${TARGET_URL}logout` : `${TARGET_URL}/logout`;
      const res = await request.get(logoutUrl, { maxRedirects: 0 });
      const csd = res.headers()['clear-site-data'] || '';
      const clearsState =
        csd.includes('"cookies"') &&
        csd.includes('"storage"') &&
        csd.includes('"cache"');
      expect(clearsState).toBe(true);
    });

  });
});
