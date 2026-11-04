import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Local Network Access Target Grader', () => {
  test('queries granular permission (local-network or loopback-network) via navigator.permissions.query with fallback error handling', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasGranularQueryWithFallback = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const queryCalls = calls.filter((c) => {
        const text = c.getExpression().getText();
        return text.includes('permissions') && text.includes('query');
      });
      if (queryCalls.length === 0) return false;

      const hasFallback = queryCalls.some((qc) => {
        const inTry = Boolean(qc.getFirstAncestorByKind(SyntaxKind.TryStatement));
        const inCatch = qc.getExpression().getText().endsWith('.catch');
        return inTry || inCatch;
      });
      return hasFallback;
    }) && sourceFiles.some((sf) => {
      return sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((s) => {
        const val = s.getLiteralValue();
        return val === 'local-network' || val === 'loopback-network';
      });
    });

    expect(hasGranularQueryWithFallback).toBe(true);
  });

  test('never queries the legacy local-network-access permission name via navigator.permissions.query', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const queryCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((c) => {
        const text = c.getExpression().getText();
        return text.includes('permissions') && text.includes('query');
      })
    );

    const queriesLegacy = sourceFiles.some((sf) => {
      return sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
        const text = c.getExpression().getText();
        return text.includes('query') && c.getText().includes('local-network-access');
      });
    });

    const legacyAvoided = queryCalls.length > 0 && !queriesLegacy;
    expect(legacyAvoided).toBe(true);
  });

  test('specifies targetAddressSpace for local network and loopback requests', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const targetAddressSpaceProps = sourceFiles.flatMap((sf) => {
      const props = sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .filter((p) => p.getName() === 'targetAddressSpace');
      const shorthandProps = sf.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
        .filter((p) => p.getName() === 'targetAddressSpace');
      return [...props, ...shorthandProps];
    });

    const hasLocal = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((s) => s.getLiteralValue() === 'local')
    );
    const hasLoopback = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((s) => s.getLiteralValue() === 'loopback')
    );

    const specifiesBothAddressSpaces = targetAddressSpaceProps.length > 0 && hasLocal && hasLoopback;
    expect(specifiesBothAddressSpaces).toBe(true);
  });

  test('gates local network and loopback requests on user interaction when permission state is prompt', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasLna = sourceFiles.some((sf) =>
      sf.getText().includes('local-network') || sf.getText().includes('targetAddressSpace')
    );

    const hasInteractionTrigger = sourceFiles.some((sf) => {
      const jsxElements = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
      return jsxElements.some((el) => {
        const tagName = el.getTagNameNode().getText();
        const hasActionAttr = el.getAttributes().some((attr) => {
          const name = attr.getText();
          return name.startsWith('onClick') || name.startsWith('onSubmit');
        });
        return (tagName === 'button' || tagName === 'form') && (hasActionAttr || tagName === 'button');
      });
    });

    const guardsPromptState = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const useEffectCalls = calls.filter((c) => c.getExpression().getText().endsWith('useEffect'));
      if (useEffectCalls.length === 0) return true;
      return useEffectCalls.every((ue) => {
        const text = ue.getText();
        const initiatesConnection = text.includes('fetch') || text.includes('connect');
        if (!initiatesConnection) return true;
        return text.includes('granted');
      });
    });

    const promptGatedOnUserGesture = hasLna && hasInteractionTrigger && guardsPromptState;
    expect(promptGatedOnUserGesture).toBe(true);
  });

  test('catches denied or failed connection errors and displays visible error or remediation feedback', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const catchesErrors = sourceFiles.some((sf) => {
      const tryStatements = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      return tryStatements.some((ts) => {
        const tryBlockText = ts.getTryBlock().getText();
        const hasCatch = Boolean(ts.getCatchClause());
        return hasCatch && (tryBlockText.includes('fetch') || tryBlockText.includes('Request') || tryBlockText.includes('connect'));
      });
    });

    const hasRemediationUI = sourceFiles.some((sf) => {
      const text = sf.getText();
      const mentionsRemediationOrSettings =
        text.includes('remediation') || text.includes('settings') || text.includes('blocked') || text.includes('alert') || text.includes('Check that');
      const mentionsErrorOrFailure =
        text.includes('error') || text.includes('Error') || text.includes('failed') || text.includes('denied');
      return mentionsRemediationOrSettings && mentionsErrorOrFailure;
    });

    const handlesErrorsGracefully = catchesErrors && hasRemediationUI;
    expect(handlesErrorsGracefully).toBe(true);
  });

  test('delegates permission using allow attribute on embedded iframes requiring local network access', () => {
    const project = getJsProject(targetFiles);
    const htmlDocs = getHtmlDocuments(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasLna = sourceFiles.some((sf) =>
      sf.getText().includes('targetAddressSpace') || sf.getText().includes('local-network')
    );

    const jsxIframes = sourceFiles.flatMap((sf) => {
      const elements = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
      return elements.filter((el) => el.getTagNameNode().getText() === 'iframe');
    });

    const htmlIframes = htmlDocs.flatMap((d) => Array.from(d.document.querySelectorAll('iframe')));

    const totalIframes = jsxIframes.length + htmlIframes.length;

    const jsxValid = jsxIframes.every((iframe) => {
      const allowAttr = iframe.getAttributes().find((attr) => {
        const text = attr.getText();
        return text.startsWith('allow=') || text.startsWith('allow ');
      });
      if (!allowAttr) return false;
      const text = allowAttr.getText();
      return text.includes('local-network') || text.includes('loopback-network');
    });

    const htmlValid = htmlIframes.every((iframe: any) => {
      const allow = iframe.getAttribute('allow') || '';
      return allow.includes('local-network') || allow.includes('loopback-network');
    });

    const validIframeDelegation = hasLna && (totalIframes === 0 || (jsxValid && htmlValid));
    expect(validIframeDelegation).toBe(true);
  });
});
