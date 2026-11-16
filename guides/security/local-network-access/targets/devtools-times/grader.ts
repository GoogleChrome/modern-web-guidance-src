import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type CallExpression,
  type PropertyAssignment,
  type ShorthandPropertyAssignment,
  type SourceFile,
} from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function isPermissionsQueryCall(call: CallExpression): boolean {
  const expr = call.getExpression();
  if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
    return (
      expr.getName() === 'query' &&
      /\bpermissions\b/.test(expr.getExpression().getText())
    );
  }
  return false;
}

function getPermissionsQueryCalls(sourceFiles: SourceFile[]): CallExpression[] {
  return sourceFiles.flatMap((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isPermissionsQueryCall)
  );
}

function getTargetAddressSpaceProperties(
  sourceFiles: SourceFile[]
): Array<PropertyAssignment | ShorthandPropertyAssignment> {
  return sourceFiles.flatMap((sf) => [
    ...sf
      .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .filter((prop) => prop.getName() === 'targetAddressSpace'),
    ...sf
      .getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
      .filter((prop) => prop.getName() === 'targetAddressSpace'),
  ]);
}

function collectRequestFunctionNames(sourceFiles: SourceFile[]): Set<string> {
  const requestFnNames = new Set<string>();
  for (const prop of getTargetAddressSpaceProperties(sourceFiles)) {
    const fnDecl = prop.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
    if (fnDecl?.getName()) {
      requestFnNames.add(fnDecl.getName()!);
    }
    const varDecl = prop.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (varDecl?.getName()) {
      requestFnNames.add(varDecl.getName());
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const sf of sourceFiles) {
      for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const calleeName = call.getExpression().getText();
        if (requestFnNames.has(calleeName)) {
          const enclosingFn = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
          if (enclosingFn?.getName() && !requestFnNames.has(enclosingFn.getName()!)) {
            requestFnNames.add(enclosingFn.getName()!);
            changed = true;
          }
          const enclosingVar = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
          if (enclosingVar?.getName() && !requestFnNames.has(enclosingVar.getName())) {
            requestFnNames.add(enclosingVar.getName());
            changed = true;
          }
        }
      }
    }
  }

  return requestFnNames;
}

function getLnaSourceFiles(sourceFiles: SourceFile[]): SourceFile[] {
  return sourceFiles.filter((sf) => {
    const hasGranularString = [
      ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
      ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
    ].some((lit) => {
      const val = lit.getLiteralValue();
      return val === 'local-network' || val === 'loopback-network';
    });

    const hasTargetAddressSpace =
      sf
        .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .some((p) => p.getName() === 'targetAddressSpace') ||
      sf
        .getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
        .some((p) => p.getName() === 'targetAddressSpace');

    return hasGranularString || hasTargetAddressSpace;
  });
}

