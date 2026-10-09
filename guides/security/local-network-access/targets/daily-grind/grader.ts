import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Daily Grind Local Network Access Grader', () => {

  // --- STATIC ASSERTIONS ---

  test('queries granular local-network or loopback-network permission via navigator.permissions.query', () => {
    const project = getJsProject(targetFiles);
    const queryCalls = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).filter(call => {
      const exprText = call.getExpression().getText();
      return exprText.endsWith('permissions.query') || exprText === 'query';
    });
    const stringLiterals = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    ).map(s => s.getLiteralValue());
    const hasGranularPermissionQuery = queryCalls.length > 0 &&
      stringLiterals.some(s => s === 'local-network' || s === 'loopback-network');

    expect(hasGranularPermissionQuery).toBe(true);
  });

  test('implements fallback error handling when permission name is unrecognized', () => {
    const project = getJsProject(targetFiles);
    const queryCalls = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).filter(call => {
      const exprText = call.getExpression().getText();
      return exprText.endsWith('permissions.query') || exprText === 'query';
    });
    const hasFallbackHandling = queryCalls.some(call => {
      const hasTryAncestor = Boolean(call.getFirstAncestorByKind(SyntaxKind.TryStatement));
      const hasCatchCall = Boolean(call.getParent()?.getText().includes('.catch'));
      return hasTryAncestor || hasCatchCall;
    });

    expect(hasFallbackHandling).toBe(true);
  });

  test('never queries the legacy local-network-access permission name', () => {
    const project = getJsProject(targetFiles);
    const queryCalls = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).filter(call => {
      const exprText = call.getExpression().getText();
      return exprText.endsWith('permissions.query') || exprText === 'query';
    });
    const stringLiterals = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    ).map(s => s.getLiteralValue());
    const hasGranularQuery = queryCalls.length > 0 &&
      stringLiterals.some(s => s === 'local-network' || s === 'loopback-network');
    const queriesLegacyName = stringLiterals.includes('local-network-access') ||
      queryCalls.some(call => call.getText().includes('local-network-access'));
    const neverQueriesLegacy = hasGranularQuery && !queriesLegacyName;

    expect(neverQueriesLegacy).toBe(true);
  });

  test('specifies targetAddressSpace local for local network endpoint requests', () => {
    const project = getJsProject(targetFiles);
    const propAssignments = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    );
    const stringLiterals = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    ).map(s => s.getLiteralValue());
    const hasTargetAddressSpaceProp = propAssignments.some(p => p.getName() === 'targetAddressSpace');
    const hasLocalTargetAddressSpace = hasTargetAddressSpaceProp && stringLiterals.includes('local');

    expect(hasLocalTargetAddressSpace).toBe(true);
  });

  test('specifies targetAddressSpace loopback for loopback endpoint requests', () => {
    const project = getJsProject(targetFiles);
    const propAssignments = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    );
    const stringLiterals = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    ).map(s => s.getLiteralValue());
    const hasTargetAddressSpaceProp = propAssignments.some(p => p.getName() === 'targetAddressSpace');
    const hasLoopbackTargetAddressSpace = hasTargetAddressSpaceProp && stringLiterals.includes('loopback');

    expect(hasLoopbackTargetAddressSpace).toBe(true);
  });

  test('provides interactive controls to trigger local and loopback connections on user gesture', () => {
    const docs = getHtmlDocuments(targetFiles);
    const interactiveElements = docs.flatMap(d =>
      Array.from(d.document.querySelectorAll('button, [type="submit"], [role="button"], form[data-connection]'))
    );
    const hasInteractiveControls = interactiveElements.length > 0 && docs.some(d => {
      const hasTrigger = Boolean(d.document.querySelector('button, [type="submit"], form[data-connection]'));
      const hasConnectionContext = Boolean(
        d.document.querySelector('[data-permission-status], [data-connection], [id*="local"], [id*="loopback"]')
      );
      return hasTrigger && hasConnectionContext;
    });

    expect(hasInteractiveControls).toBe(true);
  });

  test('does not fire requests automatically on page load when permission state is prompt', () => {
    const project = getJsProject(targetFiles);
    const stringLiterals = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    ).map(s => s.getLiteralValue());
    const eventListeners = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).filter(call => call.getExpression().getText().endsWith('addEventListener'));
    const hasGestureListener = eventListeners.some(call => {
      const text = call.getText();
      return text.includes('"click"') || text.includes("'click'") ||
             text.includes('"submit"') || text.includes("'submit'");
    });
    const hasPermissionStateGating = stringLiterals.includes('prompt') || stringLiterals.includes('granted');
    const gatedOnUserInteraction = hasGestureListener && hasPermissionStateGating;

    expect(gatedOnUserInteraction).toBe(true);
  });

  test('provides visible error or remediation feedback elements in the UI', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasRemediationElement = docs.some(d =>
      Boolean(d.document.querySelector('[data-remediation], [data-error], .remediation, [role="alert"]'))
    );
    const hasRemediationStyles = rules.some(r =>
      r instanceof CSSStyleRule && /remediation|error|feedback/i.test(r.selectorText)
    );
    const hasVisibleRemediationFeedback = hasRemediationElement || hasRemediationStyles;

    expect(hasVisibleRemediationFeedback).toBe(true);
  });

  test('catches local and loopback request failures without unhandled promise rejections', () => {
    const project = getJsProject(targetFiles);
    const fetchCalls = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).filter(call => {
      const exprText = call.getExpression().getText();
      return exprText === 'fetch' || exprText.endsWith('.fetch');
    });
    const hasCatchClause = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CatchClause)
    ).length > 0;
    const catchesConnectionFailures = fetchCalls.length > 0 && hasCatchClause;

    expect(catchesConnectionFailures).toBe(true);
  });

  test('delegates local-network or loopback-network permissions on embedded iframes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const iframes = docs.flatMap(d => Array.from<any>(d.document.querySelectorAll('iframe')));
    const hasNetworkFeatures = docs.some(d =>
      Boolean(d.document.querySelector('[data-permission-status], [data-remediation], [data-connection], [id*="local"], [id*="loopback"]'))
    );
    const delegatesIframePermissions = hasNetworkFeatures &&
      iframes.every(iframe => {
        const allow = (iframe as any).getAttribute?.('allow') || '';
        return allow.includes('local-network') || allow.includes('loopback-network');
      });

    expect(delegatesIframePermissions).toBe(true);
  });
});
