import {
  test,
  expect,
} from '../../../../../src/grading/test-fixture.ts';

function parseInnerList(headerValue: string): {
  innerTokens: string[];
  quotedPatterns: string[];
  paramsPart: string;
} | null {
  const trimmed = headerValue.trim();
  if (!trimmed.startsWith('(')) return null;

  // Locate closing ')' outside double quotes.
  let inQuotes = false;
  let escaped = false;
  let closeIdx = -1;
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inQuotes && ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ')') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) return null;

  const inside = trimmed.slice(1, closeIdx).trim();
  const paramsPart = trimmed.slice(closeIdx + 1).trim();

  // RFC 9651 inner lists are space-separated, never comma-separated or single-quoted.
  const quotedPatterns: string[] = [];
  const innerTokens: string[] = [];
  let rest = inside;
  while (rest.length > 0) {
    rest = rest.trimStart();
    if (rest.startsWith('"')) {
      let val = '';
      let esc = false;
      let i = 1;
      for (; i < rest.length; i++) {
        const ch = rest[i];
        if (esc) {
          val += ch;
          esc = false;
          continue;
        }
        if (ch === '\\') {
          esc = true;
          continue;
        }
        if (ch === '"') break;
        val += ch;
      }
      if (i >= rest.length || rest[i] !== '"') return null;
      quotedPatterns.push(val);
      innerTokens.push(`"${val}"`);
      rest = rest.slice(i + 1);
    } else {
      const m = rest.match(/^([^\s]+)/);
      if (!m) break;
      const tok = m[1];
      if (tok.includes(',') || tok.startsWith("'")) return null;
      innerTokens.push(tok);
      rest = rest.slice(tok.length);
    }
  }

  return { innerTokens, quotedPatterns, paramsPart };
}

function parseCspDirectives(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    if (!directives.has(name)) {
      directives.set(name, tokens.slice(1));
    }
  }
  return directives;
}

function isStrictSelfOrNone(tokens: string[] | undefined): boolean {
  if (!tokens || tokens.length === 0) return false;
  const hasWildcard = tokens.includes('*');
  const hasSelfOrNone = tokens.some((t) => {
    const lower = t.toLowerCase();
    return lower === "'self'" || lower === "'none'";
  });
  return !hasWildcard && hasSelfOrNone;
}

