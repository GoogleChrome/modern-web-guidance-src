/**
 * Expectations Coverage Summary:
 * Expectation 1: SKIPPED - Base application has no forms or user data collection inputs to minimize granularity.
 * Expectation 2: SKIPPED - Base application has no account creation or checkout flow.
 * Expectation 3: SKIPPED - Base application contains no form or sensitive data input fields.
 * Expectation 4: SKIPPED - Base application does not request or invoke browser permissions.
 * Expectation 5: TESTED - Base application has a logout link/flow requiring the Clear-Site-Data header on logout.
 * Expectation 6: SKIPPED - Base application does not store profile data or have a profile management UI.
 * Expectation 7: SKIPPED - Base application has no logging or analytics capturing user PII.
 * Expectation 8: SKIPPED - Base application does not store session tokens or sensitive data in web storage.
 * Expectation 9: SKIPPED - Base application does not set or manage session cookies.
 * Expectation 10: SKIPPED - Base application does not set cookies for cross-site embed contexts.
 * Expectation 11: SKIPPED - Base application does not contain third-party embeds or iframes.
 * Expectation 12: SKIPPED - Base application contains no third-party embeds.
 * Expectation 13: SKIPPED - Base application does not include third-party tracking SDKs or sharing integrations.
 * Expectation 14: SKIPPED - Base application does not implement federated third-party sign-in.
 * Expectation 15: TESTED - Restrictive Permissions-Policy HTTP header applies to any web application to disable unused features.
 * Expectation 16: TESTED - Privacy-preserving Referrer-Policy header/metadata applies to any web application.
 * Expectation 17: SKIPPED - Base application does not contain user-agent sniffing or device-detection scripts.
 * Expectation 18: SKIPPED - Base application does not perform browser fingerprinting.
 */

import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { SyntaxKind, type Project } from 'ts-morph';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

// @ts-ignore
const metaUrl = typeof import.meta !== 'undefined' ? (import.meta as any).url : undefined;
const currentFileUrl = metaUrl || (typeof __filename !== 'undefined' ? pathToFileURL(__filename).toString() : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).toString());

const targetFiles: string[] = getTargetFiles(currentFileUrl);

function checkClearSiteDataOnLogout(files: string[]): boolean {
  // Check JS/TS server files via ts-morph AST
  const project: Project = getJsProject(files);
  for (const sf of project.getSourceFiles()) {
    const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
    const literalValues = stringLiterals.map(s => s.getLiteralValue());
    const hasHeader = literalValues.some(v => v.toLowerCase() === 'clear-site-data');
    const hasLogout = literalValues.some(v => v.toLowerCase().includes('logout'));
    const validDirectives = ['cookies', 'storage', 'cache', '*', 'executioncontexts'];
    const hasDirective = literalValues.some(v => {
      const lower = v.toLowerCase();
      return validDirectives.some(d => lower.includes(d));
    });
    if (hasHeader && hasLogout && hasDirective) {
      return true;
    }
  }

  // Check header configuration files (e.g., _headers, .conf, .toml)
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const base = path.basename(file).toLowerCase();
    if (base === '_headers' || base.endsWith('.conf') || base.endsWith('.toml')) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      let inLogoutBlock = false;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        if (rawLine.startsWith('/') || rawLine.startsWith('[')) {
          inLogoutBlock = line.toLowerCase().includes('logout');
          continue;
        }
        if (inLogoutBlock && /clear-site-data\s*:/i.test(line)) {
          const val = line.toLowerCase();
          const validDirectives = ['cookies', 'storage', 'cache', '*', 'executioncontexts'];
          if (validDirectives.some(d => val.includes(d))) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function checkPermissionsPolicy(files: string[]): boolean {
  // Check HTML documents via Linkedom
  const docs = getHtmlDocuments(files);
  for (const { document } of docs) {
    const meta = document.querySelector('meta[http-equiv="Permissions-Policy" i]');
    if (meta) {
      const content = meta.getAttribute('content') || '';
      if (/geolocation=\(\)|camera=\(\)|microphone=\(\)/i.test(content)) {
        return true;
      }
    }
  }

  // Check JS/TS server files via ts-morph AST
  const project: Project = getJsProject(files);
  for (const sf of project.getSourceFiles()) {
    const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
    const literalValues = stringLiterals.map(s => s.getLiteralValue());
    const hasHeader = literalValues.some(v => v.toLowerCase() === 'permissions-policy');
    const hasRestrictiveDirective = literalValues.some(v =>
      /geolocation=\(\)|camera=\(\)|microphone=\(\)/i.test(v)
    );
    if (hasHeader && hasRestrictiveDirective) {
      return true;
    }
  }

  // Check header configuration files (e.g., _headers, .conf, .toml)
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const base = path.basename(file).toLowerCase();
    if (base === '_headers' || base.endsWith('.conf') || base.endsWith('.toml')) {
      const content = fs.readFileSync(file, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (/permissions-policy\s*:/i.test(trimmed)) {
          if (/geolocation=\(\)|camera=\(\)|microphone=\(\)/i.test(trimmed)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function checkReferrerPolicy(files: string[]): boolean {
  const privacyPolicies = [
    'strict-origin-when-cross-origin',
    'strict-origin',
    'same-origin',
    'no-referrer',
    'no-referrer-when-downgrade',
  ];

  // Check HTML documents via Linkedom
  const docs = getHtmlDocuments(files);
  for (const { document } of docs) {
    const meta = document.querySelector('meta[name="referrer" i], meta[http-equiv="Referrer-Policy" i]');
    if (meta) {
      const content = (meta.getAttribute('content') || '').toLowerCase().trim();
      if (privacyPolicies.some(p => content === p)) {
        return true;
      }
    }
  }

  // Check JS/TS server files via ts-morph AST
  const project: Project = getJsProject(files);
  for (const sf of project.getSourceFiles()) {
    const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
    const literalValues = stringLiterals.map(s => s.getLiteralValue());
    const hasHeader = literalValues.some(v => v.toLowerCase() === 'referrer-policy');
    const hasPolicy = literalValues.some(v => {
      const lower = v.toLowerCase().trim();
      return privacyPolicies.some(p => lower.includes(p));
    });
    if (hasHeader && hasPolicy) {
      return true;
    }
  }

  // Check header configuration files (e.g., _headers, .conf, .toml)
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const base = path.basename(file).toLowerCase();
    if (base === '_headers' || base.endsWith('.conf') || base.endsWith('.toml')) {
      const content = fs.readFileSync(file, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (/referrer-policy\s*:/i.test(trimmed)) {
          const val = trimmed.toLowerCase();
          if (privacyPolicies.some(p => val.includes(p))) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

test.describe('daily-grind Target Grader', () => {
  test('Expectation 5: Send Clear-Site-Data HTTP header on logout endpoints', () => {
    const hasClearSiteData = checkClearSiteDataOnLogout(targetFiles);
    expect(hasClearSiteData).toBe(true);
  });

  test('Expectation 15: Set restrictive Permissions-Policy to disable unused browser features by default', () => {
    const hasPermissionsPolicy = checkPermissionsPolicy(targetFiles);
    expect(hasPermissionsPolicy).toBe(true);
  });

  test('Expectation 16: Set privacy-preserving Referrer-Policy', () => {
    const hasReferrerPolicy = checkReferrerPolicy(targetFiles);
    expect(hasReferrerPolicy).toBe(true);
  });
});
