import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type PropertyAssignment,
  type ShorthandPropertyAssignment,
  type SourceFile,
} from 'ts-morph';
import type { Page } from '@playwright/test';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getPermissionQueryCalls(sourceFiles: SourceFile[]): CallExpression[] {
  return sourceFiles
    .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression))
    .filter((call) => {
      const expr = call.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return false;
      if (expr.getName() !== 'query') return false;
      const receiverText = expr.getExpression().getText();
      return /\bpermissions\b/.test(receiverText);
    });
}

function isCallProtectedByErrorHandling(call: CallExpression): boolean {
  const tryStmt = call.getFirstAncestorByKind(SyntaxKind.TryStatement);
  if (tryStmt && tryStmt.getCatchClause()) {
    return true;
  }
  let current: Node | undefined = call.getParent();
  while (current) {
    if (Node.isPropertyAccessExpression(current) && current.getName() === 'catch') {
      return true;
    }
    current = current.getParent();
  }
  return false;
}

function getAllStringLiteralValues(sourceFiles: SourceFile[]): string[] {
  return sourceFiles.flatMap((sf) => [
    ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map((lit) => lit.getLiteralText()),
    ...sf
      .getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .map((lit) => lit.getLiteralText()),
  ]);
}

function collectStringLiteralsFromNode(node: Node): string[] {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return [node.getLiteralText()];
  }
  return [
    ...node.getDescendantsOfKind(SyntaxKind.StringLiteral).map((lit) => lit.getLiteralText()),
    ...node
      .getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .map((lit) => lit.getLiteralText()),
  ];
}

function resolveTargetAddressSpaces(
  props: Array<PropertyAssignment | ShorthandPropertyAssignment>,
  allCalls: CallExpression[],
  sourceFiles: SourceFile[]
): Set<string> {
  const configuredSpaces = new Set<string>();

  for (const prop of props) {
    const init = Node.isPropertyAssignment(prop)
      ? prop.getInitializer()
      : prop.getObjectAssignmentInitializer() ?? prop.getNameNode();
    if (!init) continue;

    for (const text of collectStringLiteralsFromNode(init)) {
      configuredSpaces.add(text);
    }

    const identNode = Node.isIdentifier(init)
      ? init
      : Node.isShorthandPropertyAssignment(prop)
        ? prop.getNameNode()
        : undefined;
    if (identNode && Node.isIdentifier(identNode)) {
      const identName = identNode.getText();
      const ancestorFns = prop
        .getAncestors()
        .filter(
          (node) =>
            Node.isFunctionDeclaration(node) ||
            Node.isFunctionExpression(node) ||
            Node.isArrowFunction(node) ||
            Node.isMethodDeclaration(node)
        );

      for (const enclosingFn of ancestorFns) {
        if (
          !Node.isFunctionDeclaration(enclosingFn) &&
          !Node.isFunctionExpression(enclosingFn) &&
          !Node.isArrowFunction(enclosingFn) &&
          !Node.isMethodDeclaration(enclosingFn)
        ) {
          continue;
        }

        const params = enclosingFn.getParameters();
        const paramIndex = params.findIndex((param) => param.getName() === identName);
        if (paramIndex === -1) continue;

        const matchedParam = params[paramIndex];
        const paramInit = matchedParam.getInitializer();
        if (paramInit) {
          for (const text of collectStringLiteralsFromNode(paramInit)) {
            configuredSpaces.add(text);
          }
        }

        const paramTypeNode = matchedParam.getTypeNode();
        if (paramTypeNode) {
          for (const text of collectStringLiteralsFromNode(paramTypeNode)) {
            configuredSpaces.add(text);
          }
          const typeName = paramTypeNode.getText().trim();
          for (const sf of sourceFiles) {
            for (const typeAlias of sf.getDescendantsOfKind(SyntaxKind.TypeAliasDeclaration)) {
              if (typeAlias.getName() === typeName) {
                for (const text of collectStringLiteralsFromNode(typeAlias)) {
                  configuredSpaces.add(text);
                }
              }
            }
          }
        }

        let fnName: string | undefined;
        if (Node.isFunctionDeclaration(enclosingFn) || Node.isMethodDeclaration(enclosingFn)) {
          fnName = enclosingFn.getName();
        } else {
          const varDecl = enclosingFn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
          fnName = varDecl?.getName();
        }

        if (fnName) {
          for (const call of allCalls) {
            const callExprText = call.getExpression().getText();
            if (callExprText === fnName || callExprText.endsWith(`.${fnName}`)) {
              const arg = call.getArguments()[paramIndex];
              if (arg) {
                for (const text of collectStringLiteralsFromNode(arg)) {
                  configuredSpaces.add(text);
                }
              }
            }
          }
        }
      }

      for (const sf of sourceFiles) {
        for (const varDecl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
          if (varDecl.getName() === identName) {
            const varInit = varDecl.getInitializer();
            if (varInit) {
              for (const text of collectStringLiteralsFromNode(varInit)) {
                configuredSpaces.add(text);
              }
            }
          }
        }
      }
    }
  }

  return configuredSpaces;
}

