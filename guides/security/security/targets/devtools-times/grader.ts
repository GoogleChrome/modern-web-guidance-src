/**
 * Expectations status:
 * - Expectation 1: TESTED - Strict-Transport-Security header enforcement with max-age.
 * - Expectation 2: SKIPPED - Base application already satisfies this (does not use dangerous DOM sinks).
 * - Expectation 3: TESTED - Session cookie configured with __Host- prefix, Secure, SameSite=Lax, Path=/, and HttpOnly.
 *   (HttpOnly is treated as satisfied for Astro `session.cookie` config, because Astro forces `httpOnly: true` at
 *   runtime and does not expose it in its session cookie config schema.)
 * - Expectation 4: SKIPPED - Application does not use cookies in third-party embedded contexts.
 * - Expectation 5: TESTED - Clickjacking protection via X-Frame-Options and CSP frame-ancestors.
 * - Expectation 6: SKIPPED - Application does not contain window message event listeners.
 * - Expectation 7: SKIPPED - Application does not send messages via postMessage.
 * - Expectation 8: TESTED - Reporting-Endpoints HTTP header configured and referenced via CSP report-to.
 * - Expectation 9: TESTED - CSP script-src with nonce/hash, strict-dynamic, report-sample, object-src 'none', and base-uri 'none'.
 * - Expectation 10: SKIPPED - Base application already satisfies this (does not use broad scheme or domain allowlists).
 * - Expectation 11: TESTED - Trusted Types enforcement via require-trusted-types-for 'script' in CSP.
 * - Expectation 12: TESTED - Cross-Origin-Opener-Policy set to same-origin-allow-popups or same-origin on document responses.
 * - Expectation 13: TESTED - Cross-Origin-Resource-Policy set to same-origin or same-site on internal API responses.
 * - Expectation 14: TESTED - Server-side Fetch Metadata protection inspecting Sec-Fetch headers, rejecting cross-site state-changing requests with 403, and including Vary.
 * - Expectation 15: TESTED - X-Content-Type-Options: nosniff header on responses.
 * - Expectation 16: TESTED - Referrer-Policy: strict-origin-when-cross-origin on document responses.
 * - Expectation 17: TESTED - Restrictive Permissions-Policy header disabling camera, geolocation, and microphone.
 * - Expectation 18: SKIPPED - Application does not contain external versioned script tags.
 * - Expectation 19: SKIPPED - Application does not configure CORS endpoints requiring credentials.
 * - Expectation 20: SKIPPED - Application does not contain a logout flow or endpoint.
 */

import fs from 'node:fs';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import {
  SyntaxKind,
  type Project,
  type StringLiteral,
  type PropertyAssignment,
  type ObjectLiteralExpression,
} from 'ts-morph';
import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(import.meta.url);
const project: Project = getJsProject(targetFiles);

// Ensure any configuration files (such as astro.config.mjs or .cjs) are loaded into the ts-morph project
for (const file of targetFiles) {
  if (/\.[mc]js$/i.test(file) && fs.existsSync(file)) {
    project.createSourceFile(file, fs.readFileSync(file, 'utf8'), { overwrite: true });
  }
}

const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

function getHeaderValues(proj: Project, headerName: string): string[] {
  const values: string[] = [];
  const lowerName = headerName.toLowerCase();

  for (const sf of proj.getSourceFiles()) {
    // 1. Method calls: headers.set('name', 'val'), res.setHeader('name', 'val'), etc.
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const args = call.getArguments();
      if (args.length >= 2) {
        const first = args[0];
        if (first.getKind() === SyntaxKind.StringLiteral) {
          const literalVal = (first as StringLiteral).getLiteralValue().toLowerCase();
          if (literalVal === lowerName) {
            values.push(args[1].getText());
          }
        }
      }
    }

    // 2. Object literal property assignments: headers: { 'name': 'val' }
    for (const prop of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const name = prop.getName().replace(/^["']|["']$/g, '').toLowerCase();
      if (name === lowerName) {
        values.push(prop.getInitializer()?.getText() || '');
      }
    }

    // 3. Array tuples in Headers constructor: [['name', 'val']]
    for (const arr of sf.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)) {
      const elements = arr.getElements();
      if (elements.length >= 2) {
        const first = elements[0];
        if (first.getKind() === SyntaxKind.StringLiteral) {
          const literalVal = (first as StringLiteral).getLiteralValue().toLowerCase();
          if (literalVal === lowerName) {
            values.push(elements[1].getText());
          }
        }
      }
    }
  }

  return values;
}

function getAllStringLiterals(proj: Project): string[] {
  return proj.getSourceFiles().flatMap(sf => [
    ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map(l => l.getLiteralValue()),
    ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map(l => l.getLiteralValue()),
    ...sf.getDescendantsOfKind(SyntaxKind.TemplateExpression).map(l => l.getText()),
  ]);
}

