import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';

// @ts-ignore - package.json may omit "type": "module" in base app
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getStringValues(project: Project): string[] {
  const values: string[] = [];
  for (const sf of project.getSourceFiles()) {
    for (const lit of sf.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      values.push(lit.getLiteralValue());
    }
    for (const lit of sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      values.push(lit.getLiteralValue());
    }
    for (const tmpl of sf.getDescendantsOfKind(SyntaxKind.TemplateExpression)) {
      values.push(tmpl.getText().slice(1, -1));
    }
  }
  return values;
}

test.describe('restrict-outbound-connections Target Grader', () => {
  test('The Connection-Allowlist or Connection-Allowlist-Report-Only policy is formatted as a single RFC 9651 Inner List (...) of space-separated entries where response-origin is an unquoted token and external URL patterns are double-quoted strings', () => {
    const project: Project = getJsProject(targetFiles);
    const strings = getStringValues(project);

    const hasHeaderName = strings.some((s) =>
      /^Connection-Allowlist(-Report-Only)?$/i.test(s.trim()),
    );
    const hasResponseOriginToken = strings.some(
      (s) => s === 'response-origin' || /\(\s*response-origin\b/.test(s),
    );
    const hasInnerListWithQuotedPatterns =
      strings.some((s) => /^\(\s*response-origin(?:\s+"[^"]+")+\s*\)/.test(s)) ||
      (strings.some((s) => s.includes('(') && s.includes(')')) &&
        strings.some((s) => s.includes('"')));

    expect(
      hasHeaderName && hasResponseOriginToken && hasInnerListWithQuotedPatterns,
    ).toBe(true);
  });

  test('URL patterns in Connection-Allowlist use "http://..." or "https://..." schemes, omit a bare trailing slash on origin-wide patterns (or use an explicit /* wildcard) so subpaths are permitted, and avoid custom regular expression groups', () => {
    const project: Project = getJsProject(targetFiles);
    const strings = getStringValues(project);

    const extractedPatterns: string[] = [];
    for (const s of strings) {
      if (/^https?:\/\/[^\s"';)]+$/i.test(s.trim())) {
        extractedPatterns.push(s.trim());
      }
      const innerListMatch = s.match(/^\(\s*response-origin\s+([^)]+)\)/);
      if (innerListMatch && innerListMatch[1]) {
        const quotedMatches = innerListMatch[1].matchAll(/"([^"]+)"/g);
        for (const match of quotedMatches) {
          if (match[1]) {
            extractedPatterns.push(match[1].trim());
          }
        }
      }
    }

    const hasValidAllowlistPatterns =
      extractedPatterns.some((p) => p.includes('images.unsplash.com')) &&
      extractedPatterns.every(
        (p) =>
          /^https?:\/\//i.test(p) &&
          !/^(https?:\/\/[^/?#]+)\/$/i.test(p) &&
          !/[()]/.test(p),
      );

    expect(hasValidAllowlistPatterns).toBe(true);
  });

  test('Violation reporting is configured with a Reporting-Endpoints definition and an unquoted ; report-to=<endpoint-name> parameter appended after the closing parenthesis of the Connection-Allowlist inner list', () => {
    const project: Project = getJsProject(targetFiles);
    const strings = getStringValues(project);

    const hasReportingEndpointsHeader = strings.some(
      (s) => s.trim().toLowerCase() === 'reporting-endpoints',
    );
    const hasEndpointDefinition =
      strings.some((s) =>
        /(?:[a-zA-Z0-9_-]+|\$\{[^}]+\})="\s*(?:https?:\/\/|\/|\$\{[^}]+\})[^"]*"/.test(
          s,
        ),
      ) && strings.some((s) => /(?:https?:\/\/|\/)[a-zA-Z0-9_/-]+/.test(s));
    const hasUnquotedReportToParam = strings.some(
      (s) =>
        /\)\s*;\s*report-to=[a-zA-Z0-9_-]+/.test(s) ||
        (/;\s*report-to=\$?\{?[a-zA-Z0-9_.-]+\}?/.test(s) &&
          !/report-to=["']/.test(s)),
    );

    expect(
      hasReportingEndpointsHeader &&
        hasEndpointDefinition &&
        hasUnquotedReportToParam,
    ).toBe(true);
  });

  test("A paired Content-Security-Policy fallback policy is configured alongside Connection-Allowlist, including default-src, connect-src, form-action, and worker-src 'self'", () => {
    const project: Project = getJsProject(targetFiles);
    const docs: Array<{ file: string; document: Document }> =
      getHtmlDocuments(targetFiles);
    const strings = getStringValues(project);

    const metaContents = docs.flatMap((d) =>
      Array.from(
        d.document.querySelectorAll(
          'meta[http-equiv="Content-Security-Policy"]',
        ),
      ).map((el) => el.getAttribute('content') || ''),
    );

    const allPolicyStrings = [...strings, ...metaContents];

    const hasCspHeaderOrMeta =
      strings.some((s) =>
        /^Content-Security-Policy(-Report-Only)?$/i.test(s.trim()),
      ) || metaContents.length > 0;
    const hasDefaultSrc = allPolicyStrings.some((s) =>
      /\bdefault-src\s+'self'/.test(s),
    );
    const hasConnectSrc = allPolicyStrings.some((s) =>
      /\bconnect-src\s+'self'/.test(s),
    );
    const hasFormAction = allPolicyStrings.some((s) =>
      /\bform-action\s+'self'/.test(s),
    );
    const hasWorkerSrcSelf = allPolicyStrings.some((s) =>
      /\bworker-src\s+'self'/.test(s),
    );

    expect(
      hasCspHeaderOrMeta &&
        hasDefaultSrc &&
        hasConnectSrc &&
        hasFormAction &&
        hasWorkerSrcSelf,
    ).toBe(true);
  });

  test('Outbound fetch() requests to response-origin or allowlisted endpoints succeed, while requests to unlisted third-party origins are blocked and caught gracefully with visible status feedback instead of throwing unhandled promise rejections', () => {
    const project: Project = getJsProject(targetFiles);
    const docs: Array<{ file: string; document: Document }> =
      getHtmlDocuments(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const tryStatements = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.TryStatement),
    );

    const hasFetchInsideTryCatchWithFeedback = tryStatements.some((tryStmt) => {
      const tryBlock = tryStmt.getTryBlock();
      const catchClause = tryStmt.getCatchClause();
      if (!catchClause) return false;

      const hasFetchCall = tryBlock
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => call.getExpression().getText() === 'fetch');

      const catchBlock = catchClause.getBlock();
      const updatesUiOrHandlesError =
        catchBlock
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((prop) =>
            ['textContent', 'innerText', 'innerHTML', 'hidden'].includes(
              prop.getName(),
            ),
          ) ||
        catchBlock.getDescendantsOfKind(SyntaxKind.CallExpression).length > 0 ||
        catchBlock.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;

      return hasFetchCall && updatesUiOrHandlesError;
    });

    const hasLiveStatusElement = docs.some((d) =>
      Boolean(
        d.document.querySelector('[role="status"], [aria-live], #newsletter-status'),
      ),
    );

    expect(hasFetchInsideTryCatchWithFeedback && hasLiveStatusElement).toBe(
      true,
    );
  });
});