interface LnaGraderState {
  permissionState: 'prompt' | 'granted' | 'denied';
  fetchMode: 'ok' | 'fail';
  permissionQueries: string[];
  fetchCalls: Array<{ url: string; targetAddressSpace: string | null }>;
  unhandledRejections: number;
}

async function setupBrowserPage(
  page: Page,
  targetUrl: string,
  options: { permissionState?: 'prompt' | 'granted' | 'denied'; fetchMode?: 'ok' | 'fail' } = {}
): Promise<void> {
  const permissionState = options.permissionState ?? 'prompt';
  const fetchMode = options.fetchMode ?? 'ok';

  await page.addInitScript(
    ({ initialPermState, initialFetchMode }) => {
      const state: LnaGraderState = {
        permissionState: initialPermState,
        fetchMode: initialFetchMode,
        permissionQueries: [],
        fetchCalls: [],
        unhandledRejections: 0,
      };
      (window as unknown as { __lnaGrader: LnaGraderState }).__lnaGrader = state;

      window.addEventListener('unhandledrejection', () => {
        state.unhandledRejections += 1;
      });

      const queryPermission = async (descriptor: { name?: string }) => {
        const name = descriptor && typeof descriptor.name === 'string' ? descriptor.name : '';
        state.permissionQueries.push(name);
        if (name !== 'local-network' && name !== 'loopback-network') {
          throw new TypeError(`Unrecognized permission name: ${name}`);
        }
        return {
          name,
          state: state.permissionState,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return true;
          },
        };
      };

      if (navigator.permissions) {
        try {
          navigator.permissions.query = queryPermission as typeof navigator.permissions.query;
        } catch {
          Object.defineProperty(navigator, 'permissions', {
            configurable: true,
            value: { query: queryPermission },
          });
        }
      } else {
        Object.defineProperty(navigator, 'permissions', {
          configurable: true,
          value: { query: queryPermission },
        });
      }

      const OriginalRequest = window.Request;
      class TrackedRequest extends OriginalRequest {
        __targetAddressSpace?: string;
        constructor(input: RequestInfo | URL, init?: RequestInit & { targetAddressSpace?: string }) {
          super(input, init);
          if (init && typeof init === 'object' && 'targetAddressSpace' in init && init.targetAddressSpace) {
            this.__targetAddressSpace = init.targetAddressSpace;
          }
        }
      }
      window.Request = TrackedRequest;

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit & { targetAddressSpace?: string }
      ): Promise<Response> => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input && typeof input.url === 'string'
                ? input.url
                : String(input);

        const reqInput = input as TrackedRequest & { targetAddressSpace?: string };
        const targetAddressSpace =
          (init && typeof init === 'object' ? init.targetAddressSpace : undefined) ??
          (reqInput && typeof reqInput === 'object'
            ? reqInput.__targetAddressSpace ?? reqInput.targetAddressSpace
            : undefined) ??
          null;

        state.fetchCalls.push({ url, targetAddressSpace });

        if (url && !url.startsWith(window.location.origin)) {
          if (state.fetchMode === 'fail') {
            throw new TypeError('Failed to fetch');
          }
          return new Response(JSON.stringify({ status: 'ok', ready: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return originalFetch(input, init);
      };
    },
    { initialPermState: permissionState, initialFetchMode: fetchMode }
  );

  const httpsUrl = targetUrl.replace(/^http:/, 'https:');
  const httpsOrigin = new URL(httpsUrl).origin;
  const httpOrigin = new URL(targetUrl).origin;

  await page.route('https://images.unsplash.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: '' })
  );

  await page.route(`${httpsOrigin}/**`, async (route) => {
    const reqUrl = route.request().url();
    const mappedHttpUrl = reqUrl.replace(httpsOrigin, httpOrigin);
    const res = await fetch(mappedHttpUrl);
    const body = Buffer.from(await res.arrayBuffer());
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    await route.fulfill({
      status: res.status,
      headers,
      body,
    });
  });

  await page.goto(httpsUrl);
}

test.describe('local-network-access Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('queries granular local-network or loopback-network permissions via navigator.permissions.query() with fallback error handling', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const permissionQueryCalls = getPermissionQueryCalls(sourceFiles);
    expect(permissionQueryCalls.length).toBeGreaterThan(0);

    const stringLiterals = getAllStringLiteralValues(sourceFiles);
    const queriesGranularPermission =
      stringLiterals.includes('local-network') || stringLiterals.includes('loopback-network');
    const allCallsHaveFallbackErrorHandling = permissionQueryCalls.every((call) =>
      isCallProtectedByErrorHandling(call)
    );

    expect(queriesGranularPermission && allCallsHaveFallbackErrorHandling).toBe(true);
  });

  test('never queries the legacy local-network-access permission name via navigator.permissions.query()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const permissionQueryCalls = getPermissionQueryCalls(sourceFiles);
    expect(permissionQueryCalls.length).toBeGreaterThan(0);

    const stringLiterals = getAllStringLiteralValues(sourceFiles);
    expect(stringLiterals.includes('local-network-access')).toBe(false);
  });

  test('specifies targetAddressSpace local for local network endpoints and loopback for loopback endpoints in fetch() or Request options', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const allCalls: CallExpression[] = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const allNews: NewExpression[] = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.NewExpression)
    );

    const hasFetchOrRequest =
      allCalls.some((c) => /\bfetch$/.test(c.getExpression().getText())) ||
      allNews.some((n) => /\bRequest$/.test(n.getExpression().getText()));
    expect(hasFetchOrRequest).toBe(true);

    const targetAddressSpaceProps: Array<PropertyAssignment | ShorthandPropertyAssignment> =
      sourceFiles.flatMap((sf) => [
        ...sf
          .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
          .filter((prop) => prop.getName().replace(/['"`]/g, '') === 'targetAddressSpace'),
        ...sf
          .getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
          .filter((prop) => prop.getName() === 'targetAddressSpace'),
      ]);
    expect(targetAddressSpaceProps.length).toBeGreaterThan(0);

    const configuredSpaces = resolveTargetAddressSpaces(
      targetAddressSpaceProps,
      allCalls,
      sourceFiles
    );
    expect(configuredSpaces.has('local') && configuredSpaces.has('loopback')).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  const SPECIFIC_CONNECT_BTN_RE =
    /connect.*(brewer|brewing|companion|helper|utility|local|loopback|device)|brewer|brewing|companion|helper|utility/i;
  const GENERIC_CONNECT_BTN_RE =
    /connect|pair|test|check|ping|status|sync|discover|scan/i;

  async function findConnectButton(page: Page) {
    const specific = page.getByRole('button', { name: SPECIFIC_CONNECT_BTN_RE });
    if ((await specific.count()) > 0) {
      return specific.first();
    }
    const generic = page.getByRole('button', { name: GENERIC_CONNECT_BTN_RE });
    if ((await generic.count()) > 0) {
      return generic.first();
    }
    return page.locator('button').first();
  }

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await setupBrowserPage(page, TARGET_URL, { permissionState: 'prompt', fetchMode: 'ok' });
    });

    test('does not fire local network or loopback requests automatically on page load when permission state is prompt and triggers them on explicit user interaction', async ({
      page,
    }) => {
      const connectButton = await findConnectButton(page);
      await expect(connectButton).toBeEnabled();

      const initialFetchCalls = await page.evaluate(
        () => (window as unknown as { __lnaGrader: LnaGraderState }).__lnaGrader.fetchCalls.length
      );
      expect(initialFetchCalls).toBe(0);

      await connectButton.click();

      await expect
        .poll(async () =>
          page.evaluate(
            () =>
              (window as unknown as { __lnaGrader: LnaGraderState }).__lnaGrader.fetchCalls.length
          )
        )
        .toBeGreaterThan(0);
    });

    test('catches failed or denied local network or loopback requests without unhandled promise rejections and reveals visible error or remediation feedback in the UI', async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      const connectButton = await findConnectButton(page);
      await expect(connectButton).toBeEnabled();

      const beforeBodyText = await page.locator('body').innerText();

      await page.evaluate(() => {
        (window as unknown as { __lnaGrader: LnaGraderState }).__lnaGrader.fetchMode = 'fail';
      });

      await connectButton.click();

      const ERROR_OR_REMEDIATION_RE =
        /error|fail|couldn'?t|can'?t|could not|unable|denied|blocked|offline|unreachable|troubleshoot|check|ensure|make sure|verify|power|powered on|same (wi-?fi|network)|wi-?fi|permission/i;

      await expect
        .poll(async () => {
          const state = await page.evaluate(
            () => (window as unknown as { __lnaGrader: LnaGraderState }).__lnaGrader
          );
          const afterBodyText = await page.locator('body').innerText();
          const bodyChanged = afterBodyText.trim() !== beforeBodyText.trim();
          const hasErrorFeedback =
            bodyChanged && ERROR_OR_REMEDIATION_RE.test(afterBodyText);
          return (
            state.fetchCalls.length > 0 &&
            state.unhandledRejections === 0 &&
            pageErrors.length === 0 &&
            hasErrorFeedback
          );
        })
        .toBe(true);
    });
  });
});
