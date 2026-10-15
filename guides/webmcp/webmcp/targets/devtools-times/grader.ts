/**
 * WebMCP Discipline Guide Expectations:
 *
 * Expectation 1: TESTED - Verifies feature detection of document.modelContext before calling imperative WebMCP registration methods.
 * Expectation 2: TESTED - Verifies dynamic tools are registered via document.modelContext.registerTool() with name, description, and execute properties.
 * Expectation 3: TESTED - Verifies tools with input parameters define an inputSchema with explicit type and description for each property.
 * Expectation 4: TESTED - Verifies tools querying state without mutating data include annotations: { readOnlyHint: true }.
 * Expectation 5: SKIPPED - DevTools Times does not perform high-stakes or irreversible actions (such as account deletion or financial transactions).
 * Expectation 6: SKIPPED - The application serves static editorial news content rather than user-generated or unvetted third-party content.
 * Expectation 7: TESTED - Verifies an AbortSignal from an AbortController is passed to document.modelContext.registerTool() for lifecycle management.
 * Expectation 8: TESTED - Verifies tool cleanup relies on AbortController.abort() and never calls unregisterTool() directly.
 * Expectation 9: TESTED - Verifies tool execute handlers are asynchronous and await their underlying operations so they resolve after UI updates.
 * Expectation 10: TESTED - Verifies declarative WebMCP <form> elements are annotated with both toolname and tooldescription attributes.
 */

import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind, Node, type ObjectLiteralExpression, type Project } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function resolveToolObject(node: Node | undefined): ObjectLiteralExpression | undefined {
  if (!node) return undefined;
  if (Node.isObjectLiteralExpression(node)) return node;
  if (Node.isIdentifier(node)) {
    const definitions = node.getDefinitions();
    for (const def of definitions) {
      const declNode = def.getDeclarationNode();
      if (declNode && Node.isVariableDeclaration(declNode)) {
        const init = declNode.getInitializer();
        if (init && Node.isObjectLiteralExpression(init)) {
          return init;
        }
      }
    }
  }
  return undefined;
}

/**
 * Collects every tool definition in the project regardless of registration style:
 * inline `registerTool({...})`, `const tool = {...}; registerTool(tool)`, or arrays of
 * tool objects registered in a loop. A tool-shaped literal has both `name` and `execute`.
 */
function collectToolObjects(project: Project): ObjectLiteralExpression[] {
  const found = new Set<ObjectLiteralExpression>();
  for (const sf of project.getSourceFiles()) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (!call.getExpression().getText().endsWith('registerTool')) continue;
      const resolved = resolveToolObject(call.getArguments()[0]);
      if (resolved) found.add(resolved);
    }
    for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
      if (obj.getProperty('name') && obj.getProperty('execute')) found.add(obj);
    }
  }
  return [...found];
}

