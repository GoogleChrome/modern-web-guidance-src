/**
 * Expectation Verification Summary:
 * 1. TESTED - Verifies feature detection of document.modelContext before calling imperative WebMCP registration methods.
 * 2. TESTED - Verifies dynamic client-side tools are registered via registerTool with name, description, and execute properties.
 * 3. SKIPPED - Base application does not contain interactive forms or parameterized tool requirements across all solutions.
 * 4. TESTED - Verifies state querying and read tools include annotations with readOnlyHint: true.
 * 5. SKIPPED - Base application does not mandate high-stakes or irreversible actions across all solutions.
 * 6. SKIPPED - Base application does not contain user-generated or third-party dynamic content requiring untrustedContentHint across all solutions.
 * 7. TESTED - Verifies passing an AbortSignal from an AbortController to document.modelContext.registerTool().
 * 8. TESTED - Verifies relying on AbortController.abort() for tool removal and avoiding direct unregisterTool() calls.
 * 9. TESTED - Verifies tool execute handlers resolve only after UI state updates: either they await their work / a frame, or they synchronously reach DOM-mutating code before returning (deferred updates via setTimeout/rAF/.then do not count).
 * 10. SKIPPED - Base application does not contain HTML <form> elements to expose as declarative tools.
 */

import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind, Node, type Project, type PropertyAccessExpression } from 'ts-morph';
import { pathToFileURL } from 'node:url';

const currentFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(process.cwd() + '/grader.ts').href;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

// --- Helpers for Expectation 9 ---

// Properties whose *assignment* mutates the DOM.
const DOM_CONTENT_PROPS = new Set(['innerHTML', 'outerHTML', 'textContent', 'innerText']);
// Methods whose *invocation* mutates the DOM.
const DOM_MUTATION_METHODS = new Set([
  'appendChild', 'insertBefore', 'removeChild', 'replaceChild', 'replaceChildren', 'replaceWith',
  'insertAdjacentHTML', 'insertAdjacentElement', 'setAttribute', 'removeAttribute', 'toggleAttribute',
]);
// Callbacks passed to these run *after* the current task, so UI work inside them
// happens after execute has already resolved.
const DEFERRING_CALLS = new Set(['setTimeout', 'setInterval', 'requestAnimationFrame', 'requestIdleCallback', 'queueMicrotask', 'then']);

function isDomMutation(pae: PropertyAccessExpression): boolean {
  const name = pae.getName();
  const parent = pae.getParent();
  if (DOM_CONTENT_PROPS.has(name)) {
    return Node.isBinaryExpression(parent) && parent.getLeft() === pae
      && parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken;
  }
  if (DOM_MUTATION_METHODS.has(name)) {
    return Node.isCallExpression(parent) && parent.getExpression() === pae;
  }
  // `el.classList.add(...)`, `el.style.display = ...`
  return name === 'classList' || name === 'style';
}

function calleeName(expr: Node): string | undefined {
  if (Node.isIdentifier(expr)) return expr.getText();
  if (Node.isPropertyAccessExpression(expr)) return expr.getName();
  return undefined;
}

// Index every function-like definition in the project by name so calls can be followed.
function indexFunctions(project: Project): Map<string, Node[]> {
  const index = new Map<string, Node[]>();
  const add = (name: string | undefined, fn: Node) => {
    if (!name) return;
    if (!index.has(name)) index.set(name, []);
    index.get(name)!.push(fn);
  };
  for (const sf of project.getSourceFiles()) {
    sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(fn => add(fn.getName(), fn));
    sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration).forEach(fn => add(fn.getName(), fn));
    for (const kind of [SyntaxKind.VariableDeclaration, SyntaxKind.PropertyAssignment] as const) {
      sf.getDescendantsOfKind(kind).forEach(decl => {
        const init = decl.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) add(decl.getName(), init);
      });
    }
  }
  return index;
}

// True if `call` sits inside a callback handed to setTimeout/rAF/.then/etc. within `scope`.
function isDeferred(call: Node, scope: Node): boolean {
  for (let n = call.getParent(); n && n !== scope; n = n.getParent()) {
    if (Node.isCallExpression(n)) {
      const name = calleeName(n.getExpression());
      if (name && DEFERRING_CALLS.has(name)) return true;
    }
  }
  return false;
}

// Does `fn` synchronously reach a DOM mutation, following calls into project functions?
function reachesDomMutation(fn: Node, index: Map<string, Node[]>, depth = 4, visited = new Set<Node>()): boolean {
  if (depth < 0 || visited.has(fn)) return false;
  visited.add(fn);

  const mutations = fn.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter(pae => isDomMutation(pae) && !isDeferred(pae, fn));
  if (mutations.length > 0) return true;

  for (const call of fn.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (isDeferred(call, fn)) continue;
    const name = calleeName(call.getExpression());
    if (!name) continue;
    for (const target of index.get(name) ?? []) {
      if (reachesDomMutation(target, index, depth - 1, visited)) return true;
    }
  }
  return false;
}

function getExecuteFunction(obj: Node): Node | undefined {
  if (!Node.isObjectLiteralExpression(obj)) return undefined;
  const execProp = obj.getProperty('execute');
  if (!execProp) return undefined;
  if (Node.isMethodDeclaration(execProp)) return execProp;
  if (Node.isPropertyAssignment(execProp)) {
    const init = execProp.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) return init;
  }
  return undefined;
}

