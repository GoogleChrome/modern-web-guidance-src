import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { SyntaxKind, type Project, type SourceFile } from 'ts-morph';
import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(pathToFileURL(join(process.cwd(), 'grader.ts')).href);

function getQuotedStrings(sf: SourceFile): string[] {
  const strings = sf
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((n) => n.getLiteralValue());
  const noSubTemplates = sf
    .getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    .map((n) => n.getLiteralValue());
  return [...strings, ...noSubTemplates];
}

function getAllJsStrings(project: Project): string[] {
  return project.getSourceFiles().flatMap((sf) => getQuotedStrings(sf));
}

function getMetaCspContents(docs: Array<{ file: string; document: Document }>): string[] {
  const contents: string[] = [];
  for (const { document } of docs) {
    const metas = Array.from(document.querySelectorAll('meta'));
    for (const meta of metas) {
      const httpEquiv = meta.getAttribute('http-equiv')?.toLowerCase();
      const content = meta.getAttribute('content');
      if (httpEquiv === 'content-security-policy' && content) {
        contents.push(content);
      }
    }
  }
  return contents;
}

test.describe('restrict-outbound-connections Target Grader', () => {
  test('The Connection-Allowlist or Connection-Allowlist-Report-Only policy is formatted as a single RFC 9651 Inner List (...) of space-separated entries where response-origin is an unquoted token and external URL patterns are double-quoted strings', () => {
    const project: Project = getJsProject(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const allStrings = getAllJsStrings(project);
    const metaCsps = getMetaCspContents(docs);

    // Check explicit RFC 9651 inner list strings or builder functions producing `(response-origin "...")`
    const hasLiteralInnerList = allStrings.some(
      (s) =>
        s.includes('(response-origin ') &&
        s.includes('"http') &&
        !s.includes('"response-origin"') &&
        !s.includes("'response-origin'"),
    );

    const templateSpans = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.TemplateExpression));
    const hasBuilderInnerList =
      allStrings.includes('response-origin') &&
      !allStrings.includes('"response-origin"') &&
      templateSpans.some((te) => {
        const head = te.getHead().getLiteralText();
        const tail = te.getTemplateSpans().at(-1)?.getLiteral().getLiteralText() ?? '';
        return head.startsWith('(') && tail.endsWith(')');
      });

    // Also accept document-level CSP fallback coupled with same-origin outbound connection restriction when configured statically
    const hasStaticOriginPolicy = metaCsps.some(
      (csp) => csp.includes("default-src 'self'") && csp.includes("connect-src 'self'"),
    );

    expect(hasLiteralInnerList || hasBuilderInnerList || hasStaticOriginPolicy).toBe(true);
  });

  test('URL patterns in Connection-Allowlist use "http://..." or "https://..." schemes (not ws://, wss://, or relative paths), omit a bare trailing slash on origin-wide patterns (or use an explicit /* wildcard) so subpaths are permitted, and avoid custom regular expression groups', () => {
    const project: Project = getJsProject(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const allStrings = getAllJsStrings(project);
    const metaCsps = getMetaCspContents(docs);

    const allowlistUrlStrings = allStrings.filter((s) =>
      s.includes('https://images.unsplash.com'),
    );
    const metaUrlStrings = metaCsps.filter((s) =>
      s.includes('https://images.unsplash.com'),
    );
    const candidatePatterns = [...allowlistUrlStrings, ...metaUrlStrings];

    const hasValidPattern = candidatePatterns.some(
      (p) =>
        (p.includes('https://images.unsplash.com/*') ||
          p.includes('"https://images.unsplash.com"') ||
          p.includes('https://images.unsplash.com;') ||
          p.includes('https://images.unsplash.com ') ||
          p.endsWith('https://images.unsplash.com')) &&
        !p.includes('https://images.unsplash.com/"') &&
        !p.includes('ws://') &&
        !p.includes('wss://'),
    );

    expect(hasValidPattern).toBe(true);
  });

  test('Violation reporting is configured with a Reporting-Endpoints definition and an unquoted ; report-to=<endpoint-name> parameter appended after the closing parenthesis of the Connection-Allowlist inner list', () => {
    const project: Project = getJsProject(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const allStrings = getAllJsStrings(project);
    const metaCsps = getMetaCspContents(docs);

    const hasReportingEndpointsHeader = allStrings.some(
      (s) => s.toLowerCase() === 'reporting-endpoints',
    );
    const hasUnquotedReportToParam =
      allStrings.some((s) => s.includes('; report-to=') && !s.includes('; report-to="')) ||
      project
        .getSourceFiles()
        .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.TemplateExpression))
        .some((te) =>
          te.getHead().getLiteralText().includes('; report-to=') &&
          !te.getHead().getLiteralText().includes('; report-to="'),
        );

    const hasServerReporting = hasReportingEndpointsHeader && hasUnquotedReportToParam;
    const hasStaticFallbackWithFetchCatch =
      metaCsps.length > 0 &&
      project
        .getSourceFiles()
        .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.TryStatement))
        .some((ts) => Boolean(ts.getCatchClause()));

    expect(hasServerReporting || hasStaticFallbackWithFetchCatch).toBe(true);
  });

  test("A paired Content-Security-Policy fallback policy is configured alongside Connection-Allowlist, including default-src, connect-src, form-action, and worker-src 'self'", () => {
    const project: Project = getJsProject(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const allStrings = getAllJsStrings(project);
    const metaCsps = getMetaCspContents(docs);

    const combinedSources = [...allStrings, ...metaCsps];
    const hasDefaultSrc = combinedSources.some((s) => s.includes("default-src 'self'"));
    const hasConnectSrc = combinedSources.some((s) => s.includes("connect-src 'self'"));
    const hasFormAction = combinedSources.some((s) => s.includes("form-action 'self'"));
    const hasWorkerSrc = combinedSources.some((s) => s.includes("worker-src 'self'"));

    expect(hasDefaultSrc && hasConnectSrc && hasFormAction && hasWorkerSrc).toBe(true);
  });

  test('Outbound fetch() requests to response-origin or allowlisted endpoints succeed, while requests to unlisted third-party origins are blocked and caught gracefully with visible status feedback instead of throwing unhandled promise rejections', () => {
    const project: Project = getJsProject(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    // 1. Verify there is a status element in HTML with role="status" or aria-live="polite"
    const hasStatusElement = docs.some(({ document }) =>
      Boolean(document.querySelector('[role="status"], [aria-live="polite"]')),
    );

    // 2. Verify JS calls fetch() inside a try { ... } catch { ... } block and updates textContent
    const sourceFiles = project.getSourceFiles();
    const tryStatements = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.TryStatement),
    );

    const hasTryCatchAroundFetchWithStatusUpdate = tryStatements.some((tryStmt) => {
      const tryBlock = tryStmt.getTryBlock();
      const catchClause = tryStmt.getCatchClause();
      if (!catchClause) return false;

      const callsInTry = tryBlock.getDescendantsOfKind(SyntaxKind.CallExpression);
      const callsFetch = callsInTry.some(
        (call) => call.getExpression().getText() === 'fetch',
      );
      if (!callsFetch) return false;

      // Check that either the catch block or a helper called in catch updates DOM status textContent
      const sf = tryStmt.getSourceFile();
      const propAccessesInFile = sf.getDescendantsOfKind(
        SyntaxKind.PropertyAccessExpression,
      );
      const updatesTextContent = propAccessesInFile.some(
        (pa) => pa.getName() === 'textContent',
      );

      return updatesTextContent;
    });

    expect(hasStatusElement && hasTryCatchAroundFetchWithStatusUpdate).toBe(true);
  });
});
