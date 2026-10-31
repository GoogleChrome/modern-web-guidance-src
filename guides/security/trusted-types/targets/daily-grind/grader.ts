import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type Project,
  type PropertyAccessExpression,
  type CallExpression,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type MethodDeclaration,
} from 'ts-morph';
import type { Document } from 'linkedom';
import * as path from 'path';

const currentFileUrl =
  typeof __filename !== 'undefined'
    ? `file://${path.resolve(__filename)}`
    : `file://${path.resolve(process.cwd(), 'grader.ts')}`;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

function findCreateHTMLRuleInObject(obj: ObjectLiteralExpression): boolean {
  for (const prop of obj.getProperties()) {
    if (prop.isKind(SyntaxKind.PropertyAssignment)) {
      const propAssign = prop as PropertyAssignment;
      const name = propAssign.getName().replace(/^['"]|['"]$/g, '');
      if (name === 'createHTML') {
        const init = propAssign.getInitializer();
        if (init) {
          const isFunc =
            init.isKind(SyntaxKind.ArrowFunction) ||
            init.isKind(SyntaxKind.FunctionExpression) ||
            init.isKind(SyntaxKind.Identifier) ||
            init.isKind(SyntaxKind.PropertyAccessExpression);
          return isFunc;
        }
      }
    } else if (prop.isKind(SyntaxKind.MethodDeclaration)) {
      const methodDecl = prop as MethodDeclaration;
      const name = methodDecl.getName().replace(/^['"]|['"]$/g, '');
      if (name === 'createHTML') {
        return true;
      }
    }
  }
  return false;
}

function hasCreatePolicyWithCreateHTML(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  const callExpressions = sourceFiles.flatMap((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.CallExpression)
  );

  for (const call of callExpressions) {
    const expr = call.getExpression();
    if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
      const propAccess = expr as PropertyAccessExpression;
      if (propAccess.getName() === 'createPolicy') {
        const args = call.getArguments();
        if (args.length >= 2) {
          const secondArg = args[1];
          if (secondArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
            if (findCreateHTMLRuleInObject(secondArg as ObjectLiteralExpression)) {
              return true;
            }
          } else if (secondArg.isKind(SyntaxKind.Identifier)) {
            const varName = secondArg.getText();
            const varDecls = sourceFiles.flatMap((sf) =>
              sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
            );
            for (const decl of varDecls) {
              if (decl.getName() === varName) {
                const init = decl.getInitializer();
                if (
                  init &&
                  init.isKind(SyntaxKind.ObjectLiteralExpression) &&
                  findCreateHTMLRuleInObject(init as ObjectLiteralExpression)
                ) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }
  return false;
}

function hasTrustedTypesFallback(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  for (const sf of sourceFiles) {
    // Pattern 1: assigning or defining window.trustedTypes / trustedTypes with createPolicy
    const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const bin of binaryExprs) {
      const op = bin.getOperatorToken().getText();
      if (op === '=' || op === '||=' || op === '??=') {
        const leftText = bin.getLeft().getText();
        const right = bin.getRight();
        if (leftText.includes('trustedTypes')) {
          const hasCreatePolicyProp = right
            .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
            .some((p) => p.getName().replace(/^['"]|['"]$/g, '') === 'createPolicy');
          const hasCreatePolicyMethod = right
            .getDescendantsOfKind(SyntaxKind.MethodDeclaration)
            .some((m) => m.getName().replace(/^['"]|['"]$/g, '') === 'createPolicy');
          if (hasCreatePolicyProp || hasCreatePolicyMethod || leftText.includes('createPolicy')) {
            return true;
          }
        }
      }
    }

    // Pattern 2: conditional expression checking trustedTypes (e.g. window.trustedTypes ? window.trustedTypes.createPolicy(...) : rules)
    const condExprs = sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
    for (const cond of condExprs) {
      const conditionText = cond.getCondition().getText();
      if (conditionText.includes('trustedTypes')) {
        return true;
      }
    }

    // Pattern 3: optional chaining with nullish coalescing / logical OR on createPolicy (e.g. window.trustedTypes?.createPolicy(...) ?? rules)
    for (const bin of binaryExprs) {
      const op = bin.getOperatorToken().getText();
      if (op === '??' || op === '||') {
        const leftText = bin.getLeft().getText();
        if (leftText.includes('trustedTypes') && leftText.includes('createPolicy')) {
          return true;
        }
      }
    }
  }
  return false;
}

function hasInnerHTMLWithCreateHTML(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  const binaryExprs = sourceFiles.flatMap((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
  );

  for (const bin of binaryExprs) {
    if (bin.getOperatorToken().getText() === '=') {
      const left = bin.getLeft();
      if (
        left.isKind(SyntaxKind.PropertyAccessExpression) &&
        (left as PropertyAccessExpression).getName() === 'innerHTML'
      ) {
        const right = bin.getRight();
        // Direct call: element.innerHTML = policy.createHTML(...)
        const rightCalls = [
          ...(right.isKind(SyntaxKind.CallExpression) ? [right as CallExpression] : []),
          ...right.getDescendantsOfKind(SyntaxKind.CallExpression),
        ];
        if (
          rightCalls.some((c) => {
            const expr = c.getExpression();
            return (
              expr.isKind(SyntaxKind.PropertyAccessExpression) &&
              (expr as PropertyAccessExpression).getName() === 'createHTML'
            );
          })
        ) {
          return true;
        }

        // Identifier assigned from policy.createHTML(...): const clean = policy.createHTML(...); element.innerHTML = clean;
        if (right.isKind(SyntaxKind.Identifier)) {
          const varName = right.getText();
          const varDecls = sourceFiles.flatMap((sf) =>
            sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
          );
          for (const decl of varDecls) {
            if (decl.getName() === varName) {
              const init = decl.getInitializer();
              if (init) {
                const initCalls = [
                  ...(init.isKind(SyntaxKind.CallExpression) ? [init as CallExpression] : []),
                  ...init.getDescendantsOfKind(SyntaxKind.CallExpression),
                ];
                if (
                  initCalls.some((c) => {
                    const expr = c.getExpression();
                    return (
                      expr.isKind(SyntaxKind.PropertyAccessExpression) &&
                      (expr as PropertyAccessExpression).getName() === 'createHTML'
                    );
                  })
                ) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }
  return false;
}

test.describe('trusted-types Target Grader', () => {
  test('Configures a Content Security Policy meta tag or config enforcing require-trusted-types-for script', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasMetaCsp = docs.some(({ document }) => {
      const metas = Array.from(document.querySelectorAll('meta'));
      return metas.some((meta) => {
        const httpEquiv = meta.getAttribute('http-equiv') || '';
        const content = meta.getAttribute('content') || '';
        return (
          httpEquiv.toLowerCase() === 'content-security-policy' &&
          content.includes('require-trusted-types-for') &&
          content.includes("'script'")
        );
      });
    });

    const project: Project = getJsProject(targetFiles);
    const hasJsCsp = project.getSourceFiles().some((sf) => {
      const stringLiterals = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
      ];
      return stringLiterals.some((lit) => {
        const val = lit.getLiteralValue();
        return val.includes('require-trusted-types-for') && val.includes("'script'");
      });
    });

    expect(hasMetaCsp || hasJsCsp).toBe(true);
  });

  test('Defines a Trusted Types policy using trustedTypes.createPolicy() with a createHTML rule', () => {
    const project: Project = getJsProject(targetFiles);
    expect(hasCreatePolicyWithCreateHTML(project)).toBe(true);
  });

  test('Provides a fallback when window.trustedTypes is not natively supported', () => {
    const project: Project = getJsProject(targetFiles);
    expect(hasTrustedTypesFallback(project)).toBe(true);
  });

  test('Converts HTML through the policy createHTML() method when writing to Element.innerHTML', () => {
    const project: Project = getJsProject(targetFiles);
    expect(hasInnerHTMLWithCreateHTML(project)).toBe(true);
  });

  test.describe('Browser tests', () => {
    test('Enforces require-trusted-types-for script via CSP header or meta tag at runtime', async ({
      page,
      TARGET_URL,
    }) => {
      const response = await page.goto(TARGET_URL);
      const headers = response?.headers() || {};
      const cspHeader = headers['content-security-policy'] || '';

      const hasCspInDomOrHeader = await page.evaluate((headerVal) => {
        if (
          headerVal.includes('require-trusted-types-for') &&
          headerVal.includes("'script'")
        ) {
          return true;
        }
        const metas = Array.from(document.querySelectorAll('meta'));
        return metas.some((meta) => {
          const httpEquiv = (meta.getAttribute('http-equiv') || '').toLowerCase();
          const content = meta.getAttribute('content') || '';
          return (
            httpEquiv === 'content-security-policy' &&
            content.includes('require-trusted-types-for') &&
            content.includes("'script'")
          );
        });
      }, cspHeader);

      expect(hasCspInDomOrHeader).toBe(true);
    });

    test('Blocks raw string assignment to Element.innerHTML with a TypeError or sanitizes via a default policy', async ({
      page,
      TARGET_URL,
    }) => {
      await page.goto(TARGET_URL);

      const isBlockedOrDefaultSanitized = await page.evaluate(() => {
        const testDiv = document.createElement('div');
        try {
          testDiv.innerHTML = '<img src="x" onerror="window.__xssExecuted = true"><script>window.__xssExecuted = true</script>';
          // If no TypeError was thrown, a default policy must have intercepted and sanitized it
          const win = window as unknown as { trustedTypes?: { defaultPolicy?: unknown } };
          const defaultPolicy = win.trustedTypes?.defaultPolicy;
          const hasUnsafeMarkup =
            testDiv.querySelector('script') !== null ||
            testDiv.querySelector('[onerror]') !== null;
          return Boolean(defaultPolicy) && !hasUnsafeMarkup;
        } catch (err) {
          return err instanceof TypeError;
        }
      });

      expect(isBlockedOrDefaultSanitized).toBe(true);
    });

    test('Sanitizes or escapes untrusted HTML via the policy createHTML() and renders content without executable scripts or inline event handlers', async ({
      page,
      TARGET_URL,
    }) => {
      await page.addInitScript(() => {
        const win = window as unknown as {
          trustedTypes?: {
            createPolicy?: (name: string, rules: Record<string, unknown>) => unknown;
          };
          __capturedPolicies?: unknown[];
          DOMParser?: {
            prototype: {
              parseFromString: (str: string, type: DOMParserSupportedType) => Document;
            };
          };
        };
        const orig = win.trustedTypes;
        if (orig && typeof orig.createPolicy === 'function') {
          const origCreate = orig.createPolicy.bind(orig);
          // Pre-create an internal helper policy before CSP <meta> tags restrict policy names,
          // so custom sanitizers that invoke DOMParser.parseFromString(..., 'text/html') inside
          // createHTML() can pass a TrustedHTML value to the native parser without failing.
          let rawParserPolicy: { createHTML?: (s: string) => unknown } | null = null;
          try {
            rawParserPolicy = origCreate('__grader_domparser_helper__', {
              createHTML: (s: string) => s,
            }) as { createHTML?: (s: string) => unknown };
          } catch {
            rawParserPolicy = null;
          }

          win.__capturedPolicies = [];
          orig.createPolicy = function (
            name: string,
            rules: Record<string, unknown>
          ): unknown {
            const policy = origCreate(name, rules);
            win.__capturedPolicies?.push({
              name,
              policy,
              rules,
            });
            return policy;
          };

          if (win.DOMParser && win.DOMParser.prototype) {
            const origParse = win.DOMParser.prototype.parseFromString;
            win.DOMParser.prototype.parseFromString = function (
              str: string,
              type: DOMParserSupportedType
            ): Document {
              try {
                return origParse.call(this, str, type);
              } catch (err) {
                if (
                  err instanceof TypeError &&
                  type === 'text/html' &&
                  rawParserPolicy &&
                  typeof rawParserPolicy.createHTML === 'function'
                ) {
                  const trustedStr = rawParserPolicy.createHTML(String(str)) as unknown as string;
                  return origParse.call(this, trustedStr, type);
                }
                throw err;
              }
            };
          }
        }
      });

      await page.goto(TARGET_URL);

      const sanitizedAndRenderedSafely = await page.evaluate(() => {
        const captured =
          (
            window as unknown as {
              __capturedPolicies?: Array<{
                name: string;
                policy: { createHTML?: (input: string) => unknown };
              }>;
            }
          ).__capturedPolicies || [];

        // Find the application policy (prefer non-dompurify internal policy if multiple exist)
        const appPolicyEntry =
          captured.find((p) => p.name !== 'dompurify' && typeof p.policy?.createHTML === 'function') ||
          captured.find((p) => typeof p.policy?.createHTML === 'function');

        if (!appPolicyEntry || typeof appPolicyEntry.policy.createHTML !== 'function') {
          return false;
        }

        const maliciousPayload =
          '<div class="card"><h3>Test Drink</h3><img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Link</a></div>';
        const trustedOutput = appPolicyEntry.policy.createHTML(maliciousPayload);

        // Verify the output can be assigned to innerHTML under Trusted Types enforcement
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = trustedOutput as string;

        const hasScriptInOutput = tempContainer.querySelector('script') !== null;
        const hasEventHandlersInOutput = Array.from(tempContainer.querySelectorAll('*')).some((el) =>
          Array.from(el.attributes).some((attr) => attr.name.toLowerCase().startsWith('on'))
        );

        // Also check the live document body for rendered cards and absence of inline on* attributes
        const cards = document.querySelectorAll('.grid .card');
        const hasAnyInlineEventHandlersInDom = Array.from(document.querySelectorAll('*')).some((el) =>
          Array.from(el.attributes).some((attr) => attr.name.toLowerCase().startsWith('on'))
        );

        return (
          !hasScriptInOutput &&
          !hasEventHandlersInOutput &&
          cards.length >= 3 &&
          !hasAnyInlineEventHandlersInDom
        );
      });

      expect(sanitizedAndRenderedSafely).toBe(true);
    });

    test('Provides a fallback that allows policy creation and sanitization when window.trustedTypes is not natively supported', async ({
      page,
      TARGET_URL,
    }) => {
      // Strip require-trusted-types-for 'script' from CSP headers and meta tags
      // so the simulated browser environment without window.trustedTypes does not
      // enforce native TrustedHTML sink checks on fallback strings.
      await page.route('**/*', async (route) => {
        const response = await route.fetch();
        const headers = { ...response.headers() };
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === 'content-security-policy') {
            delete headers[key];
          }
        }
        const contentType = headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          const body = await response.text();
          const strippedBody = body.replace(
            /<meta[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi,
            ''
          );
          await route.fulfill({ response, headers, body: strippedBody });
        } else {
          await route.fulfill({ response, headers });
        }
      });

      await page.addInitScript(() => {
        Object.defineProperty(window, 'trustedTypes', {
          value: undefined,
          writable: true,
          configurable: true,
        });
      });

      await page.goto(TARGET_URL);

      const project: Project = getJsProject(targetFiles);
      const hasStaticFallback =
        hasCreatePolicyWithCreateHTML(project) && hasTrustedTypesFallback(project);

      const fallbackWorks = await page.evaluate(() => {
        const tt = (window as unknown as {
          trustedTypes?: {
            createPolicy?: (name: string, rules: { createHTML: (s: string) => string }) => {
              createHTML?: (s: string) => string;
            };
          };
        }).trustedTypes;

        if (typeof tt?.createPolicy === 'function') {
          const testRules = { createHTML: (s: string) => s };
          const p = tt.createPolicy('test-fallback', testRules);
          return typeof p?.createHTML === 'function';
        }
        // Also support ternary/conditional fallback where the app falls back to the rules object and renders cards dynamically
        const cards = document.querySelectorAll('.grid .card');
        const hasScripts = document.querySelectorAll('script').length > 0;
        return hasScripts && cards.length >= 3;
      });

      expect(hasStaticFallback && fallbackWorks).toBe(true);
    });
  });
});
