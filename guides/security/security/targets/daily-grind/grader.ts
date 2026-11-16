/*
 * Expectation 1: TESTED - Strict-Transport-Security header with positive max-age is served on document responses
 * Expectation 2: SKIPPED: No client-side script rendering untrusted or dynamic text into the DOM in the base application or task.md
 * Expectation 3: SKIPPED: No session cookies exist in the base application or are required by task.md
 * Expectation 4: SKIPPED: No cookies required in third-party embedded contexts exist in the base application or task.md
 * Expectation 5: TESTED - Clickjacking protection via X-Frame-Options (DENY or SAMEORIGIN) and CSP frame-ancestors ('none' or 'self')
 * Expectation 6: SKIPPED: No window message event listeners exist in the base application or task.md
 * Expectation 7: SKIPPED: No postMessage calls exist in the base application or task.md
 * Expectation 8: TESTED - Reporting-Endpoints header is configured and referenced by report-to in Content-Security-Policy
 * Expectation 9: TESTED - Content-Security-Policy enforces nonce/hash script-src with 'strict-dynamic' and 'report-sample', object-src 'none', and base-uri 'none'
 * Expectation 10: TESTED - Content-Security-Policy script-src uses nonce/hash with 'strict-dynamic' rather than broad scheme or domain allowlists as primary protection
 * Expectation 11: TESTED - Content-Security-Policy enforces require-trusted-types-for 'script' without unsanitized HTML sink assignments
 * Expectation 12: TESTED - Cross-Origin-Opener-Policy header set to same-origin-allow-popups or same-origin on document responses
 * Expectation 13: TESTED - Cross-Origin-Resource-Policy header set to same-origin or same-site on app-internal server responses
 * Expectation 14: TESTED - Server-side Fetch Metadata protection rejects unauthorized cross-site requests with 403 and sends Vary: Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site
 * Expectation 15: TESTED - X-Content-Type-Options: nosniff header served alongside accurate Content-Type header
 * Expectation 16: TESTED - Referrer-Policy: strict-origin-when-cross-origin header served on document responses
 * Expectation 17: TESTED - Restrictive Permissions-Policy header disables unused browser features (camera=(), geolocation=(), microphone=())
 * Expectation 18: SKIPPED: No external versioned <script> tags exist in the base application or task.md
 * Expectation 19: SKIPPED: No CORS endpoints exist in the base application or task.md
 * Expectation 20: TESTED - Logout endpoint (/logout) sends Clear-Site-Data header with "cookies", "storage", and "cache"
 */

import {
  test,
  expect,
} from '../../../../../src/grading/test-fixture.ts';

function parseCspDirectives(cspHeader: string | undefined): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  if (!cspHeader) return directives;
  for (const rawPart of cspHeader.split(';')) {
    const trimmed = rawPart.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    const name = tokens[0].toLowerCase();
    directives.set(name, tokens.slice(1));
  }
  return directives;
}

