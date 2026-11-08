/*
 * Expectation 1: TESTED - Gates passkey UI entry points on WebAuthn feature detection and hides or disables them when unsupported
 * Expectation 2: TESTED - Wraps navigator.credentials calls in try/catch error handling for expected WebAuthn exceptions
 * Expectation 3: TESTED - Decodes registration options with PublicKeyCredential.parseCreationOptionsFromJSON before navigator.credentials.create()
 * Expectation 4: TESTED - Decodes authentication options with PublicKeyCredential.parseRequestOptionsFromJSON before navigator.credentials.get()
 * Expectation 5: TESTED - Fetches WebAuthn options from a server endpoint rather than constructing challenges on the client
 * Expectation 6: TESTED - Configures or validates Relying Party ID as a bare hostname matching the origin without scheme, port, path, IP, or public suffix
 * Expectation 7: TESTED - Serializes credentials using PublicKeyCredential.prototype.toJSON and posts them to a server verification endpoint
 * Expectation 8: TESTED - Uses credential AAGUID exclusively for rendering provider UX hints and never for authorization decisions
 * Expectation 9: TESTED - Delegates WebAuthn verification to the server without hand-rolling signature or challenge verification on the client
 */

import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type CallExpression,
  type Expression,
  type Node,
  type Project,
  type SourceFile,
} from 'ts-morph';

// @ts-ignore - package.json omits "type": "module", causing tsc nodenext to warn on import.meta
const targetFiles: string[] = getTargetFiles(import.meta.url);

function unwrapExpression(expr: Expression): Expression {
  let current: Expression = expr;
  while (
     current.isKind(SyntaxKind.NonNullExpression) ||
    current.isKind(SyntaxKind.ParenthesizedExpression) ||
    current.isKind(SyntaxKind.AsExpression) ||
    current.isKind(SyntaxKind.TypeAssertionExpression)
  ) {
    current = current.getExpression();
  }
  return current;
}

function getCalleePropertyName(call: CallExpression): string | undefined {
  const expr = unwrapExpression(call.getExpression());
  if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
    return expr.getName();
  }
  return undefined;
}

function isNavigatorCredentialsCall(
  call: CallExpression,
  method: 'create' | 'get'
): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
  if (expr.getName() !== method) return false;

  const target = unwrapExpression(expr.getExpression());
  if (target.isKind(SyntaxKind.PropertyAccessExpression)) {
    return target.getName() === 'credentials';
  }
  return false;
}

function getEnclosingFunctionName(node: Node): string | undefined {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (current.isKind(SyntaxKind.FunctionDeclaration)) {
      return current.getName();
    }
    if (current.isKind(SyntaxKind.MethodDeclaration)) {
      return current.getName();
    }
    if (
      current.isKind(SyntaxKind.ArrowFunction) ||
      current.isKind(SyntaxKind.FunctionExpression)
    ) {
      const parent = current.getParent();
      if (
        parent &&
        (parent.isKind(SyntaxKind.VariableDeclaration) ||
          parent.isKind(SyntaxKind.PropertyAssignment))
      ) {
        return parent.getName();
      }
    }
    current = current.getParent();
  }
  return undefined;
}

function isServerSourceFile(sf: SourceFile): boolean {
  const filePath = sf.getFilePath().replace(/\\/g, '/');
  if (filePath.includes('/pages/api/') || filePath.endsWith('_frontmatter.ts')) {
    return true;
  }
  const importSpecifiers = sf
    .getImportDeclarations()
    .map((imp) => imp.getModuleSpecifierValue());
  return importSpecifiers.some(
    (spec) =>
      spec === 'astro' ||
      spec.startsWith('@simplewebauthn/server') ||
      spec.startsWith('node:') ||
      spec === 'crypto' ||
      spec === 'fs' ||
      spec === 'path'
  );
}

