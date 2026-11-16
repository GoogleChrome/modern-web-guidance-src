import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type CallExpression, type Node, type SourceFile } from 'ts-morph';
import { pathToFileURL } from 'node:url';
import { CSSStyleRule } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(pathToFileURL(process.cwd() + '/grader.ts').href);

function getSubmitHandlerNodes(sourceFiles: SourceFile[]): Node[] {
  const handlers: Node[] = [];

  for (const sf of sourceFiles) {
    // 1. Collect functions/arrows passed to addEventListener('submit', ...)
    const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of callExprs) {
      const expr = call.getExpression();
      if (
        expr.isKind(SyntaxKind.PropertyAccessExpression) &&
        expr.getName() === 'addEventListener'
      ) {
        const args = call.getArguments();
        const firstArgText = args[0]?.getText().replace(/^['"`]|['"`]$/g, '');
        if (firstArgText === 'submit' && args[1]) {
          handlers.push(args[1]);
        }
      }
    }

    // 2. Collect .onsubmit = ... assignments
    const binExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const bin of binExprs) {
      const left = bin.getLeft();
      if (
        left.isKind(SyntaxKind.PropertyAccessExpression) &&
        left.getName() === 'onsubmit' &&
        bin.getOperatorToken().getText() === '='
      ) {
        handlers.push(bin.getRight());
      }
    }
  }

  // Fallback: if no explicit listener found, return all sourceFiles so helpers can still be inspected if structured differently,
  // or resolve any helper functions called inside the submit handlers.
  const expanded: Node[] = [...handlers];
  const visitedNames = new Set<string>();

  for (const handler of handlers) {
    const sf = handler.getSourceFile();
    // Resolve identifier handler reference (e.g. form.addEventListener('submit', handleSubmit))
    if (handler.isKind(SyntaxKind.Identifier)) {
      const name = handler.getText();
      visitedNames.add(name);
      for (const file of sourceFiles) {
        file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach((fn) => {
          if (fn.getName() === name) expanded.push(fn);
        });
        file.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((vd) => {
          if (vd.getName() === name) expanded.push(vd);
        });
      }
    }

    // Also include local/top-level helper functions called from within the handler
    const innerCalls = handler.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of innerCalls) {
      const callee = call.getExpression();
      if (callee.isKind(SyntaxKind.Identifier)) {
        const fnName = callee.getText();
        if (!visitedNames.has(fnName)) {
          visitedNames.add(fnName);
          sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach((fn) => {
            if (fn.getName() === fnName) expanded.push(fn);
          });
          sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((vd) => {
            if (vd.getName() === fnName) expanded.push(vd);
          });
        }
      }
    }
  }

  return expanded;
}

