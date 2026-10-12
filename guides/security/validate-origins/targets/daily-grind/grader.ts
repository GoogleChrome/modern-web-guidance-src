import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const currentFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;

const targetFiles: string[] = getTargetFiles(currentFileUrl);

function isAppFile(sf: SourceFile): boolean {
  const base = path.basename(sf.getFilePath());
  return !base.includes('.test.') && !base.includes('.spec.') && !base.includes('.config.');
}

test.describe('Daily Grind Validate Origins Grader', () => {

  // Expectation 1: The application accepts cross-window messages or URLs that match the trusted reference origin,
  // including URLs with paths or explicit default ports (such as :443 on https:).
  test('accepts cross-window messages or URLs matching the trusted reference origin', () => {
    const project = getJsProject(targetFiles);
    const appFiles = project.getSourceFiles().filter(isAppFile);

    const hasOriginParsing = appFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
        const expr = c.getExpression().getText();
        return expr.endsWith('.from') || expr === 'from';
      })
    );
    const hasSameOriginCall = appFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
        const expr = c.getExpression().getText();
        return expr.endsWith('.isSameOrigin') || expr === 'isSameOrigin';
      })
    );
    const hasMessageHandling = appFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasListener = calls.some((c) => {
        const expr = c.getExpression().getText();
        return expr.endsWith('addEventListener') && c.getArguments().some((a) => a.getText().includes('message'));
      });
      const hasMessageEvent = sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === 'MessageEvent');
      return hasListener || hasMessageEvent;
    });
    const hasTrustedOriginRef = appFiles.some((sf) => {
      const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const hasTrustedString = literals.some((l) => l.getLiteralValue().includes('trusted-origin') || l.getLiteralValue().startsWith('https://'));
      const ids = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      const hasTrustedId = ids.some((id) => id.getText().includes('TRUSTED') || id.getText().includes('trusted'));
      return hasTrustedString || hasTrustedId;
    });

    const satisfiesExpectation = hasOriginParsing && hasSameOriginCall && hasMessageHandling && hasTrustedOriginRef;
    expect(satisfiesExpectation).toBe(true);
  });

  // Expectation 2: The application rejects cross-origin inputs that spoof the trusted domain as a hostname prefix
  // (such as https://app.trusted-origin.example.attacker.example).
  test('rejects cross-origin inputs that spoof the trusted domain as a hostname prefix', () => {
    const project = getJsProject(targetFiles);
    const appFiles = project.getSourceFiles().filter(isAppFile);

    const hasExactOriginCheck = appFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasSameOrigin = calls.some((c) => c.getExpression().getText().endsWith('isSameOrigin'));
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasExactOriginEq = binaryExprs.some((b) => {
        const op = b.getOperatorToken().getText();
        if (op !== '===' && op !== '==') return false;
        const left = b.getLeft().getText();
        const right = b.getRight().getText();
        return left.endsWith('.origin') && right.endsWith('.origin');
      });
      return hasSameOrigin || hasExactOriginEq;
    });
    const usesPrefixSpoofableCheck = appFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((c) => {
        const expr = c.getExpression().getText();
        if (!expr.endsWith('startsWith')) return false;
        const text = c.getText();
        return text.includes('trusted') || text.includes('origin');
      });
    });

    const satisfiesExpectation = hasExactOriginCheck && !usesPrefixSpoofableCheck;
    expect(satisfiesExpectation).toBe(true);
  });

  // Expectation 3: When enforcing same-origin validation, the application rejects URLs on a different subdomain
  // of the same registrable domain.
  test('rejects URLs on a different subdomain of the same registrable domain when enforcing same-origin validation', () => {
    const project = getJsProject(targetFiles);
    const appFiles = project.getSourceFiles().filter(isAppFile);

    const hasSameOriginBoundaryCheck = appFiles.some((sf) => {
      const fns = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ];
      return fns.some((fn) => {
        const fnName = 'getName' in fn && typeof (fn as { getName?: () => string | undefined }).getName === 'function'
          ? (fn as { getName: () => string | undefined }).getName() || ''
          : '';
        const text = fn.getText();
        const isTargetValidator = /sameorigin/i.test(fnName) || /sameorigin/i.test(text);
        if (!isTargetValidator) return false;
        const hasIsSameOrigin = fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => c.getExpression().getText().endsWith('isSameOrigin'));
        const hasOriginEquality = fn.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((b) => {
          const op = b.getOperatorToken().getText();
          return (op === '===' || op === '==') && b.getLeft().getText().includes('.origin') && b.getRight().getText().includes('.origin');
        });
        return hasIsSameOrigin || hasOriginEquality;
      });
    });

    expect(hasSameOriginBoundaryCheck).toBe(true);
  });

  // Expectation 4: When validating same-site redirects or links, the application accepts URLs on subdomains
  // that share both the scheme and the registrable domain.
  test('accepts URLs on subdomains sharing scheme and registrable domain when validating same-site redirects or links', () => {
    const project = getJsProject(targetFiles);
    const appFiles = project.getSourceFiles().filter(isAppFile);

    const hasSameSiteCheck = appFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
        const expr = c.getExpression().getText();
        return expr.endsWith('.isSameSite') || expr === 'isSameSite';
      })
    );

    expect(hasSameSiteCheck).toBe(true);
  });

  // Expectation 5: When validating same-site redirects or links, the application rejects scheme downgrades
  // from https: to http: on the same domain.
  test('rejects scheme downgrades from https: to http: when validating same-site redirects or links', () => {
    const project = getJsProject(targetFiles);
    const appFiles = project.getSourceFiles().filter(isAppFile);

    const hasSameSiteWithProtocol = appFiles.some((sf) => {
      const hasSameSite = sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
        const expr = c.getExpression().getText();
        return expr.endsWith('.isSameSite') || expr === 'isSameSite';
      });
      const hasProtocolVerification = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((pa) => pa.getName() === 'protocol') ||
        sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((b) => b.getText().includes('protocol'));
      return hasSameSite && hasProtocolVerification;
    });

    expect(hasSameSiteWithProtocol).toBe(true);
  });

  // Expectation 6: The application rejects malformed URL strings and unpinned opaque origins
  // (such as data: URLs or "null" origin strings) without throwing uncaught exceptions.
  test('rejects malformed URL strings and unpinned opaque origins without throwing uncaught exceptions', () => {
    const project = getJsProject(targetFiles);
    const appFiles = project.getSourceFiles().filter(isAppFile);

    const hasMalformedHandling = appFiles.some((sf) => {
      const tryStmts = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      const hasSafeCatch = tryStmts.some((t) => {
        const catchClause = t.getCatchClause();
        if (!catchClause) return false;
        const returns = catchClause.getDescendantsOfKind(SyntaxKind.ReturnStatement);
        return returns.some((r) => r.getExpression()?.getKind() === SyntaxKind.FalseKeyword || r.getExpression()?.getKind() === SyntaxKind.NullKeyword);
      });
      const hasOpaqueGuard = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((pa) => pa.getName() === 'opaque') ||
        sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((sl) => sl.getLiteralValue() === 'null');
      return hasSafeCatch && hasOpaqueGuard;
    });

    expect(hasMalformedHandling).toBe(true);
  });

  // Expectation 7: When pinning a sandboxed iframe sender, subsequent messages from that same sandboxed iframe
  // are accepted while messages from a different sandboxed iframe on the page are rejected.
  test('accepts subsequent messages from pinned sandboxed iframe while rejecting different sandboxed iframes', () => {
    const project = getJsProject(targetFiles);
    const appFiles = project.getSourceFiles().filter(isAppFile);

    const hasSandboxPinningMechanism = appFiles.some((sf) => {
      const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
      const hasOpaqueSentinel = newExprs.some((n) => {
        const name = n.getExpression().getText();
        return name === 'Origin' || name === 'api';
      });
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasExtractOriginFromEvent = calls.some((c) => {
        const expr = c.getExpression().getText();
        return (expr.endsWith('.from') || expr === 'from') && c.getArguments().some((a) => a.getText() === 'event');
      });
      const hasSameOriginComparison = calls.some((c) => c.getExpression().getText().endsWith('isSameOrigin'));
      const hasInitCheck = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((sl) => sl.getLiteralValue() === 'init');
      return (hasOpaqueSentinel || hasExtractOriginFromEvent) && hasSameOriginComparison && hasInitCheck;
    });

    expect(hasSandboxPinningMechanism).toBe(true);
  });

  // Expectation 8: When globalThis.Origin is removed before the page's scripts run, the application
  // still accepts trusted inputs and rejects spoofed, scheme-downgraded, or "null" inputs via a URL-based fallback.
  test('falls back to URL-based validation when globalThis.Origin is removed', () => {
    const project = getJsProject(targetFiles);
    const appFiles = project.getSourceFiles().filter(isAppFile);

    const hasUrlFallbackImplementation = appFiles.some((sf) => {
      const hasFeatureCheck = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((b) => {
        const op = b.getOperatorToken().getText();
        const text = b.getText();
        return (op === 'in' && text.includes('Origin')) || text.includes('typeof Origin') || text.includes('Origin !==') || text.includes('Origin !=');
      }) || sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === 'hasOriginApi' || id.getText() === 'HAS_ORIGIN' || id.getText() === 'originApi');

      const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
      const hasNewUrl = newExprs.some((n) => n.getExpression().getText() === 'URL');

      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasTupleCheck = binaryExprs.some((b) => {
        const text = b.getText();
        return text.includes('.origin') && (text.includes('===') || text.includes('!==') || text.includes('!='));
      });

      return hasFeatureCheck && hasNewUrl && hasTupleCheck;
    });

    expect(hasUrlFallbackImplementation).toBe(true);
  });
});
