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
import {
  SyntaxKind,
  type Node,
  type NoSubstitutionTemplateLiteral,
  type Project,
  type StringLiteral,
} from 'ts-morph';
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

type HeaderNameLiteral = StringLiteral | NoSubstitutionTemplateLiteral;

const CLEAR_SITE_DATA_VALUE_RE = /["']?(cookies|storage|cache|\*|executioncontexts)["']?/i;
const PERMISSIONS_POLICY_VALUE_RE = /geolocation=\(\)|camera=\(\)|microphone=\(\)/i;
const REFERRER_POLICY_VALUE_RE = /\b(strict-origin-when-cross-origin|strict-origin|same-origin|no-referrer)\b(?!-when-downgrade)/i;

function getLoadedProject(files: string[]): Project {
  const project: Project = getJsProject(files);
  for (const file of files) {
    if (/\.(m|c)?js$/i.test(file) && !project.getSourceFile(file) && fs.existsSync(file) && !fs.statSync(file).isDirectory()) {
      project.createSourceFile(file, fs.readFileSync(file, 'utf8'), { overwrite: true });
    }
  }
  return project;
}

function resolveValueNodeText(node: Node | undefined): string {
  if (!node) return '';
  if (node.isKind(SyntaxKind.Identifier)) {
    const identName = node.getText();
    const sf = node.getSourceFile();
    for (const varDecl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      if (varDecl.getName() === identName) {
        const init = varDecl.getInitializer();
        if (init) {
          return `${node.getText()} ${init.getText()}`;
        }
      }
    }
  }
  return node.getText();
}

function pairedHeaderValueText(nameLiteral: HeaderNameLiteral): string {
  const parent: Node | undefined = nameLiteral.getParent();
  if (!parent) return '';

  if (parent.isKind(SyntaxKind.CallExpression)) {
    const args = parent.getArguments();
    if (args.length >= 2 && args[0] === nameLiteral) {
      return args.slice(1).map(a => resolveValueNodeText(a)).join(' ');
    }
    return '';
  }
  if (parent.isKind(SyntaxKind.PropertyAssignment)) {
    if (parent.getNameNode() === nameLiteral) return resolveValueNodeText(parent.getInitializer());
    const obj = parent.getParentIfKind(SyntaxKind.ObjectLiteralExpression);
    return obj ? obj.getProperties().filter(p => p !== parent).map(p => resolveValueNodeText(p)).join(' ') : '';
  }
  if (parent.isKind(SyntaxKind.ArrayLiteralExpression)) {
    const els = parent.getElements();
    if (els.length === 2 && els[0] === nameLiteral) {
      return resolveValueNodeText(els[1]);
    }
    return '';
  }
  if (parent.isKind(SyntaxKind.ElementAccessExpression)) {
    const assignment = parent.getParentIfKind(SyntaxKind.BinaryExpression);
    return assignment ? resolveValueNodeText(assignment.getRight()) : '';
  }
  return '';
}

function isInsideLogoutHandler(node: Node): boolean {
  for (const ancestor of node.getAncestors()) {
    if (ancestor.isKind(SyntaxKind.IfStatement)) {
      if (/logout/i.test(ancestor.getExpression().getText())) return true;
    }
    if (ancestor.isKind(SyntaxKind.CaseClause)) {
      if (/logout/i.test(ancestor.getExpression().getText())) return true;
    }
    if (ancestor.isKind(SyntaxKind.CallExpression)) {
      const exprText = ancestor.getExpression().getText();
      const firstArg = ancestor.getArguments()[0]?.getText() ?? '';
      if (/logout/i.test(firstArg) && !/headers?|writehead/i.test(exprText)) return true;
    }
    if (ancestor.isKind(SyntaxKind.FunctionDeclaration) || ancestor.isKind(SyntaxKind.VariableDeclaration)) {
      const name = ancestor.getName?.();
      if (name && /logout/i.test(name)) return true;
    }
  }
  return false;
}

function checkClearSiteDataOnLogout(files: string[]): boolean {
  // Check JS/TS server files via ts-morph AST
  const project: Project = getLoadedProject(files);
  for (const sf of project.getSourceFiles()) {
    const literals: HeaderNameLiteral[] = [
      ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
      ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
    ];
    for (const literal of literals) {
      if (literal.getLiteralValue().toLowerCase() !== 'clear-site-data') continue;
      const valueText = pairedHeaderValueText(literal);
      if (CLEAR_SITE_DATA_VALUE_RE.test(valueText) && isInsideLogoutHandler(literal)) {
        return true;
      }
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
          if (CLEAR_SITE_DATA_VALUE_RE.test(line)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function checkPermissionsPolicy(files: string[]): boolean {
  // Permissions-Policy is HTTP-header-only (browsers ignore <meta http-equiv="Permissions-Policy">).
  // Check JS/TS server files via ts-morph AST
  const project: Project = getLoadedProject(files);
  for (const sf of project.getSourceFiles()) {
    const literals: HeaderNameLiteral[] = [
      ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
      ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
    ];
    for (const literal of literals) {
      if (literal.getLiteralValue().toLowerCase() !== 'permissions-policy') continue;
      if (PERMISSIONS_POLICY_VALUE_RE.test(pairedHeaderValueText(literal))) {
        return true;
      }
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
        if (/permissions-policy\s*:/i.test(trimmed) && PERMISSIONS_POLICY_VALUE_RE.test(trimmed)) {
          return true;
        }
      }
    }
  }

  return false;
}

function checkReferrerPolicy(files: string[]): boolean {
  // Check HTML documents via Linkedom (<meta name="referrer"> is valid HTML; http-equiv is ignored)
  const docs = getHtmlDocuments(files);
  for (const { document } of docs) {
    const meta = document.querySelector('meta[name="referrer" i]');
    if (meta) {
      const content = (meta.getAttribute('content') || '').trim();
      if (REFERRER_POLICY_VALUE_RE.test(content)) {
        return true;
      }
    }
  }

  // Check JS/TS server files via ts-morph AST
  const project: Project = getLoadedProject(files);
  for (const sf of project.getSourceFiles()) {
    const literals: HeaderNameLiteral[] = [
      ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
      ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
    ];
    for (const literal of literals) {
      if (literal.getLiteralValue().toLowerCase() !== 'referrer-policy') continue;
      if (REFERRER_POLICY_VALUE_RE.test(pairedHeaderValueText(literal))) {
        return true;
      }
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
        if (/referrer-policy\s*:/i.test(trimmed) && REFERRER_POLICY_VALUE_RE.test(trimmed)) {
          return true;
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
