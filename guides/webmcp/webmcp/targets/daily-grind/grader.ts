// Manifest of Expectations from expectations.md:
// Expectation 1: TESTED - Feature-detect document.modelContext before calling imperative WebMCP registration methods
// Expectation 2: TESTED - Use document.modelContext.registerTool() to register dynamic client-side tools with name, description, and execute properties
// Expectation 3: TESTED - Define tool input parameters with an inputSchema JSON Schema object where every parameter includes an explicit type and descriptive description
// Expectation 4: SKIPPED: No read-only query tools exist in the base application or are required by task.md (which only asks for coffee ordering actions)
// Expectation 5: TESTED - Pass an AbortSignal from an AbortController to document.modelContext.registerTool() to support tool cleanup and lifecycle management
// Expectation 6: TESTED - Do not call unregisterTool() directly and rely on AbortController.abort() for tool removal
// Expectation 7: TESTED - Ensure tool execute functions resolve only after corresponding UI state updates have completed
// Expectation 8: SKIPPED: The base application has no <form> elements and task.md does not require declarative <form> tools over imperative tools

import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type Project,
  type CallExpression,
  type ObjectLiteralExpression,
  type Expression,
  type Node,
} from 'ts-morph';

// @ts-ignore - package.json omits "type": "module", causing tsc nodenext to warn on import.meta
const targetFiles: string[] = getTargetFiles(import.meta.url);

function findRegisterToolCalls(project: Project): CallExpression[] {
  return project
    .getSourceFiles()
    .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression))
    .filter((call) => {
      const expr = call.getExpression();
      if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
        return expr.getName() === 'registerTool';
      }
      return false;
    });
}

function resolveObjectLiteral(
  node: Node | undefined,
  project: Project
): ObjectLiteralExpression | undefined {
  if (!node) return undefined;
  if (node.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return node;
  }
  if (node.isKind(SyntaxKind.ParenthesizedExpression)) {
    return resolveObjectLiteral(node.getExpression(), project);
  }
  if (node.isKind(SyntaxKind.Identifier)) {
    const name = node.getText();
    for (const sf of project.getSourceFiles()) {
      for (const varDecl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        if (varDecl.getName() === name) {
          const init = varDecl.getInitializer();
          const resolved = resolveObjectLiteral(init, project);
          if (resolved) return resolved;
        }
      }
    }
  }
  if (node.isKind(SyntaxKind.CallExpression)) {
    const expr = node.getExpression();
    if (expr.isKind(SyntaxKind.Identifier)) {
      const fnName = expr.getText();
      for (const sf of project.getSourceFiles()) {
        for (const fnDecl of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
          if (fnDecl.getName() === fnName) {
            for (const ret of fnDecl.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
              const resolved = resolveObjectLiteral(ret.getExpression(), project);
              if (resolved) return resolved;
            }
          }
        }
        for (const varDecl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
          if (varDecl.getName() === fnName) {
            const init = varDecl.getInitializer();
            if (
              init &&
              (init.isKind(SyntaxKind.ArrowFunction) || init.isKind(SyntaxKind.FunctionExpression))
            ) {
              const body = init.getBody();
              if (body.isKind(SyntaxKind.ObjectLiteralExpression) || body.isKind(SyntaxKind.ParenthesizedExpression)) {
                const resolved = resolveObjectLiteral(body, project);
                if (resolved) return resolved;
              }
              for (const ret of body.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
                const resolved = resolveObjectLiteral(ret.getExpression(), project);
                if (resolved) return resolved;
              }
            }
          }
        }
      }
    }
  }
  return undefined;
}

function getObjectPropertyInitializer(
  obj: ObjectLiteralExpression,
  propName: string
): Expression | Node | undefined {
  const prop = obj.getProperty(propName);
  if (!prop) return undefined;
  if (prop.isKind(SyntaxKind.PropertyAssignment)) {
    return prop.getInitializer();
  }
  if (prop.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
    return prop.getNameNode();
  }
  if (prop.isKind(SyntaxKind.MethodDeclaration)) {
    return prop;
  }
  return undefined;
}