test.describe('security Target Grader', () => {
  test.describe('Browser tests', () => {
    test('Expectation 1: Serves Strict-Transport-Security header with positive max-age', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const hsts = response?.headers()['strict-transport-security'];
      expect(hsts).toBeDefined();
      const maxAgeMatch = hsts?.match(/\bmax-age=(\d+)/i) ?? null;
      expect(maxAgeMatch).not.toBeNull();
      expect(Number(maxAgeMatch?.[1])).toBeGreaterThan(0);
    });

    test('Expectation 5: Protects against clickjacking with X-Frame-Options and CSP frame-ancestors', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const headers = response?.headers() ?? {};

      const xfo = headers['x-frame-options'];
      expect(xfo).toBeDefined();
      expect(xfo?.trim().toUpperCase()).toMatch(/^(DENY|SAMEORIGIN)$/);

      const directives = parseCspDirectives(headers['content-security-policy']);
      const frameAncestors = directives.get('frame-ancestors');
      expect(frameAncestors).toBeDefined();
      expect(frameAncestors).toEqual(
        expect.arrayContaining([expect.stringMatching(/^'(none|self)'$/i)]),
      );
    });

    test('Expectation 8: Configures Reporting-Endpoints header and references it via CSP report-to', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const headers = response?.headers() ?? {};

      const reportingEndpoints = headers['reporting-endpoints'];
      expect(reportingEndpoints).toBeDefined();

      const endpointNames = Array.from(
        (reportingEndpoints ?? '').matchAll(/([a-zA-Z0-9_-]+)\s*=\s*"[^"]+"/g),
        (m) => m[1],
      );
      expect(endpointNames.length).toBeGreaterThan(0);

      const directives = parseCspDirectives(headers['content-security-policy']);
      const reportTo = directives.get('report-to') ?? [];
      expect(reportTo.length).toBeGreaterThan(0);
      expect(endpointNames).toContain(reportTo[0]);
    });

    test('Expectation 9: Enforces nonce-based or hash-based CSP with strict-dynamic, report-sample, object-src none, and base-uri none', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const directives = parseCspDirectives(response?.headers()['content-security-policy']);

      const scriptSrc = directives.get('script-src') ?? [];
      expect(
        scriptSrc.some((token) =>
          /^'(nonce-[A-Za-z0-9+/=_-]+|sha(256|384|512)-[A-Za-z0-9+/=_-]+)'$/.test(token),
        ),
      ).toBe(true);
      expect(scriptSrc).toContain("'strict-dynamic'");
      expect(scriptSrc).toContain("'report-sample'");

      const objectSrc = directives.get('object-src') ?? directives.get('default-src') ?? [];
      expect(objectSrc).toContain("'none'");

      const baseUri = directives.get('base-uri') ?? [];
      expect(baseUri).toContain("'none'");
    });

    test('Expectation 10: Does not use broad scheme or domain allowlists without strict-dynamic as primary script-src protection', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const directives = parseCspDirectives(response?.headers()['content-security-policy']);

      const scriptSrc = directives.get('script-src') ?? [];
      expect(scriptSrc).toContain("'strict-dynamic'");
      expect(
        scriptSrc.some((token) =>
          /^'(nonce-[A-Za-z0-9+/=_-]+|sha(256|384|512)-[A-Za-z0-9+/=_-]+)'$/.test(token),
        ),
      ).toBe(true);
      expect(scriptSrc).not.toContain('*');
      expect(scriptSrc).not.toContain('http:');
      expect(scriptSrc).not.toContain('data:');
    });

    test('Expectation 11: Enforces Trusted Types via require-trusted-types-for script in CSP and blocks unsanitized HTML sink assignments', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const directives = parseCspDirectives(response?.headers()['content-security-policy']);

      const rttf = directives.get('require-trusted-types-for') ?? [];
      expect(rttf).toContain("'script'");

      const blocksRawInnerHtml = await page.evaluate(() => {
        try {
          const el = document.createElement('div');
          el.innerHTML = '<img src=x onerror=1>';
          return false;
        } catch {
          return true;
        }
      });
      expect(blocksRawInnerHtml).toBe(true);
    });

    test('Expectation 12: Sets Cross-Origin-Opener-Policy to same-origin-allow-popups or same-origin on document responses', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const coop = response?.headers()['cross-origin-opener-policy'];
      expect(coop).toBeDefined();
      const directiveValue = (coop ?? '').split(';')[0].trim().toLowerCase();
      expect(['same-origin-allow-popups', 'same-origin']).toContain(directiveValue);
    });

    test('Expectation 13: Sets Cross-Origin-Resource-Policy to same-origin or same-site on app-internal server responses', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const corp = response?.headers()['cross-origin-resource-policy'];
      expect(corp).toBeDefined();
      expect(['same-origin', 'same-site']).toContain((corp ?? '').trim().toLowerCase());

      const logoutUrl = new URL('/logout', TARGET_URL);
      let logoutRes = await fetch(logoutUrl, {
        method: 'GET',
        headers: {
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
        },
        redirect: 'manual',
      });
      if (logoutRes.status === 405) {
        logoutRes = await fetch(logoutUrl, {
          method: 'POST',
          headers: {
            Origin: new URL(TARGET_URL).origin,
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'same-origin',
            'Sec-Fetch-Dest': 'empty',
          },
          redirect: 'manual',
        });
      }
      const logoutCorp = logoutRes.headers.get('cross-origin-resource-policy');
      expect(logoutCorp).not.toBeNull();
      expect(['same-origin', 'same-site']).toContain((logoutCorp ?? '').trim().toLowerCase());
    });

    test('Expectation 14: Implements server-side Fetch Metadata protection rejecting unauthorized cross-site requests with 403 and setting Vary', async ({
      TARGET_URL,
    }) => {
      const crossSiteRes = await fetch(new URL('/logout', TARGET_URL), {
        method: 'POST',
        headers: {
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Dest': 'empty',
        },
        redirect: 'manual',
      });
      expect(crossSiteRes.status).toBe(403);

      const docRes = await fetch(TARGET_URL, {
        headers: {
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
        },
      });
      const vary = docRes.headers.get('vary') || crossSiteRes.headers.get('vary') || '';
      const varyTokens = vary
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      expect(varyTokens).toEqual(
        expect.arrayContaining(['sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site']),
      );
    });

    test('Expectation 15: Sets X-Content-Type-Options: nosniff alongside accurate Content-Type headers', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const headers = response?.headers() ?? {};
      expect(headers['x-content-type-options']?.trim().toLowerCase()).toBe('nosniff');
      expect(headers['content-type']?.toLowerCase()).toContain('text/html');
    });

    test('Expectation 16: Sets Referrer-Policy: strict-origin-when-cross-origin on document responses', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const referrerPolicy = response?.headers()['referrer-policy'];
      expect(referrerPolicy?.trim().toLowerCase()).toBe('strict-origin-when-cross-origin');
    });

    test('Expectation 17: Sets restrictive Permissions-Policy header disabling unused browser features', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      expect(response).not.toBeNull();
      const permissionsPolicy = response?.headers()['permissions-policy'];
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toMatch(/\bcamera=\(\)/);
      expect(permissionsPolicy).toMatch(/\bgeolocation=\(\)/);
      expect(permissionsPolicy).toMatch(/\bmicrophone=\(\)/);
    });

    test('Expectation 20: Sends Clear-Site-Data header with cookies, storage, and cache on logout responses', async ({
      TARGET_URL,
    }) => {
      const logoutUrl = new URL('/logout', TARGET_URL);
      let response = await fetch(logoutUrl, {
        method: 'GET',
        headers: {
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
        },
        redirect: 'manual',
      });
      if (response.status === 405) {
        response = await fetch(logoutUrl, {
          method: 'POST',
          headers: {
            Origin: new URL(TARGET_URL).origin,
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'same-origin',
            'Sec-Fetch-Dest': 'empty',
          },
          redirect: 'manual',
        });
      }
      expect(response.status).toBeLessThan(400);
      const clearSiteData = response.headers.get('clear-site-data') ?? '';
      expect(clearSiteData).toContain('"cookies"');
      expect(clearSiteData).toContain('"storage"');
      expect(clearSiteData).toContain('"cache"');
    });
  });
});