test.describe('devtools-times Security Target Grader', () => {

  // Expectation 1: Strict-Transport-Security header
  test('Expectation 1: Serves Strict-Transport-Security header to enforce HTTPS connections', () => {
    const hstsValues = getHeaderValues(project, 'Strict-Transport-Security');
    const hasHsts = hstsValues.some(val => val.toLowerCase().includes('max-age'));
    expect(hasHsts).toBe(true);
  });

  // Expectation 3: Session cookie configuration
  test('Expectation 3: Configures first-party session cookies with __Host- prefix and secure attributes', () => {
    let hasValidSessionCookie = false;

    for (const sf of project.getSourceFiles()) {
      for (const prop of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        const name = prop.getName().replace(/^["']|["']$/g, '');
        if (name === 'cookie') {
          const init = prop.getInitializer();
          if (init && init.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const props = (init as ObjectLiteralExpression).getProperties();

            // Astro's `session.cookie` config does not accept an `httpOnly` option: Astro
            // unconditionally sets `httpOnly: true` on the session cookie at runtime. So a
            // `cookie` object nested under `session` already satisfies the HttpOnly requirement.
            const parentProp = prop
              .getParentIfKind(SyntaxKind.ObjectLiteralExpression)
              ?.getParentIfKind(SyntaxKind.PropertyAssignment);
            const isAstroSessionCookie =
              parentProp?.getName().replace(/^["']|["']$/g, '') === 'session';

            let hasHostPrefix = false;
            let hasSameSiteLax = false;
            let hasSecure = false;
            let hasHttpOnly = isAstroSessionCookie;
            let hasRootPath = false;
            let hasDomain = false;

            for (const cp of props) {
              if (cp.getKind() === SyntaxKind.PropertyAssignment) {
                const pa = cp as PropertyAssignment;
                const pName = pa.getName().replace(/^["']|["']$/g, '').toLowerCase();
                const initNode = pa.getInitializer();
                const pVal = initNode?.getText().replace(/^["']|["']$/g, '').trim() || '';
                const isTrue = pVal === 'true' || initNode?.getKind() === SyntaxKind.TrueKeyword;

                if (pName === 'name' && pVal.startsWith('__Host-')) hasHostPrefix = true;
                if (pName === 'samesite' && pVal.toLowerCase() === 'lax') hasSameSiteLax = true;
                if (pName === 'secure' && isTrue) hasSecure = true;
                if (pName === 'httponly' && isTrue) hasHttpOnly = true;
                if (pName === 'path' && pVal === '/') hasRootPath = true;
                if (pName === 'domain') hasDomain = true;
              }
            }

            if (hasHostPrefix && hasSameSiteLax && hasSecure && hasHttpOnly && hasRootPath && !hasDomain) {
              hasValidSessionCookie = true;
            }
          }
        }
      }
    }

    expect(hasValidSessionCookie).toBe(true);
  });

  // Expectation 5: Clickjacking protection
  test('Expectation 5: Protects against clickjacking via X-Frame-Options and CSP frame-ancestors', () => {
    const xfoValues = getHeaderValues(project, 'X-Frame-Options');
    const hasXfo = xfoValues.some(val => {
      const upper = val.toUpperCase();
      return upper.includes('SAMEORIGIN') || upper.includes('DENY');
    });

    const literals = getAllStringLiterals(project);
    const hasFrameAncestors = literals.some(val => {
      const lower = val.toLowerCase();
      return lower.includes('frame-ancestors') && (lower.includes("'self'") || lower.includes('"self"') || lower.includes("'none'"));
    });

    expect(hasXfo && hasFrameAncestors).toBe(true);
  });

  // Expectation 8: Reporting-Endpoints header and CSP report-to
  test('Expectation 8: Configures Reporting-Endpoints header and references it via CSP report-to', () => {
    const reportingEndpoints = getHeaderValues(project, 'Reporting-Endpoints');
    const hasReportingHeader = reportingEndpoints.length > 0;

    const literals = getAllStringLiterals(project);
    const hasReportTo = literals.some(val => val.toLowerCase().includes('report-to'));

    expect(hasReportingHeader && hasReportTo).toBe(true);
  });

  // Expectation 9: Nonce-based CSP with strict-dynamic, report-sample, object-src none, base-uri none
  test('Expectation 9: Enforces nonce-based or hash-based CSP with strict-dynamic, report-sample, object-src none, and base-uri none', () => {
    const literals = getAllStringLiterals(project);

    const hasScriptSrc = literals.some(val => {
      const lower = val.toLowerCase();
      const hasSource = lower.includes("'strict-dynamic'") || lower.includes('"strict-dynamic"');
      const hasSample = lower.includes("'report-sample'") || lower.includes('"report-sample"');
      const hasNonceOrHash = lower.includes("'nonce-") || lower.includes('"nonce-') || lower.includes("'sha");
      return lower.includes('script-src') && hasSource && hasSample && hasNonceOrHash;
    });

    const hasObjectSrc = literals.some(val => {
      const lower = val.toLowerCase();
      return lower.includes('object-src') && (lower.includes("'none'") || lower.includes('"none"'));
    });

    const hasBaseUri = literals.some(val => {
      const lower = val.toLowerCase();
      return lower.includes('base-uri') && (lower.includes("'none'") || lower.includes('"none"'));
    });

    expect(hasScriptSrc && hasObjectSrc && hasBaseUri).toBe(true);
  });

  // Expectation 11: Trusted Types enforcement via require-trusted-types-for 'script' in CSP
  test('Expectation 11: Enforces Trusted Types via require-trusted-types-for script in CSP header', () => {
    const literals = getAllStringLiterals(project);
    const hasTrustedTypes = literals.some(val => {
      const lower = val.toLowerCase();
      return lower.includes('require-trusted-types-for') && (lower.includes("'script'") || lower.includes('"script"'));
    });

    expect(hasTrustedTypes).toBe(true);
  });

  // Expectation 12: Cross-Origin-Opener-Policy
  test('Expectation 12: Sets Cross-Origin-Opener-Policy same-origin-allow-popups or same-origin on document responses', () => {
    const coopValues = getHeaderValues(project, 'Cross-Origin-Opener-Policy');
    const hasCoop = coopValues.some(val => {
      const lower = val.toLowerCase();
      return lower.includes('same-origin-allow-popups') || lower.includes('same-origin');
    });

    expect(hasCoop).toBe(true);
  });

  // Expectation 13: Cross-Origin-Resource-Policy on internal API
  test('Expectation 13: Sets Cross-Origin-Resource-Policy same-origin or same-site on internal API responses', () => {
    const corpValues = getHeaderValues(project, 'Cross-Origin-Resource-Policy');
    const hasCorp = corpValues.some(val => {
      const lower = val.toLowerCase();
      return lower.includes('same-origin') || lower.includes('same-site');
    });

    expect(hasCorp).toBe(true);
  });

  // Expectation 14: Server-side Fetch Metadata protection
  test('Expectation 14: Implements server-side Fetch Metadata protection rejecting cross-site requests with 403 and Vary', () => {
    const literals = getAllStringLiterals(project);
    const checksSecFetch = literals.some(val => val.toLowerCase().includes('sec-fetch-site'));

    let has403Status = false;
    for (const sf of project.getSourceFiles()) {
      for (const num of sf.getDescendantsOfKind(SyntaxKind.NumericLiteral)) {
        if (num.getLiteralValue() === 403) {
          has403Status = true;
          break;
        }
      }
      if (has403Status) break;
    }

    const varyHeaders = getHeaderValues(project, 'Vary');
    const hasVary = varyHeaders.some(val => val.toLowerCase().includes('sec-fetch'))
      || literals.some(val => val.toLowerCase().includes('sec-fetch-dest') && val.toLowerCase().includes('sec-fetch-site'));

    expect(checksSecFetch && has403Status && hasVary).toBe(true);
  });

  // Expectation 15: X-Content-Type-Options: nosniff
  test('Expectation 15: Sets X-Content-Type-Options nosniff header on responses', () => {
    const nosniffValues = getHeaderValues(project, 'X-Content-Type-Options');
    const hasNosniff = nosniffValues.some(val => val.toLowerCase().includes('nosniff'));
    expect(hasNosniff).toBe(true);
  });

  // Expectation 16: Referrer-Policy: strict-origin-when-cross-origin
  test('Expectation 16: Sets Referrer-Policy strict-origin-when-cross-origin on document responses', () => {
    const referrerHeaders = getHeaderValues(project, 'Referrer-Policy');
    const hasReferrerHeader = referrerHeaders.some(val => val.toLowerCase().includes('strict-origin-when-cross-origin'));

    const hasReferrerMeta = docs.some(d => {
      const meta = d.document.querySelector('meta[name="referrer" i]');
      return meta !== null && (meta.getAttribute('content') || '').toLowerCase().includes('strict-origin-when-cross-origin');
    });

    expect(hasReferrerHeader || hasReferrerMeta).toBe(true);
  });

  // Expectation 17: Restrictive Permissions-Policy header
  test('Expectation 17: Sets restrictive Permissions-Policy header disabling unused features', () => {
    const permissionsPolicies = getHeaderValues(project, 'Permissions-Policy');
    const hasPermissionsPolicy = permissionsPolicies.some(val => {
      const lower = val.toLowerCase();
      return lower.includes('camera=()') && lower.includes('geolocation=()') && lower.includes('microphone=()');
    });

    expect(hasPermissionsPolicy).toBe(true);
  });
});