test.describe('passkeys Target Grader', () => {
  test('Expectation 1: Gates passkey entry points on feature detection and hides or disables them when unsupported', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const propAccesses = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    );
    const hasCapabilityCheck = propAccesses.some((pa) => {
      const name = pa.getName();
      return (
        name === 'getClientCapabilities' ||
        name === 'isConditionalMediationAvailable' ||
        name === 'isUserVerifyingPlatformAuthenticatorAvailable'
      );
    });

    const typeOfChecks = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.TypeOfExpression)
    );
    const hasTypeOfPkc = typeOfChecks.some((t) =>
      /\bPublicKeyCredential\b/.test(t.getExpression().getText())
    );

    const binaryExprs = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );
    const hasInWindowCheck = binaryExprs.some(
      (b) =>
        b.getOperatorToken().getText() === 'in' &&
        /\bPublicKeyCredential\b/.test(b.getLeft().getText())
    );

    const hasFeatureDetection =
      hasCapabilityCheck || hasTypeOfPkc || hasInWindowCheck;
    expect(hasFeatureDetection).toBe(true);

    const jsxElements = sourceFiles.flatMap((sf) => [
      ...sf.getDescendantsOfKind(SyntaxKind.JsxElement),
      ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ]);

    const passkeyButtons = jsxElements.filter((el) => {
      const opening = el.isKind(SyntaxKind.JsxElement)
        ? el.getOpeningElement()
        : el;
      const tagName = opening.getTagNameNode().getText();
      if (tagName !== 'button') return false;
      return /\bpasskey\b/i.test(el.getText());
    });

    expect(passkeyButtons.length).toBeGreaterThan(0);

    const filesWithPasskeyButtons = Array.from(
      new Set(passkeyButtons.map((btn) => btn.getSourceFile()))
    );
    expect(filesWithPasskeyButtons.length).toBeGreaterThan(0);

    const everyComponentGatesPasskeyButtons = filesWithPasskeyButtons.every(
      (sf) => {
      const sfButtons = passkeyButtons.filter(
        (btn) => btn.getSourceFile() === sf
      );
      return sfButtons.some((btn) => {
        const opening = btn.isKind(SyntaxKind.JsxElement)
          ? btn.getOpeningElement()
          : btn;

        const gatedByAttr = opening
          .getAttributes()
          .filter((attr) => attr.isKind(SyntaxKind.JsxAttribute))
          .some((attr) => {
            const name = attr.getNameNode().getText();
            if (name !== 'disabled' && name !== 'hidden') return false;
            const init = attr.getInitializer();
            if (!init) return false;
            const hasNegation =
              init.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression)
                .length > 0;
            return (
              hasNegation ||
              /\b(support|capabilit|available|canRegister|passkey)\w*/i.test(
                init.getText()
              )
            );
          });

        const gatedByConditionalRender = Boolean(
          btn.getFirstAncestor(
            (anc) =>
              anc.isKind(SyntaxKind.JsxExpression) &&
              (anc.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((b) =>
                ['&&', '?'].includes(b.getOperatorToken().getText())
              ) ||
                anc.getDescendantsOfKind(SyntaxKind.ConditionalExpression)
                  .length > 0)
          ) || btn.getFirstAncestorByKind(SyntaxKind.IfStatement)
        );

        return gatedByAttr || gatedByConditionalRender;
      });
    });

    expect(everyComponentGatesPasskeyButtons).toBe(true);
  });

  test('Expectation 2: Wraps navigator.credentials calls in try/catch error handling for expected WebAuthn exceptions', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const allCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const credentialCreateCalls = allCalls.filter((c) =>
      isNavigatorCredentialsCall(c, 'create')
    );
    const credentialGetCalls = allCalls.filter((c) =>
      isNavigatorCredentialsCall(c, 'get')
    );

    expect(credentialCreateCalls.length).toBeGreaterThan(0);
    expect(credentialGetCalls.length).toBeGreaterThan(0);

    const allCredCalls = [...credentialCreateCalls, ...credentialGetCalls];
    expect(allCredCalls.length).toBeGreaterThan(0);

    const higherOrderTryWrappers = new Set<string>();
    const collectWrapperIfTriesParam = (
      name: string | undefined,
      params: { getName(): string }[],
      bodyNode: Node
    ) => {
      if (!name || params.length === 0) return;
      const paramNames = new Set(params.map((p) => p.getName()));
      const tryStatements = bodyNode.getDescendantsOfKind(
        SyntaxKind.TryStatement
      );
      const invokesParamInTry = tryStatements.some((tryStmt) =>
        tryStmt
          .getTryBlock()
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((c) => {
            const expr = unwrapExpression(c.getExpression());
            return (
              expr.isKind(SyntaxKind.Identifier) &&
              paramNames.has(expr.getText())
            );
          })
      );
      if (invokesParamInTry) {
        higherOrderTryWrappers.add(name);
      }
    };

    for (const sf of sourceFiles) {
      for (const fn of sf.getDescendantsOfKind(
        SyntaxKind.FunctionDeclaration
      )) {
        collectWrapperIfTriesParam(fn.getName(), fn.getParameters(), fn);
      }
      for (const vd of sf.getDescendantsOfKind(
        SyntaxKind.VariableDeclaration
      )) {
        const init = vd.getInitializer();
        if (
          init &&
          (init.isKind(SyntaxKind.ArrowFunction) ||
            init.isKind(SyntaxKind.FunctionExpression))
        ) {
          collectWrapperIfTriesParam(
            vd.getName(),
            init.getParameters(),
            init
          );
        }
      }
    }

    const isCallProtected = (call: CallExpression, depth = 0): boolean => {
      if (depth > 4) return false;
      if (call.getFirstAncestorByKind(SyntaxKind.TryStatement)) {
        return true;
      }
      if (
        call
          .getParentIfKind(SyntaxKind.PropertyAccessExpression)
          ?.getName() === 'catch'
      ) {
        return true;
      }

      const enclosingCallback =
        call.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
        call.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
      const wrapperCall = enclosingCallback?.getParentIfKind(
        SyntaxKind.CallExpression
      );
      if (wrapperCall) {
        const wrapperExpr = unwrapExpression(wrapperCall.getExpression());
        const wrapperName = wrapperExpr.isKind(SyntaxKind.Identifier)
          ? wrapperExpr.getText()
          : wrapperExpr.isKind(SyntaxKind.PropertyAccessExpression)
            ? wrapperExpr.getName()
            : undefined;
        if (wrapperName && higherOrderTryWrappers.has(wrapperName)) {
          return true;
        }
        if (isCallProtected(wrapperCall, depth + 1)) {
          return true;
        }
      }

      const fnName = getEnclosingFunctionName(call);
      if (!fnName) return false;

      const callerSites = allCalls.filter((c) => {
        const expr = unwrapExpression(c.getExpression());
        if (expr.isKind(SyntaxKind.Identifier)) {
          return expr.getText() === fnName;
        }
        if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
          return expr.getName() === fnName;
        }
        return false;
      });

      return callerSites.some((site) => isCallProtected(site, depth + 1));
    };

    const everyCallWrapped = allCredCalls.every((credCall) =>
      isCallProtected(credCall)
    );

    expect(everyCallWrapped).toBe(true);

    const stringLiterals = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    );
    const handlesNotAllowedError = stringLiterals.some(
      (lit) => lit.getLiteralValue() === 'NotAllowedError'
    );
    const handlesAbortOrStateError =
      stringLiterals.some((lit) =>
        ['AbortError', 'InvalidStateError', 'SecurityError'].includes(
          lit.getLiteralValue()
        )
      ) ||
      sourceFiles
        .flatMap((sf) =>
          sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        )
        .some((pa) => pa.getName() === 'aborted');

    expect(handlesNotAllowedError && handlesAbortOrStateError).toBe(true);
  });

  test('Expectation 3: Decodes server-provided registration options with PublicKeyCredential.parseCreationOptionsFromJSON before invoking navigator.credentials.create()', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const allCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const parseCreateCalls = allCalls.filter(
      (c) => getCalleePropertyName(c) === 'parseCreationOptionsFromJSON'
    );
    const credentialCreateCalls = allCalls.filter((c) =>
      isNavigatorCredentialsCall(c, 'create')
    );

    expect(parseCreateCalls.length).toBeGreaterThan(0);
    expect(credentialCreateCalls.length).toBeGreaterThan(0);

    const decodedBeforeCreate = credentialCreateCalls.some((createCall) => {
      const sf = createCall.getSourceFile();
      const fileParseCalls = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter(
          (c) => getCalleePropertyName(c) === 'parseCreationOptionsFromJSON'
        );
      if (fileParseCalls.length === 0) return false;

      const directInArgs = createCall
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some(
          (c) => getCalleePropertyName(c) === 'parseCreationOptionsFromJSON'
        );
      if (directInArgs) return true;

      const helperNames = fileParseCalls
        .map((c) => getEnclosingFunctionName(c))
        .filter((name): name is string => Boolean(name));

      const enclosingFn =
        createCall.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
        createCall.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
        createCall.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
      if (!enclosingFn) return false;

      const fnCalls = enclosingFn.getDescendantsOfKind(
        SyntaxKind.CallExpression
      );
      return fnCalls.some((c) => {
        if (
          getCalleePropertyName(c) === 'parseCreationOptionsFromJSON' &&
          c.getPos() < createCall.getPos()
        ) {
          return true;
        }
        const expr = unwrapExpression(c.getExpression());
        const calleeName = expr.isKind(SyntaxKind.Identifier)
          ? expr.getText()
          : expr.isKind(SyntaxKind.PropertyAccessExpression)
            ? expr.getName()
            : '';
        return (
          Boolean(calleeName) &&
          helperNames.includes(calleeName) &&
          (c.getEnd() <= createCall.getPos() ||
            createCall.getDescendants().includes(c))
        );
      });
    });

    expect(decodedBeforeCreate).toBe(true);
  });

  test('Expectation 4: Decodes server-provided authentication options with PublicKeyCredential.parseRequestOptionsFromJSON before invoking navigator.credentials.get()', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const allCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const parseRequestCalls = allCalls.filter(
      (c) => getCalleePropertyName(c) === 'parseRequestOptionsFromJSON'
    );
    const credentialGetCalls = allCalls.filter((c) =>
      isNavigatorCredentialsCall(c, 'get')
    );

    expect(parseRequestCalls.length).toBeGreaterThan(0);
    expect(credentialGetCalls.length).toBeGreaterThan(0);

    const decodedBeforeGet = credentialGetCalls.some((getCall) => {
      const sf = getCall.getSourceFile();
      const fileParseCalls = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter(
          (c) => getCalleePropertyName(c) === 'parseRequestOptionsFromJSON'
        );
      if (fileParseCalls.length === 0) return false;

      const directInArgs = getCall
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some(
          (c) => getCalleePropertyName(c) === 'parseRequestOptionsFromJSON'
        );
      if (directInArgs) return true;

      const helperNames = fileParseCalls
        .map((c) => getEnclosingFunctionName(c))
        .filter((name): name is string => Boolean(name));

      const enclosingFn =
        getCall.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
        getCall.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
        getCall.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
      if (!enclosingFn) return false;

      const fnCalls = enclosingFn.getDescendantsOfKind(
        SyntaxKind.CallExpression
      );
      return fnCalls.some((c) => {
        if (
          getCalleePropertyName(c) === 'parseRequestOptionsFromJSON' &&
          c.getPos() < getCall.getPos()
        ) {
          return true;
        }
        const expr = unwrapExpression(c.getExpression());
        const calleeName = expr.isKind(SyntaxKind.Identifier)
          ? expr.getText()
          : expr.isKind(SyntaxKind.PropertyAccessExpression)
            ? expr.getName()
            : '';
        return (
          Boolean(calleeName) &&
          helperNames.includes(calleeName) &&
          (c.getEnd() <= getCall.getPos() ||
            getCall.getDescendants().includes(c))
        );
      });
    });

    expect(decodedBeforeGet).toBe(true);
  });

  test('Expectation 5: Fetches WebAuthn options from a server endpoint rather than constructing the challenge value on the client', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const allCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const credentialCalls = allCalls.filter(
      (c) =>
        isNavigatorCredentialsCall(c, 'create') ||
        isNavigatorCredentialsCall(c, 'get')
    );
    expect(credentialCalls.length).toBeGreaterThanOrEqual(2);

    const fetchHelperNames = new Set<string>(['fetch']);
    let addedFetchHelper = true;
    while (addedFetchHelper) {
      addedFetchHelper = false;
      for (const call of allCalls) {
        const expr = unwrapExpression(call.getExpression());
        const calleeName = expr.isKind(SyntaxKind.Identifier)
          ? expr.getText()
          : expr.isKind(SyntaxKind.PropertyAccessExpression)
            ? expr.getName()
            : '';
        if (calleeName && fetchHelperNames.has(calleeName)) {
          const fnName = getEnclosingFunctionName(call);
          if (fnName && !fetchHelperNames.has(fnName)) {
            fetchHelperNames.add(fnName);
            addedFetchHelper = true;
          }
        }
      }
    }

    const everyCeremonyFetchesOptionsFromServer = credentialCalls.every(
      (credCall) => {
        const enclosingFn =
          credCall.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
          credCall.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
          credCall.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
        if (!enclosingFn) return false;

        return enclosingFn
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((call) => {
            if (call.getPos() >= credCall.getPos()) return false;
            const expr = unwrapExpression(call.getExpression());
            if (expr.isKind(SyntaxKind.Identifier)) {
              return fetchHelperNames.has(expr.getText());
            }
            if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
              return fetchHelperNames.has(expr.getName());
            }
            return false;
          });
      }
    );

    expect(everyCeremonyFetchesOptionsFromServer).toBe(true);

    const clientFiles = sourceFiles.filter((sf) => !isServerSourceFile(sf));
    const clientConstructsRandomChallenge = clientFiles.some((sf) => {
      const propAssignments = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .filter((pa) => pa.getName() === 'challenge');
      const randomInChallengeProp = propAssignments.some((pa) => {
        const initText = pa.getInitializer()?.getText() || '';
        return /\b(getRandomValues|randomUUID|randomBytes|Math\.random)\b/.test(
          initText
        );
      });
      return randomInChallengeProp;
    });

    expect(clientConstructsRandomChallenge).toBe(false);
  });

  test('Expectation 6: Relying Party ID (rp.id or rpId) is a bare domain matching origin hostname and never an IP address, URL with scheme/port/path, or public suffix', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const rpIdentifiers = sourceFiles
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.Identifier))
      .filter((id) => id.getText() === 'rpID' || id.getText() === 'rpId');
    const rpDotIdAccesses = sourceFiles
      .flatMap((sf) =>
        sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      )
      .filter(
        (pa) =>
          pa.getName() === 'id' &&
          pa.getExpression().isKind(SyntaxKind.PropertyAccessExpression) &&
          pa
            .getExpressionIfKind(SyntaxKind.PropertyAccessExpression)
            ?.getName() === 'rp'
      );

    expect(rpIdentifiers.length + rpDotIdAccesses.length).toBeGreaterThan(0);

    const PUBLIC_SUFFIXES = new Set([
      'github.io',
      'pages.dev',
      'vercel.app',
      'netlify.app',
      'run.app',
      'cloudfunctions.net',
      'com',
      'org',
      'net',
      'io',
      'dev',
      'app',
    ]);

    const rpValueStrings: string[] = [];
    for (const sf of sourceFiles) {
      for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        if (vd.getName() === 'rpID' || vd.getName() === 'rpId') {
          for (const lit of vd.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
            rpValueStrings.push(lit.getLiteralValue());
          }
        }
      }
      for (const pa of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        if (pa.getName() === 'rpID' || pa.getName() === 'rpId') {
          const init = pa.getInitializer();
          if (init && init.isKind(SyntaxKind.StringLiteral)) {
            rpValueStrings.push(init.getLiteralValue());
          }
        }
      }
    }

    const hasInvalidRpIdLiteral = rpValueStrings.some((val) => {
      if (!val) return false;
      const hasSchemePortOrPath = /:\/\/|:\d+|\/|\?/.test(val);
      const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(val);
      const isIpv6 = val.includes(':');
      const isPublicSuffix = PUBLIC_SUFFIXES.has(val.toLowerCase());
      return hasSchemePortOrPath || isIpv4 || isIpv6 || isPublicSuffix;
    });

    expect(hasInvalidRpIdLiteral).toBe(false);
  });

  test('Expectation 7: Serializes returned credential using PublicKeyCredential.prototype.toJSON and posts it to a server verification endpoint', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const allCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const toJsonCalls = allCalls.filter(
      (c) => getCalleePropertyName(c) === 'toJSON'
    );
    expect(toJsonCalls.length).toBeGreaterThan(0);

    const serializerFnNames = new Set<string>(['toJSON']);
    let addedSerializerHelper = true;
    while (addedSerializerHelper) {
      addedSerializerHelper = false;
      for (const call of allCalls) {
        const expr = unwrapExpression(call.getExpression());
        const calleeName = expr.isKind(SyntaxKind.Identifier)
          ? expr.getText()
          : expr.isKind(SyntaxKind.PropertyAccessExpression)
            ? expr.getName()
            : '';
        if (calleeName && serializerFnNames.has(calleeName)) {
          const fnName = getEnclosingFunctionName(call);
          if (fnName && !serializerFnNames.has(fnName)) {
            serializerFnNames.add(fnName);
            addedSerializerHelper = true;
          }
        }
      }
    }

    const credentialCalls = allCalls.filter(
      (c) =>
        isNavigatorCredentialsCall(c, 'create') ||
        isNavigatorCredentialsCall(c, 'get')
    );
    expect(credentialCalls.length).toBeGreaterThanOrEqual(2);

    const postHelperNames = new Set<string>();
    for (const call of allCalls) {
      const hasPostLiteral = call
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .some((lit) => lit.getLiteralValue().toUpperCase() === 'POST');
      if (hasPostLiteral) {
        const fnName = getEnclosingFunctionName(call);
        if (fnName) postHelperNames.add(fnName);
      }
    }
    for (const fnDecl of sourceFiles.flatMap((sf) => [
      ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
      ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
      ...sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration),
      ...sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment),
    ])) {
      const hasPostDefault = fnDecl
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .some((lit) => lit.getLiteralValue().toUpperCase() === 'POST');
      const name = fnDecl.getName();
      if (hasPostDefault && name) {
        postHelperNames.add(name);
      }
    }
    let addedPostHelper = true;
    while (addedPostHelper) {
      addedPostHelper = false;
      for (const call of allCalls) {
        const expr = unwrapExpression(call.getExpression());
        const calleeName = expr.isKind(SyntaxKind.Identifier)
          ? expr.getText()
          : expr.isKind(SyntaxKind.PropertyAccessExpression)
            ? expr.getName()
            : '';
        if (calleeName && postHelperNames.has(calleeName)) {
          const fnName = getEnclosingFunctionName(call);
          if (fnName && !postHelperNames.has(fnName)) {
            postHelperNames.add(fnName);
            addedPostHelper = true;
          }
        }
      }
    }

    const everyCeremonySerializesAndPosts = credentialCalls.every((credCall) => {
      const enclosingFn =
        credCall.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
        credCall.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
        credCall.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
      if (!enclosingFn) return false;

      const fnCalls = enclosingFn.getDescendantsOfKind(
        SyntaxKind.CallExpression
      );
      const callsSerializer = fnCalls.some((c) => {
        const expr = unwrapExpression(c.getExpression());
        if (expr.isKind(SyntaxKind.Identifier)) {
          return serializerFnNames.has(expr.getText());
        }
        if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
          return serializerFnNames.has(expr.getName());
        }
        return false;
      });

      const postsAfterCredential = fnCalls.some((c) => {
        if (c.getPos() <= credCall.getPos()) return false;
        const expr = unwrapExpression(c.getExpression());
        const calleeName = expr.isKind(SyntaxKind.Identifier)
          ? expr.getText()
          : expr.isKind(SyntaxKind.PropertyAccessExpression)
            ? expr.getName()
            : '';
        if (!calleeName) return false;
        const hasDirectPost = c
          .getDescendantsOfKind(SyntaxKind.StringLiteral)
          .some((lit) => lit.getLiteralValue().toUpperCase() === 'POST');
        return hasDirectPost || postHelperNames.has(calleeName);
      });

      return callsSerializer && postsAfterCredential;
    });

    expect(everyCeremonySerializesAndPosts).toBe(true);
  });

  test('Expectation 8: Uses credential AAGUID exclusively to render provider names or icons in the UI and never for authorization decisions', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const jsxExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.JsxExpression)
    );
    const rendersProviderHintInUi = jsxExpressions.some((expr) => {
      const identifiers = expr
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .map((id) => id.getText());
      return identifiers.some((name) =>
        /^(providerName|provider|providerIcon|aaguid)$/i.test(name)
      );
    });

    expect(rendersProviderHintInUi).toBe(true);

    const ifStatements = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.IfStatement)
    );
    const usesAaguidForAccessControl = ifStatements.some((ifStmt) => {
      const condIds = ifStmt
        .getExpression()
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .map((id) => id.getText());
      const checksAaguid = condIds.some((name) => /^aaguid$/i.test(name));
      if (!checksAaguid) return false;

      const thenBlock = ifStmt.getThenStatement();
      const throwsError =
        thenBlock.isKind(SyntaxKind.ThrowStatement) ||
        thenBlock.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;
      const returnsAuthErrorStatus = thenBlock
        .getDescendantsOfKind(SyntaxKind.NumericLiteral)
        .some((num) => ['401', '403'].includes(num.getText()));

      return throwsError || returnsAuthErrorStatus;
    });

    expect(usesAaguidForAccessControl).toBe(false);
  });

  test('Expectation 9: Does not hand-roll WebAuthn signature verification or challenge validation in client-side JavaScript', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const clientFiles = sourceFiles.filter((sf) => !isServerSourceFile(sf));
    const clientCalls = clientFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasClientCeremonies =
      clientCalls.some((c) => isNavigatorCredentialsCall(c, 'create')) &&
      clientCalls.some((c) => isNavigatorCredentialsCall(c, 'get'));
    expect(hasClientCeremonies).toBe(true);

    const handRollsSubtleVerifyOnClient = clientCalls.some((call) => {
      const expr = unwrapExpression(call.getExpression());
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      if (expr.getName() !== 'verify') return false;
      const target = unwrapExpression(expr.getExpression());
      return (
        target.isKind(SyntaxKind.PropertyAccessExpression) &&
        target.getName() === 'subtle'
      );
    });

    const handRollsChallengeCheckOnClient = clientFiles.some((sf) => {
      const jsonParseCalls = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter((call) => {
          const expr = unwrapExpression(call.getExpression());
          return (
            expr.isKind(SyntaxKind.PropertyAccessExpression) &&
            expr.getName() === 'parse' &&
            expr.getExpression().getText() === 'JSON'
          );
        });
      return jsonParseCalls.some((call) =>
        call
          .getArguments()
          .some((arg) => /\bclientDataJSON\b/.test(arg.getText()))
      );
    });

    expect(handRollsSubtleVerifyOnClient || handRollsChallengeCheckOnClient).toBe(
      false
    );
  });
});