test.describe('WebMCP Daily Grind Target Grader', () => {
  test('Expectation 1: Feature-detects document.modelContext before calling registration methods', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const ifStatements = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.IfStatement));
    const hasIfCondition = ifStatements.some(stmt => {
      const condText = stmt.getExpression().getText();
      return condText.includes('modelContext');
    });

    const binaryExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.BinaryExpression));
    const hasBinaryCheck = binaryExpressions.some(expr => {
      return expr.getText().includes('modelContext');
    });

    const conditionalExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression));
    const hasTernaryCheck = conditionalExpressions.some(expr => {
      return expr.getCondition().getText().includes('modelContext');
    });

    const propertyAccesses = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression));
    const hasOptionalChaining = propertyAccesses.some(pa => {
      return pa.hasQuestionDotToken() && pa.getText().includes('modelContext');
    });

    const hasFeatureDetection = hasIfCondition || hasBinaryCheck || hasTernaryCheck || hasOptionalChaining;
    expect(hasFeatureDetection).toBe(true);
  });

  test('Expectation 2 (Method): Registers client-side tools using document.modelContext.registerTool()', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasRegisterToolCall = callExpressions.some(call => {
      const exprText = call.getExpression().getText();
      return /\bregisterTool\b/.test(exprText);
    });

    expect(hasRegisterToolCall).toBe(true);
  });

  test('Expectation 2 (Properties): Declares tools with name, description, and execute properties', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const objectLiterals = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression));
    const hasToolProperties = objectLiterals.some(obj => {
      const propNames = obj.getProperties().map(p => {
        if (
          p.isKind(SyntaxKind.PropertyAssignment) ||
          p.isKind(SyntaxKind.MethodDeclaration) ||
          p.isKind(SyntaxKind.ShorthandPropertyAssignment)
        ) {
          return p.getName?.() || '';
        }
        return '';
      });
      return propNames.includes('name') && propNames.includes('description') && propNames.includes('execute');
    });

    expect(hasToolProperties).toBe(true);
  });

  test('Expectation 4: Includes annotations with readOnlyHint: true on query/read tools', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const objectLiterals = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression));
    const hasReadOnlyHint = objectLiterals.some(obj => {
      const prop = obj.getProperty('readOnlyHint');
      if (prop && prop.isKind(SyntaxKind.PropertyAssignment)) {
        return prop.getInitializer()?.getText() === 'true';
      }
      return false;
    });

    expect(hasReadOnlyHint).toBe(true);
  });

  test('Expectation 7: Passes an AbortSignal from AbortController to registerTool for lifecycle management', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const newExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.NewExpression));
    const hasAbortController = newExpressions.some(ne => ne.getExpression().getText() === 'AbortController');

    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const registerToolCalls = callExpressions.filter(call => /\bregisterTool\b/.test(call.getExpression().getText()));
    const passesSignal = registerToolCalls.some(call => {
      const args = call.getArguments();
      return args.some((arg, index) => index > 0 && /\bsignal\b/.test(arg.getText()));
    });

    const usesAbortSignal = hasAbortController && passesSignal;
    expect(usesAbortSignal).toBe(true);
  });

  test('Expectation 8: Relies on AbortController.abort() for tool removal and does not call unregisterTool() directly', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasAbortCall = callExpressions.some(call => {
      const expr = call.getExpression().getText();
      return expr.endsWith('.abort') || expr === 'abort';
    });

    // Ignore `this.unregisterTool(...)` — that's a polyfill's own implementation
    // (e.g. invoked from its abort listener), not the app calling it directly.
    const callsUnregisterTool = callExpressions.some(call => {
      const expr = call.getExpression().getText();
      return /\bunregisterTool\b/.test(expr) && !expr.startsWith('this.');
    });

    const reliesOnAbort = hasAbortCall && !callsUnregisterTool;
    expect(reliesOnAbort).toBe(true);
  });

  test('Expectation 9: Ensures tool execute functions resolve only after corresponding UI state updates have completed', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    // A tool-shaped object literal has at least `name` and `execute`. Accept any
    // registration style (inline literal, const, array + loop) by scanning literals directly.
    const objectLiterals = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression));
    const toolObjects = objectLiterals.filter(obj => obj.getProperty('name') && obj.getProperty('execute'));
    const executeFns = toolObjects.map(getExecuteFunction).filter((fn): fn is Node => !!fn);

    // Path A: execute awaits its work (e.g. a render promise, a fetch, or a frame).
    const hasAsyncAwaitingExecute = executeFns.some(fn => {
      const isAsync = (Node.isMethodDeclaration(fn) || Node.isArrowFunction(fn) || Node.isFunctionExpression(fn)) && fn.isAsync();
      return isAsync && fn.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0;
    });

    // Path B: execute synchronously reaches DOM-mutating code before returning
    // (the synchronous-render equivalent of awaiting the update). Calls deferred
    // via setTimeout/rAF/.then are not followed, so fire-and-forget still fails.
    const functionIndex = indexFunctions(project);
    const hasSyncUiUpdatingExecute = executeFns.some(fn => reachesDomMutation(fn, functionIndex));

    // Path C: explicitly waiting for a paint before resolving.
    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const waitsForFrame = callExpressions.some(call => /\brequestAnimationFrame\b/.test(call.getExpression().getText()));

    expect(hasAsyncAwaitingExecute || hasSyncUiUpdatingExecute || waitsForFrame).toBe(true);
  });
});