test.describe('webmcp Target Grader', () => {
  test('Expectation 1: Feature-detect document.modelContext before calling imperative WebMCP registration methods', () => {
    const project: Project = getJsProject(targetFiles);
    const registerCalls = findRegisterToolCalls(project);
    expect(registerCalls.length).toBeGreaterThan(0);

    const sourceFiles = project.getSourceFiles();
    const hasFeatureDetection =
      registerCalls.some((call) => call.getExpression().getText().includes('?.')) ||
      sourceFiles.some((sf) => {
        // Only count modelContext/registerTool reads in a guard's condition, not
        // code that merely sits inside some unrelated if/ternary/assignment.
        const inside = (outer: Node, inner: Node) =>
          inner.getStart() >= outer.getStart() && inner.getEnd() <= outer.getEnd();
        const hasPropAccessGuard = sf
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((pa) => {
            if (pa.getName() !== 'modelContext' && pa.getName() !== 'registerTool') {
              return false;
            }
            return pa.getAncestors().some(
              (anc) =>
                (anc.isKind(SyntaxKind.IfStatement) && inside(anc.getExpression(), pa)) ||
                (anc.isKind(SyntaxKind.ConditionalExpression) && inside(anc.getCondition(), pa)) ||
                anc.isKind(SyntaxKind.PrefixUnaryExpression) ||
                anc.isKind(SyntaxKind.TypeOfExpression) ||
                (anc.isKind(SyntaxKind.BinaryExpression) &&
                  anc.getOperatorToken().getKind() !== SyntaxKind.EqualsToken &&
                  inside(anc.getLeft(), pa))
            );
          });

        const hasInOperatorGuard = sf
          .getDescendantsOfKind(SyntaxKind.BinaryExpression)
          .some((bin) => {
            if (bin.getOperatorToken().getKind() !== SyntaxKind.InKeyword) return false;
            const left = bin.getLeft();
            return (
              left.isKind(SyntaxKind.StringLiteral) && left.getLiteralValue() === 'modelContext'
            );
          });

        return hasPropAccessGuard || hasInOperatorGuard;
      });

    expect(hasFeatureDetection).toBe(true);
  });

  test('Expectation 2: Use document.modelContext.registerTool() to register dynamic client-side tools with name, description, and execute properties', () => {
    const project: Project = getJsProject(targetFiles);
    const registerCalls = findRegisterToolCalls(project);
    expect(registerCalls.length).toBeGreaterThan(0);

    for (const call of registerCalls) {
      const firstArg = call.getArguments()[0];
      const toolDef = resolveObjectLiteral(firstArg, project);
      if (!toolDef) continue; // dynamic definitions are checked at runtime below
      const nameProp = getObjectPropertyInitializer(toolDef, 'name');
      const descProp = getObjectPropertyInitializer(toolDef, 'description');
      const execProp = getObjectPropertyInitializer(toolDef, 'execute');
      expect(nameProp).toBeDefined();
      expect(descProp).toBeDefined();
      expect(execProp).toBeDefined();
    }
  });

  test('Expectation 5: Pass an AbortSignal from an AbortController to document.modelContext.registerTool() to support tool cleanup and lifecycle management', () => {
    const project: Project = getJsProject(targetFiles);
    const registerCalls = findRegisterToolCalls(project);
    expect(registerCalls.length).toBeGreaterThan(0);

    const newExprs = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.NewExpression));
    const hasAbortController = newExprs.some(
      (ne) => ne.getExpression().getText() === 'AbortController'
    );
    expect(hasAbortController).toBe(true);

    for (const call of registerCalls) {
      const secondArg = call.getArguments()[1];
      expect(secondArg).toBeDefined();
      const optionsObj = resolveObjectLiteral(secondArg, project);
      if (optionsObj) {
        const signalProp = getObjectPropertyInitializer(optionsObj, 'signal');
        expect(signalProp).toBeDefined();
      } else {
        const hasSignalAccess = secondArg
          ?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((pa) => pa.getName() === 'signal');
        expect(Boolean(hasSignalAccess)).toBe(true);
      }
    }
  });

  test('Expectation 6: Do not call unregisterTool() directly and rely on AbortController.abort() for tool removal', () => {
    const project: Project = getJsProject(targetFiles);
    const allCalls = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const abortCalls = allCalls.filter((call) => {
      const expr = call.getExpression();
      return expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'abort';
    });
    expect(abortCalls.length).toBeGreaterThan(0);

    const unregisterCalls = allCalls.filter((call) => {
      const expr = call.getExpression();
      return (
        expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'unregisterTool'
      );
    });
    expect(unregisterCalls.length).toBe(0);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        const registeredTools: Array<{ definition: any; options: any }> = [];
        (window as any).__webmcpRegisteredTools = registeredTools;
        Object.defineProperty(document, 'modelContext', {
          value: {
            registerTool(definition: any, options?: any) {
              registeredTools.push({ definition, options });
              return Promise.resolve();
            },
          },
          configurable: true,
          writable: true,
        });
      });
      await page.goto(TARGET_URL);
    });

    test('Expectation 2 (runtime): Registered tools have name, description, and execute properties', async ({
      page,
    }) => {
      const defs = await page.evaluate(() =>
        ((window as any).__webmcpRegisteredTools || []).map((t: any) => ({
          name: typeof t.definition?.name,
          description: typeof t.definition?.description,
          execute: typeof t.definition?.execute,
        }))
      );
      expect(defs.length).toBeGreaterThan(0);
      for (const d of defs) {
        expect(d).toEqual({ name: 'string', description: 'string', execute: 'function' });
      }
    });

    test('Expectation 3: Define tool input parameters with an inputSchema JSON Schema object where every parameter includes an explicit type and descriptive description', async ({
      page,
    }) => {
      const toolsWithParams = await page.evaluate(() => {
        const tools: Array<{ definition: any; options: any }> =
          (window as any).__webmcpRegisteredTools || [];
        return tools.map((t) => ({
          name: t.definition?.name,
          inputSchema: t.definition?.inputSchema,
          hasDeclarativeFormsWithParams: Array.from(
            document.querySelectorAll('form[toolname][tooldescription]')
          ).map((form) => {
            const controls = Array.from(
              form.querySelectorAll('input[name], select[name], textarea[name]')
            );
            return {
              toolname: form.getAttribute('toolname'),
              controlCount: controls.length,
              allControlsDescribed:
                controls.length > 0 &&
                controls.every((el) => {
                  const desc =
                    el.getAttribute('toolparamdescription') ||
                    el.closest('label')?.textContent?.trim() ||
                    (el.id
                      ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()
                      : '');
                  return Boolean(desc && desc.length > 0);
                }),
            };
          }),
        }));
      });

      expect(toolsWithParams.length).toBeGreaterThan(0);

      let verifiedParamCount = 0;
      for (const tool of toolsWithParams) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        const props = tool.inputSchema.properties || {};
        const propEntries = Object.entries(props) as Array<[string, any]>;

        for (const [, paramSchema] of propEntries) {
          expect(typeof paramSchema.type).toBe('string');
          expect(paramSchema.type.length).toBeGreaterThan(0);
          expect(typeof paramSchema.description).toBe('string');
          expect(paramSchema.description.trim().length).toBeGreaterThan(0);
          verifiedParamCount++;
        }

        if (propEntries.length === 0 && tool.hasDeclarativeFormsWithParams.length > 0) {
          for (const formInfo of tool.hasDeclarativeFormsWithParams) {
            if (formInfo.controlCount > 0 && formInfo.allControlsDescribed) {
              verifiedParamCount += formInfo.controlCount;
            }
          }
        }
      }

      expect(verifiedParamCount).toBeGreaterThan(0);
    });

    test('Expectation 7: Ensure tool execute functions resolve only after corresponding UI state updates have completed', async ({
      page,
    }) => {
      const executionResult = await page.evaluate(async () => {
        const tools: Array<{ definition: any; options: any }> =
          (window as any).__webmcpRegisteredTools || [];
        if (tools.length === 0) {
          return { toolCount: 0, uiUpdatedBeforeResolve: false };
        }

        const getStatusSnapshot = () => {
          const liveNodes = Array.from(
            document.querySelectorAll('[role="status"], [role="alert"], [aria-live], output, dialog')
          );
          const liveText = liveNodes.map((n) => n.textContent?.trim() || '').join(' | ');
          const mainText =
            document.querySelector('main')?.textContent?.replace(/\s+/g, ' ').trim() || '';
          return `${liveText} || ${mainText}`;
        };

        // Find an ordering tool if one exists, otherwise inspect the registered tool(s)
        const orderingTool = tools.find((t) => {
          const props = t.definition?.inputSchema?.properties || {};
          return Object.keys(props).length > 0;
        });

        if (orderingTool) {
          const props = orderingTool.definition.inputSchema.properties;
          const sampleInput: Record<string, any> = {};
          for (const [key, schema] of Object.entries(props) as Array<[string, any]>) {
            if (Array.isArray(schema.enum) && schema.enum.length > 0) {
              sampleInput[key] = schema.enum[0];
            } else if (schema.type === 'integer' || schema.type === 'number') {
              sampleInput[key] = schema.minimum ?? 2;
            } else if (schema.type === 'string') {
              sampleInput[key] = 'small';
            }
          }

          const beforeText = getStatusSnapshot();
          await orderingTool.definition.execute(sampleInput);
          const afterText = getStatusSnapshot();

          return {
            toolCount: tools.length,
            uiUpdatedBeforeResolve: afterText !== beforeText && afterText.length > 0,
          };
        }

        // If the imperative tool is a read-only tool and ordering is via declarative forms,
        // submit a form to update the UI and verify the tool's execute() reflects the updated UI state immediately upon resolution
        const orderForm = document.querySelector('form[toolname], form') as HTMLFormElement | null;
        if (orderForm) {
          const beforeText = getStatusSnapshot();
          let agentResponseResolvedAfterUiUpdate = false;
          const submitEvent = new SubmitEvent('submit', { bubbles: true, cancelable: true });
          Object.defineProperty(submitEvent, 'agentInvoked', { value: true });
          Object.defineProperty(submitEvent, 'respondWith', {
            value: (promise: Promise<any>) => {
              const midText = getStatusSnapshot();
              if (midText !== beforeText && midText.length > 0) {
                agentResponseResolvedAfterUiUpdate = true;
              }
              return promise;
            },
          });
          orderForm.dispatchEvent(submitEvent);
          const afterFormText = getStatusSnapshot();
          const toolResult = await tools[0].definition.execute({});
          const toolText = JSON.stringify(toolResult);

          return {
            toolCount: tools.length,
            uiUpdatedBeforeResolve:
              (agentResponseResolvedAfterUiUpdate || afterFormText !== beforeText) &&
              toolText.length > 0,
          };
        }

        return { toolCount: tools.length, uiUpdatedBeforeResolve: false };
      });

      expect(executionResult.toolCount).toBeGreaterThan(0);
      expect(executionResult.uiUpdatedBeforeResolve).toBe(true);
    });
  });
});