test.describe('WebMCP Target Grader - DevTools Times', () => {

  test('Expectation 1: Feature-detect document.modelContext before calling WebMCP registration methods', () => {
    const project = getJsProject(targetFiles);
    const hasFeatureDetection = project.getSourceFiles().some((sf) => {
      const fullText = sf.getFullText();
      if (!fullText.includes('modelContext')) return false;

      const ifStmts = sf.getDescendantsOfKind(SyntaxKind.IfStatement);
      const hasIfGuard = ifStmts.some((stmt) => {
        const condText = stmt.getExpression().getText();
        return condText.includes('modelContext');
      });

      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasBinaryGuard = binaryExprs.some((expr) => {
        return expr.getText().includes('modelContext');
      });

      return hasIfGuard || hasBinaryGuard;
    });

    expect(hasFeatureDetection).toBe(true);
  });

  test('Expectation 2: Register dynamic tools via registerTool with name, description, and execute', () => {
    const project = getJsProject(targetFiles);
    const hasRegisterToolCall = project.getSourceFiles().some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
        call.getExpression().getText().endsWith('registerTool')
      )
    );
    const hasValidToolDefinition = collectToolObjects(project).some((toolObj) => {
      const hasName = Boolean(toolObj.getProperty('name'));
      const hasDesc = Boolean(toolObj.getProperty('description'));
      const hasExec = Boolean(toolObj.getProperty('execute'));
      return hasName && hasDesc && hasExec;
    });

    expect(hasRegisterToolCall && hasValidToolDefinition).toBe(true);
  });

  test('Expectation 3: Define typed and described inputSchema properties for parameterized tools', () => {
    const project = getJsProject(targetFiles);
    const hasValidInputSchema = collectToolObjects(project).some((toolObj) => {
      const inputSchemaProp = toolObj.getProperty('inputSchema');
      if (!inputSchemaProp || !Node.isPropertyAssignment(inputSchemaProp)) return false;
      const schemaObj = inputSchemaProp.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
      if (!schemaObj) return false;
      const propsProp = schemaObj.getProperty('properties');
      if (!propsProp || !Node.isPropertyAssignment(propsProp)) return false;
      const propsObj = propsProp.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
      if (!propsObj) return false;
      const schemaParams = propsObj.getProperties();
      if (schemaParams.length === 0) return false;
      return schemaParams.every((paramProp) => {
        if (!Node.isPropertyAssignment(paramProp)) return false;
        const paramObj = paramProp.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
        if (!paramObj) return false;
        const hasType = Boolean(paramObj.getProperty('type'));
        const hasDesc = Boolean(paramObj.getProperty('description'));
        return hasType && hasDesc;
      });
    });

    expect(hasValidInputSchema).toBe(true);
  });

  test('Expectation 4: Include readOnlyHint annotation on read-only query tools', () => {
    const project = getJsProject(targetFiles);
    const hasReadOnlyAnnotation = collectToolObjects(project).some((toolObj) => {
      const annotationsProp = toolObj.getProperty('annotations');
      if (!annotationsProp || !Node.isPropertyAssignment(annotationsProp)) return false;
      const annObj = annotationsProp.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
      if (!annObj) return false;
      const readOnlyProp = annObj.getProperty('readOnlyHint');
      if (!readOnlyProp || !Node.isPropertyAssignment(readOnlyProp)) return false;
      const init = readOnlyProp.getInitializer();
      return init?.getKind() === SyntaxKind.TrueKeyword;
    });

    expect(hasReadOnlyAnnotation).toBe(true);
  });

  test('Expectation 7: Pass AbortSignal from AbortController to registerTool', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    // Evaluate project-wide: the controller is often created in one module and
    // the signal threaded through to a registration helper in another.
    const hasAbortController = sourceFiles
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.NewExpression))
      .some((ne) => ne.getExpression().getText() === 'AbortController');

    const registersWithSignal = sourceFiles
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression))
      .some((call) => {
        if (!call.getExpression().getText().endsWith('registerTool')) return false;
        const args = call.getArguments();
        if (args.length < 2) return false;
        const secondArgText = args[1].getText();
        return (
          secondArgText.includes('signal') ||
          secondArgText.includes('options') ||
          secondArgText.includes('controller')
        );
      });

    expect(hasAbortController && registersWithSignal).toBe(true);
  });

  test('Expectation 8: Rely on AbortController.abort for tool cleanup without calling unregisterTool', () => {
    const project = getJsProject(targetFiles);
    let callsUnregisterTool = false;
    let callsAbort = false;

    project.getSourceFiles().forEach((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        const exprText = call.getExpression().getText();
        if (exprText.endsWith('unregisterTool')) {
          callsUnregisterTool = true;
        }
        if (exprText.endsWith('.abort') || exprText.endsWith('?.abort')) {
          callsAbort = true;
        }
      }
    });

    const usesAbortInsteadOfUnregister = callsAbort && !callsUnregisterTool;
    expect(usesAbortInsteadOfUnregister).toBe(true);
  });

  test('Expectation 9: Tool execute handlers are asynchronous and resolve after operations complete', () => {
    const project = getJsProject(targetFiles);
    const toolObjects = collectToolObjects(project);
    const hasAsyncAwaitingExecute = toolObjects.some((toolObj) => {
      const execProp = toolObj.getProperty('execute');
      if (!execProp) return false;
      let isAsync = false;
      if (Node.isMethodDeclaration(execProp)) {
        isAsync = execProp.isAsync();
      } else if (Node.isPropertyAssignment(execProp)) {
        const init = execProp.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          isAsync = init.isAsync();
        }
      }
      const awaitExprs = execProp.getDescendantsOfKind(SyntaxKind.AwaitExpression);
      return isAsync && awaitExprs.length > 0;
    });

    expect(hasAsyncAwaitingExecute).toBe(true);
  });

  test('Expectation 10: Annotate declarative form tools with toolname and tooldescription attributes', () => {
    const project = getJsProject(targetFiles);
    const formElements: Array<{ hasToolName: boolean; hasToolDescription: boolean }> = [];

    project.getSourceFiles().forEach((sf) => {
      const openingForms = sf
        .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
        .filter((el) => el.getTagNameNode().getText() === 'form');
      const selfClosingForms = sf
        .getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
        .filter((el) => el.getTagNameNode().getText() === 'form');
      const allForms = [...openingForms, ...selfClosingForms];

      allForms.forEach((form) => {
        // Match on attribute text so both `toolname="..."` and TSX spreads like
        // `{...({ toolname: '...', tooldescription: '...' } as any)}` are recognized.
        const attrText = form.getAttributes().map((attr) => attr.getText()).join(' ');
        formElements.push({
          hasToolName: /\btoolname\b/.test(attrText),
          hasToolDescription: /\btooldescription\b/.test(attrText),
        });
      });
    });

    const docs = getHtmlDocuments(targetFiles);
    docs.forEach((d) => {
      const forms = d.document.querySelectorAll('form');
      forms.forEach((form: any) => {
        formElements.push({
          hasToolName: form.hasAttribute('toolname'),
          hasToolDescription: form.hasAttribute('tooldescription'),
        });
      });
    });

    // Only forms that opt in as declarative tools (via either attribute) are
    // subject to the rule; those must carry both attributes.
    const toolForms = formElements.filter((f) => f.hasToolName || f.hasToolDescription);
    const hasAnnotatedForms =
      toolForms.length > 0 && toolForms.every((f) => f.hasToolName && f.hasToolDescription);
    expect(hasAnnotatedForms).toBe(true);
  });
});
