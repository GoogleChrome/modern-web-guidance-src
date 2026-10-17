import * as fs from 'node:fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import { CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

const project: Project = getJsProject(targetFiles);
for (const file of targetFiles) {
  if ((file.endsWith('.mjs') || file.endsWith('.cjs')) && fs.existsSync(file)) {
    project.createSourceFile(file, fs.readFileSync(file, 'utf8'), { overwrite: true });
  }
}

function getAllCspPolicies(): string[] {
  const policies: string[] = [];
  const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
  for (const { document } of docs) {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
    if (meta) {
      const content = meta.getAttribute('content');
      if (content) {
        policies.push(content);
      }
    }
  }
  for (const sf of project.getSourceFiles()) {
    for (const sl of sf.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      const val = sl.getLiteralText();
      if (val.includes('default-src') || val.includes('connect-src') || val.includes('form-action') || val.includes('worker-src')) {
        policies.push(val);
      }
    }
    for (const tl of sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      const val = tl.getLiteralText();
      if (val.includes('default-src') || val.includes('connect-src') || val.includes('form-action') || val.includes('worker-src')) {
        policies.push(val);
      }
    }
  }
  return policies;
}

test.describe('Restrict Outbound Connections (Connection-Allowlist) Target Grader', () => {

  // --- Requirement 1: Connection-Allowlist Header & RFC 9651 Inner List Format ---

  test('Configures Connection-Allowlist or Connection-Allowlist-Report-Only response header', () => {
    const hasAllowlistHeader = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(sl =>
        /^Connection-Allowlist(-Report-Only)?$/i.test(sl.getLiteralText())
      ) || sf.getText().includes('Connection-Allowlist')
    );
    expect(hasAllowlistHeader).toBe(true);
  });

  test('Serializes allowlist policy as an RFC 9651 inner list with space-separated entries', () => {
    const hasInnerListFormat = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      return (/\(\s*\$\{[^}]+\}\s*\)/.test(text) && /\.join\(\s*['"]\s*['"]\s*\)/.test(text)) ||
             /\(\s*response-origin(?:\s+"https?:\/\/[^"]+")*\s*\)/.test(text);
    });
    expect(hasInnerListFormat).toBe(true);
  });

  test('Includes response-origin as an unquoted token within the allowlist inner list', () => {
    const hasResponseOriginToken = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      const hasTokenLiteral = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(sl => sl.getLiteralText() === 'response-origin');
      const isNotQuotedAsPattern = !text.includes('"response-origin"') && !text.includes('\\"response-origin\\"');
      const hasUnquotedTokenInList = /\(\s*response-origin(?:\s+|\))/.test(text);
      return (hasTokenLiteral || hasUnquotedTokenInList) && isNotQuotedAsPattern;
    });
    expect(hasResponseOriginToken).toBe(true);
  });

  test('Encloses external URL patterns in double quotes inside the inner list', () => {
    const hasQuotedPatterns = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      return /`"[^`]*\$\{[^}]+\}[^`]*"`/.test(text) || /\(\s*response-origin\s+"https?:\/\//.test(text);
    });
    expect(hasQuotedPatterns).toBe(true);
  });

  // --- Requirement 2: URL Pattern Normalization & Constraints ---

  test('Normalizes WebSocket schemes or validates HTTP/HTTPS schemes for allowlist patterns', () => {
    const hasSchemeHandling = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      const hasStaticHttpPatterns = /\(\s*response-origin\s+"https?:\/\//.test(text) && !/\(\s*response-origin[^)]*"wss?:\/\//.test(text);
      return (text.includes('ws') && text.includes('http')) ||
             sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(sl => sl.getLiteralText().startsWith('https://')) ||
             hasStaticHttpPatterns;
    });
    expect(hasSchemeHandling).toBe(true);
  });

  test('Omits bare trailing slashes on origin-wide allowlist patterns to permit subpaths', () => {
    const hasOriginSlashHandling = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      const hasSlashStripper = /replace\([^)]*\/\\?\/[$i]/i.test(text) || /\/\\\$\/\s*,\s*['"]\$1['"]/.test(text);
      const hasCleanOriginPattern = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(sl =>
        /^https?:\/\/[^/?#]+$/.test(sl.getLiteralText())
      );
      const hasCleanOriginInHeader = /\(\s*response-origin[^)]*"https?:\/\/[^/?#"]+"/.test(text);
      return hasSlashStripper || hasCleanOriginPattern || hasCleanOriginInHeader;
    });
    expect(hasOriginSlashHandling).toBe(true);
  });

  test('Disallows custom regular expression groups in allowlist patterns', () => {
    const hasRegexRejection = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      const allowlistMatches = text.match(/\(\s*response-origin(?:\s+"https?:\/\/[^"]+")+\s*\)/g) || [];
      const avoidsCustomRegex = allowlistMatches.length > 0 && allowlistMatches.every(m => !/[()]/.test(m.replace(/^\(|\)$/g, '')));
      return /\[[^\]]*\([^)]*\)[^\]]*\]/.test(text) || /regex group/i.test(text) || /custom regex/i.test(text) || avoidsCustomRegex;
    });
    expect(hasRegexRejection).toBe(true);
  });

  // --- Requirement 3: Violation Reporting & report-to Parameter ---

  test('Defines the Reporting-Endpoints response header for violation reporting', () => {
    const hasReportingEndpoints = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(sl =>
        sl.getLiteralText().toLowerCase() === 'reporting-endpoints'
      ) || sf.getText().includes('Reporting-Endpoints')
    );
    expect(hasReportingEndpoints).toBe(true);
  });

  test('Appends an unquoted report-to parameter after the inner list closing parenthesis', () => {
    const hasReportTo = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      return /;\s*report-to=/i.test(text);
    });
    expect(hasReportTo).toBe(true);
  });

  // --- Requirement 4: Paired Content-Security-Policy Fallback Policy ---

  test('Includes default-src directive in paired Content-Security-Policy fallback', () => {
    const policies = getAllCspPolicies();
    const hasDefaultSrc = policies.some(p => /\bdefault-src\s+['"][^'"]+['"]/i.test(p));
    expect(hasDefaultSrc).toBe(true);
  });

  test('Includes connect-src directive in paired Content-Security-Policy fallback', () => {
    const policies = getAllCspPolicies();
    const hasConnectSrc = policies.some(p => /\bconnect-src\b/i.test(p));
    expect(hasConnectSrc).toBe(true);
  });

  test('Includes form-action directive in paired Content-Security-Policy fallback', () => {
    const policies = getAllCspPolicies();
    const hasFormAction = policies.some(p => /\bform-action\s+['"][^'"]+['"]/i.test(p));
    expect(hasFormAction).toBe(true);
  });

  test('Includes worker-src \'self\' directive in paired Content-Security-Policy fallback', () => {
    const policies = getAllCspPolicies();
    const hasWorkerSrc = policies.some(p => /\bworker-src\s+'self'/i.test(p));
    expect(hasWorkerSrc).toBe(true);
  });

  // --- Requirement 5: Outbound fetch Handling & Feedback ---

  test('Wraps outbound fetch calls in a try-catch block to handle policy rejections gracefully', () => {
    const hasTryCatchFetch = project.getSourceFiles().some(sf => {
      const tryStatements = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      return tryStatements.some(ts => {
        const tryText = ts.getTryBlock().getText();
        return /\bfetch\s*\(/.test(tryText);
      });
    });
    expect(hasTryCatchFetch).toBe(true);
  });

  test('Updates visible status feedback in catch handler when an outbound request is blocked', () => {
    const hasFeedbackInCatch = project.getSourceFiles().some(sf => {
      const tryStatements = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      return tryStatements.some(ts => {
        const tryText = ts.getTryBlock().getText();
        if (!/\bfetch\s*\(/.test(tryText)) return false;
        const catchClause = ts.getCatchClause();
        if (!catchClause) return false;
        const catchText = catchClause.getText();
        return /textContent|innerText|statusElement|status/i.test(catchText) &&
               /blocked|rejected|error|unavailable|policy/i.test(catchText);
      });
    });
    expect(hasFeedbackInCatch).toBe(true);
  });

  test('Provides a dedicated live region or status element in the DOM for connection feedback', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const statusEl = docs.map(d =>
      d.document.querySelector('[role="status"], [aria-live], #network-status, #connection-status')
    ).find(Boolean);
    expect(statusEl).toBeDefined();
  });

  test('Provides styled interactive buttons to initiate outbound connection policy checks', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const buttons = docs.flatMap(d =>
      Array.from(d.document.querySelectorAll('button'))
    );
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const hasButtonStyle = Array.from(stylesheet.cssRules).some(r =>
      r instanceof CSSStyleRule && (r.selectorText.includes('button') || r.selectorText.includes('.btn'))
    ) || buttons.some((b: any) => Boolean(b.classList?.length > 0 || b.getAttribute('class') || b.getAttribute('style')));
    expect(buttons.length > 0 && hasButtonStyle).toBe(true);
  });

});