test.describe('restrict-outbound-connections Target Grader', () => {
  test('The Connection-Allowlist or Connection-Allowlist-Report-Only policy is formatted as a single RFC 9651 Inner List (...) of space-separated entries where response-origin is an unquoted token and external URL patterns are double-quoted strings', async ({
    page,
    TARGET_URL,
  }) => {
    const response = await page.goto(TARGET_URL);
    expect(response).not.toBeNull();
    const headers = response!.headers();
    const allowlist =
      headers['connection-allowlist'] ||
      headers['connection-allowlist-report-only'] ||
      '';

    const parsed = parseInnerList(allowlist);
    expect(parsed).not.toBeNull();
    expect(parsed!.innerTokens).toContain('response-origin');
    expect(parsed!.quotedPatterns.length).toBeGreaterThan(0);
  });

  test('URL patterns in Connection-Allowlist use "http://..." or "https://..." schemes, omit a bare trailing slash on origin-wide patterns (or use an explicit /* wildcard) so subpaths are permitted, and avoid custom regular expression groups', async ({
    page,
    TARGET_URL,
  }) => {
    const response = await page.goto(TARGET_URL);
    expect(response).not.toBeNull();
    const headers = response!.headers();
    const allowlist =
      headers['connection-allowlist'] ||
      headers['connection-allowlist-report-only'] ||
      '';

    const parsed = parseInnerList(allowlist);
    expect(parsed).not.toBeNull();

    const patterns = parsed!.quotedPatterns;
    expect(patterns.some((p) => p.includes('images.unsplash.com'))).toBe(true);
    expect(
      patterns.every(
        (p) =>
          /^https?:\/\//i.test(p) &&
          !/^(https?:\/\/[^/?#]+)\/$/i.test(p) &&
          !/[()]/.test(p),
      ),
    ).toBe(true);
  });

  test('Violation reporting is configured with a Reporting-Endpoints definition and an unquoted ; report-to=<endpoint-name> parameter appended after the closing parenthesis of the Connection-Allowlist inner list', async ({
    page,
    TARGET_URL,
  }) => {
    const response = await page.goto(TARGET_URL);
    expect(response).not.toBeNull();
    const headers = response!.headers();
    const allowlist =
      headers['connection-allowlist'] ||
      headers['connection-allowlist-report-only'] ||
      '';
    const reportingEndpoints = headers['reporting-endpoints'] || '';

    const parsed = parseInnerList(allowlist);
    expect(parsed).not.toBeNull();

    // Unquoted ; report-to=<endpoint-name> parameter after closing parenthesis.
    const reportToMatch = parsed!.paramsPart.match(
      /(?:^|;)\s*report-to=([a-zA-Z0-9_-]+)\b/,
    );
    expect(reportToMatch).not.toBeNull();
    expect(parsed!.paramsPart).not.toMatch(/report-to=["']/);

    const endpointName = reportToMatch![1];
    const definedEndpoints = new Set<string>();
    for (const match of reportingEndpoints.matchAll(
      /([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/g,
    )) {
      if (match[1] && /^(?:https?:\/\/|\/)/.test(match[2].trim())) {
        definedEndpoints.add(match[1]);
      }
    }
    expect(definedEndpoints.has(endpointName)).toBe(true);
  });

  test("A paired Content-Security-Policy fallback policy is configured alongside Connection-Allowlist, including default-src, connect-src, form-action, and worker-src 'self'", async ({
    page,
    TARGET_URL,
  }) => {
    const response = await page.goto(TARGET_URL);
    expect(response).not.toBeNull();
    const headers = response!.headers();
    const allowlist =
      headers['connection-allowlist'] ||
      headers['connection-allowlist-report-only'] ||
      '';
    expect(parseInnerList(allowlist)).not.toBeNull();

    const metaContents = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]'),
      ).map((el) => el.getAttribute('content') || ''),
    );

    const policies = [
      headers['content-security-policy'],
      headers['content-security-policy-report-only'],
      ...metaContents,
    ].filter((p): p is string => Boolean(p && p.trim()));

    expect(policies.length).toBeGreaterThan(0);

    const hasRequiredFallback = policies.some((policy) => {
      const directives = parseCspDirectives(policy);
      const defaultSrc = directives.get('default-src');
      const connectSrc = directives.get('connect-src');
      const formAction = directives.get('form-action');
      const workerSrc = directives.get('worker-src');

      return (
        isStrictSelfOrNone(defaultSrc) &&
        isStrictSelfOrNone(connectSrc) &&
        isStrictSelfOrNone(formAction) &&
        isStrictSelfOrNone(workerSrc) &&
        !workerSrc!.some((t) => t.toLowerCase().startsWith('blob:'))
      );
    });

    expect(hasRequiredFallback).toBe(true);
  });

  test('Outbound fetch() requests to response-origin or allowlisted endpoints succeed, while requests to unlisted third-party origins are blocked and caught gracefully with visible status feedback instead of throwing unhandled promise rejections', async ({
    page,
    TARGET_URL,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript(() => {
      (window as unknown as { __unhandledRejections: number }).__unhandledRejections = 0;
      window.addEventListener('unhandledrejection', () => {
        (window as unknown as { __unhandledRejections: number }).__unhandledRejections += 1;
      });
    });

    await page.goto(TARGET_URL);

    // Must expose a newsletter form and live status element on the page.
    const form = page.locator('form').filter({ has: page.locator('input[type="email"]') }).first();
    await expect(form).toBeVisible();
    const emailInput = form.locator('input[type="email"]').first();
    const submitBtn = form.locator('button[type="submit"], input[type="submit"]').first();
    const statusEl = page.locator('[role="status"], [aria-live], output').first();
    await expect(statusEl).toHaveCount(1);

    const PENDING_STATUS_RE = /^(?:\s*|(?:sending|signing|submitting|loading|working|processing)\b.*)$/i;

    // Same-origin submission succeeds and updates status feedback.
    await emailInput.fill('coffee@example.com');
    const [firstResponse] = await Promise.all([
      page.waitForResponse((res) => res.request().method() === 'POST', { timeout: 5000 }),
      submitBtn.click(),
    ]);
    expect(firstResponse.ok()).toBe(true);
    await expect
      .poll(
        async () => {
          const text = ((await statusEl.textContent()) || '').trim();
          return text.length > 0 && !PENDING_STATUS_RE.test(text);
        },
        { timeout: 5000 },
      )
      .toBe(true);
    await expect(statusEl).toBeVisible();
    const successText = ((await statusEl.textContent()) || '').trim();

    // Abort client-side POST fetches (simulating Connection-Allowlist / CSP / network block)
    // and ensure the rejection is caught and surfaces visible status feedback with no pageerror.
    await page.route('**/*', (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });

    await emailInput.fill('blocked@example.com');
    const [blockedRequest] = await Promise.all([
      page.waitForEvent('requestfailed', {
        predicate: (req) => req.method() === 'POST',
        timeout: 5000,
      }),
      submitBtn.click(),
    ]);
    expect(blockedRequest.method()).toBe('POST');

    await expect
      .poll(
        async () => {
          const text = ((await statusEl.textContent()) || '').trim();
          return text.length > 0 && text !== successText && !PENDING_STATUS_RE.test(text);
        },
        { timeout: 5000 },
      )
      .toBe(true);
    await expect(statusEl).toBeVisible();
    const blockedText = ((await statusEl.textContent()) || '').trim();
    expect(blockedText.length).toBeGreaterThan(0);

    const unhandledRejections = await page.evaluate(
      () => (window as unknown as { __unhandledRejections: number }).__unhandledRejections,
    );
    expect(unhandledRejections).toBe(0);
    expect(pageErrors).toEqual([]);
  });
});