function expressionProducesPromise(arg: Node, scopeNodes: Node[]): boolean {
  // 1. Direct Promise.resolve(...) or Promise.reject(...) or new Promise(...)
  if (arg.isKind(SyntaxKind.NewExpression)) {
    if (arg.getExpression().getText() === 'Promise') return true;
  }

  if (arg.isKind(SyntaxKind.CallExpression)) {
    const callee = arg.getExpression();
    const calleeText = callee.getText();
    if (
      calleeText.startsWith('Promise.') ||
      calleeText === 'fetch' ||
      calleeText.endsWith('.then') ||
      calleeText.endsWith('.catch') ||
      // Method calls and async IIFEs can't be resolved here; assume a Promise
      // rather than failing a valid handler.
      !callee.isKind(SyntaxKind.Identifier)
    ) {
      return true;
    }

    // Check if calling an async function or a function returning a Promise
    if (callee.isKind(SyntaxKind.Identifier)) {
      const fnName = callee.getText();
      for (const scope of scopeNodes) {
        const sf = scope.getSourceFile();
        for (const fn of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
          if (fn.getName() === fnName) {
            if (fn.isAsync()) return true;
            const returns = fn.getDescendantsOfKind(SyntaxKind.ReturnStatement);
            if (
              returns.some((r) => {
                const retExpr = r.getExpression();
                return retExpr ? expressionProducesPromise(retExpr, scopeNodes) : false;
              })
            ) {
              return true;
            }
          }
        }
        for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
          if (vd.getName() === fnName) {
            const init = vd.getInitializer();
            if (
              init &&
              (init.isKind(SyntaxKind.ArrowFunction) || init.isKind(SyntaxKind.FunctionExpression)) &&
              (init.isAsync() ||
                (!init.getBody().isKind(SyntaxKind.Block) &&
                  expressionProducesPromise(init.getBody(), scopeNodes)))
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  // 2. Identifier referencing a variable initialized to a Promise or async call
  if (arg.isKind(SyntaxKind.Identifier)) {
    const varName = arg.getText();
    for (const scope of scopeNodes) {
      const sf = scope.getSourceFile();
      for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        if (vd.getName() === varName) {
          const init = vd.getInitializer();
          if (init && init !== arg && expressionProducesPromise(init, scopeNodes)) {
            return true;
          }
        }
      }
      // Or if it's a parameter of a helper function, check call sites of that helper function
      for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        const init = vd.getInitializer();
        if (init && (init.isKind(SyntaxKind.ArrowFunction) || init.isKind(SyntaxKind.FunctionExpression))) {
          const paramIdx = init.getParameters().findIndex((p) => p.getName() === varName);
          if (paramIdx !== -1) {
            const helperName = vd.getName();
            const helperCalls = sf
              .getDescendantsOfKind(SyntaxKind.CallExpression)
              .filter((c) => c.getExpression().getText() === helperName);
            if (
              helperCalls.some((c) => {
                const callArg = c.getArguments()[paramIdx];
                return callArg ? expressionProducesPromise(callArg, scopeNodes) : false;
              })
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

test.describe('agentic-forms Target Grader', () => {
  test('The form element has both toolname and tooldescription attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const forms = docs.flatMap((d) => Array.from(d.document.querySelectorAll('form')) as any[]);
    expect(forms.length).toBeGreaterThan(0);

    const validForm = forms.find((form) => {
      const toolname = form.getAttribute('toolname')?.trim();
      const tooldescription = form.getAttribute('tooldescription')?.trim();
      return Boolean(toolname && tooldescription);
    });

    expect(validForm).toBeDefined();
  });

  test('Input elements have associated labels or toolparamdescription attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolForms = docs.flatMap(
      (d) =>
        Array.from(d.document.querySelectorAll('form[toolname], form[tooldescription], form')).map((form) => ({
          doc: d.document,
          form: form as any,
        }))
    );
    expect(toolForms.length).toBeGreaterThan(0);

    const controlsWithStatus = toolForms.flatMap(({ doc, form }) => {
      const controls = Array.from(
        form.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"]), select, textarea'
        )
      ) as any[];

      return controls.map((ctrl) => {
        const hasOwnParamDesc = Boolean(ctrl.getAttribute('toolparamdescription')?.trim());
        const parentFieldset = ctrl.closest('fieldset');
        const hasFieldsetParamDesc = Boolean(parentFieldset?.getAttribute('toolparamdescription')?.trim());
        const hasWrappingLabel = Boolean(ctrl.closest('label')?.textContent?.trim());
        const id = ctrl.getAttribute('id')?.trim();
        const hasForLabel = Boolean(
          id &&
            Array.from(doc.querySelectorAll('label') as any[]).some(
              (lbl) => lbl.getAttribute('for') === id && Boolean(lbl.textContent?.trim())
            )
        );
        const hasAriaDesc = Boolean(
          ctrl.getAttribute('aria-description')?.trim() || ctrl.getAttribute('aria-label')?.trim()
        );

        return (
          hasOwnParamDesc ||
          hasFieldsetParamDesc ||
          hasWrappingLabel ||
          hasForLabel ||
          hasAriaDesc
        );
      });
    });

    expect(controlsWithStatus.length).toBeGreaterThan(0);
    expect(controlsWithStatus.every(Boolean)).toBe(true);
  });

  test('The submit event listener uses event.preventDefault()', () => {
    const project = getJsProject(targetFiles);
    const handlerNodes = getSubmitHandlerNodes(project.getSourceFiles());
    expect(handlerNodes.length).toBeGreaterThan(0);

    const hasPreventDefault = handlerNodes.some((node) =>
      node
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          const expr = call.getExpression();
          return (
            expr.isKind(SyntaxKind.PropertyAccessExpression) &&
            expr.getName() === 'preventDefault'
          );
        })
    );

    expect(hasPreventDefault).toBe(true);
  });

  test('The submit event listener checks event.agentInvoked', () => {
    const project = getJsProject(targetFiles);
    const handlerNodes = getSubmitHandlerNodes(project.getSourceFiles());
    expect(handlerNodes.length).toBeGreaterThan(0);

    const checksAgentInvoked = handlerNodes.some((node) => {
      const hasPropAccess = node
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((prop) => prop.getName() === 'agentInvoked');
      const hasElementAccess = node
        .getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
        .some(
          (elem) =>
            elem.getArgumentExpression()?.getText().replace(/^['"`]|['"`]$/g, '') === 'agentInvoked'
        );
      const hasBinding = node
        .getDescendantsOfKind(SyntaxKind.BindingElement)
        .some((b) => (b.getPropertyNameNode()?.getText() || b.getName()) === 'agentInvoked');

      return hasPropAccess || hasElementAccess || hasBinding;
    });

    expect(checksAgentInvoked).toBe(true);
  });

  test('The submit event listener calls event.respondWith() with a Promise', () => {
    const project = getJsProject(targetFiles);
    const handlerNodes = getSubmitHandlerNodes(project.getSourceFiles());
    expect(handlerNodes.length).toBeGreaterThan(0);

    const respondWithCalls: CallExpression[] = handlerNodes.flatMap((node) =>
      node.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
        const expr = call.getExpression();
        if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
          return expr.getName() === 'respondWith';
        }
        if (expr.isKind(SyntaxKind.ElementAccessExpression)) {
          return (
            expr.getArgumentExpression()?.getText().replace(/^['"`]|['"`]$/g, '') === 'respondWith'
          );
        }
        return false;
      })
    );

    expect(respondWithCalls.length).toBeGreaterThan(0);

    const calledWithPromise = respondWithCalls.some((call) => {
      const firstArg = call.getArguments()[0];
      return firstArg ? expressionProducesPromise(firstArg, handlerNodes) : false;
    });

    expect(calledWithPromise).toBe(true);
  });

  test('The :tool-form-active pseudo-class is used to provide visual feedback', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);
    expect(styleRules.length).toBeGreaterThan(0);

    const matchingRule = styleRules.find(
      (rule) =>
        rule.selectorText.includes(':tool-form-active') && rule.style.length > 0
    );

    expect(matchingRule).toBeDefined();
  });

  test('The :tool-submit-active pseudo-class is used to provide visual feedback for forms without toolautosubmit', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolForms = docs
      .flatMap((d) => Array.from(d.document.querySelectorAll('form')) as any[])
      .filter((form) => {
        const toolname = form.getAttribute('toolname')?.trim();
        const tooldescription = form.getAttribute('tooldescription')?.trim();
        return Boolean(toolname && tooldescription);
      });
    expect(toolForms.length).toBeGreaterThan(0);

    const formsWithoutAutoSubmit = toolForms.filter((form) => {
      if (!form.hasAttribute('toolautosubmit')) return true;
      const val = form.getAttribute('toolautosubmit');
      return val !== null && val.trim().toLowerCase() === 'false';
    });

    const styleRules = getRules(targetFiles, CSSStyleRule);
    const hasSubmitActiveRule = styleRules.some(
      (rule) =>
        rule.selectorText.includes(':tool-submit-active') && rule.style.length > 0
    );

    expect(formsWithoutAutoSubmit.length === 0 || hasSubmitActiveRule).toBe(true);
  });
});