test.describe('local-network-access Target Grader', () => {
  test('queries granular permission (local-network or loopback-network) via navigator.permissions.query() with fallback error handling', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const permissionQueries = getPermissionsQueryCalls(sourceFiles);

    expect(permissionQueries.length).toBeGreaterThan(0);

    const hasGranularPermissionName = sourceFiles.some((sf) => {
      const hasLiteral = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
      ].some((lit) => {
        const val = lit.getLiteralValue();
        return val === 'local-network' || val === 'loopback-network';
      });

      const hasTemplate = sf
        .getDescendantsOfKind(SyntaxKind.TemplateExpression)
        .some((tmpl) => tmpl.getText().includes('-network'));

      return hasLiteral || hasTemplate;
    });

    const hasFallbackErrorHandling = permissionQueries.some((call) => {
      const enclosingTry = call.getFirstAncestorByKind(SyntaxKind.TryStatement);
      if (enclosingTry?.getCatchClause()) {
        return true;
      }
      let current = call.getParent();
      while (current) {
        if (
          current.isKind(SyntaxKind.PropertyAccessExpression) &&
          current.getName() === 'catch'
        ) {
          return true;
        }
        current = current.getParent();
      }
      return false;
    });

    expect(hasGranularPermissionName && hasFallbackErrorHandling).toBe(true);
  });

  test('never queries the legacy local-network-access permission name via navigator.permissions.query()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const permissionQueries = getPermissionsQueryCalls(sourceFiles);

    expect(permissionQueries.length).toBeGreaterThan(0);

    const queriesLegacyInCall = permissionQueries.some((call) =>
      call.getArguments().some((arg) =>
        [
          ...arg.getDescendantsOfKind(SyntaxKind.StringLiteral),
          ...arg.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ].some((lit) => lit.getLiteralValue() === 'local-network-access')
      )
    );

    const hasLegacyDescriptorAssignment = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((prop) => {
        if (prop.getName() !== 'name') return false;
        const init = prop.getInitializer();
        if (!init) return false;
        if (
          init.isKind(SyntaxKind.StringLiteral) ||
          init.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
        ) {
          return init.getLiteralValue() === 'local-network-access';
        }
        return [
          ...init.getDescendantsOfKind(SyntaxKind.StringLiteral),
          ...init.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ].some((lit) => lit.getLiteralValue() === 'local-network-access');
      })
    );

    expect(queriesLegacyInCall || hasLegacyDescriptorAssignment).toBe(false);
  });

  test('specifies targetAddressSpace: local for local network requests and targetAddressSpace: loopback for loopback requests in fetch() or Request options', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const targetAddressSpaceProps = getTargetAddressSpaceProperties(sourceFiles);

    expect(targetAddressSpaceProps.length).toBeGreaterThan(0);

    const usedInFetchOrRequest = targetAddressSpaceProps.some((prop) => {
      const sf = prop.getSourceFile();
      const hasRequestNew = sf
        .getDescendantsOfKind(SyntaxKind.NewExpression)
        .some((ne) => ne.getExpression().getText() === 'Request' && ne.getArguments().length >= 2);
      const hasFetchCall = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((ce) => /\bfetch$/.test(ce.getExpression().getText()) && ce.getArguments().length >= 1);
      return hasRequestNew || hasFetchCall;
    });

    let hasLocalAddressSpace = false;
    let hasLoopbackAddressSpace = false;

    for (const prop of targetAddressSpaceProps) {
      if (prop.isKind(SyntaxKind.PropertyAssignment)) {
        const init = prop.getInitializer();
        if (!init) continue;

        const directLiterals = [
          ...(init.isKind(SyntaxKind.StringLiteral) ||
          init.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
            ? [init]
            : []),
          ...init.getDescendantsOfKind(SyntaxKind.StringLiteral),
          ...init.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ].map((l) => l.getLiteralValue());

        if (directLiterals.includes('local')) {
          hasLocalAddressSpace = true;
        }
        if (directLiterals.includes('loopback')) {
          hasLoopbackAddressSpace = true;
        }

        if (directLiterals.length === 0) {
          const sfLiterals = [
            ...prop.getSourceFile().getDescendantsOfKind(SyntaxKind.StringLiteral),
            ...prop.getSourceFile().getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
          ].map((l) => l.getLiteralValue());

          if (sfLiterals.includes('local')) {
            hasLocalAddressSpace = true;
          }
          if (sfLiterals.includes('loopback')) {
            hasLoopbackAddressSpace = true;
          }
        }
      } else {
        const sfLiterals = [
          ...prop.getSourceFile().getDescendantsOfKind(SyntaxKind.StringLiteral),
          ...prop.getSourceFile().getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ].map((l) => l.getLiteralValue());

        if (sfLiterals.includes('local')) {
          hasLocalAddressSpace = true;
        }
        if (sfLiterals.includes('loopback')) {
          hasLoopbackAddressSpace = true;
        }
      }
    }

    expect(usedInFetchOrRequest && hasLocalAddressSpace && hasLoopbackAddressSpace).toBe(true);
  });

  test('gates local network and loopback requests on explicit user interaction when permission state is prompt rather than firing unconditionally on page load', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const docs = getHtmlDocuments(targetFiles);
    const lnaFiles = getLnaSourceFiles(sourceFiles);

    expect(lnaFiles.length).toBeGreaterThan(0);

    const hasPromptState = lnaFiles.some((sf) =>
      [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
      ].some((lit) => lit.getLiteralValue() === 'prompt')
    );

    const requestFnNames = collectRequestFunctionNames(lnaFiles);

    const useEffectCalls = lnaFiles.flatMap((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter((call) => /\buseEffect$/.test(call.getExpression().getText()))
    );

    const notFiredUnconditionallyOnLoad = useEffectCalls.every((effectCall) => {
      const callback = effectCall.getArguments()[0];
      if (!callback) return true;

      const requestNodesInEffect = [
        ...callback
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .filter((c) => {
            const callee = c.getExpression().getText();
            return requestFnNames.has(callee) || /\bfetch$/.test(callee);
          }),
        ...callback
          .getDescendantsOfKind(SyntaxKind.NewExpression)
          .filter((ne) => /\bRequest$/.test(ne.getExpression().getText())),
      ];

      return requestNodesInEffect.every((reqNode) => {
        const ifAncestor = reqNode.getFirstAncestorByKind(SyntaxKind.IfStatement);
        if (!ifAncestor) return false;
        const condLiterals = [
          ...ifAncestor.getExpression().getDescendantsOfKind(SyntaxKind.StringLiteral),
          ...ifAncestor
            .getExpression()
            .getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ].map((l) => l.getLiteralValue());
        return condLiterals.includes('granted') && !condLiterals.includes('prompt');
      });
    });

    const hasJsxButtonAndHandler = lnaFiles.some((sf) => {
      const hasButton = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ].some((el) => el.getTagNameNode().getText() === 'button');

      const hasInteractiveAttr = sf
        .getDescendantsOfKind(SyntaxKind.JsxAttribute)
        .some((attr) => {
          const name = attr.getNameNode().getText();
          return name === 'onClick' || name === 'onSubmit';
        });

      return hasButton && hasInteractiveAttr;
    });

    const hasDomButton = docs.some((d) => Boolean(d.document.querySelector('button')));

    expect(
      hasPromptState &&
        notFiredUnconditionallyOnLoad &&
        (hasJsxButtonAndHandler || hasDomButton)
    ).toBe(true);
  });

  test('catches denied or failed local network and loopback requests and reveals error or remediation feedback in the UI', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const lnaFiles = getLnaSourceFiles(sourceFiles);

    expect(lnaFiles.length).toBeGreaterThan(0);

    const requestFnNames = collectRequestFunctionNames(lnaFiles);
    const isLnaRequestCall = (call: CallExpression): boolean => {
      const callee = call.getExpression().getText();
      return requestFnNames.has(callee) || /\bfetch$/.test(callee);
    };

    const catchesRequestErrors = lnaFiles.some(
      (sf) =>
        sf.getDescendantsOfKind(SyntaxKind.TryStatement).some((tryStmt) => {
          const catchClause = tryStmt.getCatchClause();
          if (!catchClause) return false;

          const tryBlock = tryStmt.getTryBlock();
          const hasRequestInTry =
            tryBlock
              .getDescendantsOfKind(SyntaxKind.CallExpression)
              .some((call) => !isPermissionsQueryCall(call) && isLnaRequestCall(call)) ||
            tryBlock
              .getDescendantsOfKind(SyntaxKind.NewExpression)
              .some((ne) => /\bRequest$/.test(ne.getExpression().getText()));

          const catchUpdatesState =
            catchClause.getBlock().getDescendantsOfKind(SyntaxKind.CallExpression).length > 0 ||
            catchClause.getBlock().getDescendantsOfKind(SyntaxKind.BinaryExpression).length > 0;

          return hasRequestInTry && catchUpdatesState;
        }) ||
        sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
          const expr = call.getExpression();
          if (!expr.isKind(SyntaxKind.PropertyAccessExpression) || expr.getName() !== 'catch') {
            return false;
          }
          const receiver = expr.getExpression();
          const receiverCalls = [
            ...(receiver.isKind(SyntaxKind.CallExpression) ? [receiver] : []),
            ...receiver.getDescendantsOfKind(SyntaxKind.CallExpression),
          ];
          return receiverCalls.some((c) => !isPermissionsQueryCall(c) && isLnaRequestCall(c));
        })
    );

    const handlesDeniedState = lnaFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
        const op = bin.getOperatorToken().getText();
        if (!['===', '!==', '==', '!='].includes(op)) return false;
        return [
          ...bin.getDescendantsOfKind(SyntaxKind.StringLiteral),
          ...bin.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ].some((lit) => lit.getLiteralValue() === 'denied');
      })
    );

    const hasErrorOrRemediationUI = lnaFiles.some((sf) => {
      const hasAlertOrRemediationAttr = sf
        .getDescendantsOfKind(SyntaxKind.JsxAttribute)
        .some((attr) => {
          const attrName = attr.getNameNode().getText();
          const initText = attr.getInitializer()?.getText() ?? '';
          return (
            attrName === 'data-remediation' ||
            (attrName === 'role' && /alert|status/.test(initText))
          );
        });

      const hasConditionalErrorDisplay = sf
        .getDescendantsOfKind(SyntaxKind.BinaryExpression)
        .some(
          (bin) =>
            bin.getOperatorToken().getText() === '&&' &&
            /\berror\b/i.test(bin.getLeft().getText())
        );

      return hasAlertOrRemediationAttr || hasConditionalErrorDisplay;
    });

    expect(catchesRequestErrors && handlesDeniedState && hasErrorOrRemediationUI).toBe(true);
  });
});
