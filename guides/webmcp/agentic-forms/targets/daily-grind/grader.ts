import { SyntaxKind, Node, type Project } from 'ts-morph';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../test-fixture.ts';
import { CSSStyleRule } from 'cssomnom';

// @ts-ignore - import.meta is available in ESM runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getSubmitListenerNodes(project: Project): Node[] {
  const listeners: Node[] = [];
  const sourceFiles = project.getSourceFiles();

  for (const sf of sourceFiles) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      if (expr.getText().endsWith('addEventListener')) {
        const args = call.getArguments();
        if (args.length >= 2) {
          const firstArgText = args[0].getText().replace(/['"]/g, '');
          if (firstArgText === 'submit') {
            listeners.push(args[1]);
          }
        }
      }
    }

    const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const be of binaryExprs) {
      if (be.getOperatorToken().getText() === '=') {
        const left = be.getLeft().getText();
        if (left.endsWith('.onsubmit') || left === 'onsubmit') {
          listeners.push(be.getRight());
        }
      }
    }
  }

  const resolved = listeners.map((node) => {
    if (Node.isIdentifier(node)) {
      const name = node.getText();
      const sf = node.getSourceFile();
      const fnDecl = sf.getFunction(name);
      if (fnDecl) return fnDecl;
      const varDecl = sf.getVariableDeclaration(name);
      if (varDecl) {
        const init = varDecl.getInitializer();
        if (init) return init;
      }
    }
    return node;
  }).filter((n): n is Node => Boolean(n));

  if (resolved.length > 0) {
    return resolved;
  }

  return sourceFiles;
}

test.describe('daily-grind Target Grader', () => {

  test('The form element has both toolname and tooldescription attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasToolForm = docs.some(({ document }) => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.some((form: any) => {
        const toolName = form.getAttribute('toolname');
        const toolDesc = form.getAttribute('tooldescription');
        return Boolean(toolName && toolName.trim() && toolDesc && toolDesc.trim());
      });
    });
    expect(hasToolForm).toBe(true);
  });

  test('Input elements have associated labels or toolparamdescription attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    let foundValidForm = false;

    for (const { document } of docs) {
      const forms = Array.from(document.querySelectorAll('form[toolname]'));
      for (const form of forms) {
        const inputs = Array.from(
          (form as any).querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]), select, textarea')
        );
        if (inputs.length === 0) continue;

        const allInputsValid = inputs.every((el: any) => {
          const hasToolParamDesc = Boolean(
            el.getAttribute('toolparamdescription')?.trim() ||
            el.closest('fieldset[toolparamdescription]')?.getAttribute('toolparamdescription')?.trim()
          );
          const id = el.getAttribute('id');
          const hasForLabel = Boolean(id && document.querySelector(`label[for="${id}"]`));
          const hasWrappingLabel = Boolean(el.closest('label'));
          const hasAriaLabel = Boolean(
            el.getAttribute('aria-label')?.trim() ||
            el.getAttribute('aria-labelledby')?.trim() ||
            el.getAttribute('aria-description')?.trim()
          );

          return hasToolParamDesc || hasForLabel || hasWrappingLabel || hasAriaLabel;
        });

        if (allInputsValid) {
          foundValidForm = true;
          break;
        }
      }
      if (foundValidForm) break;
    }

    expect(foundValidForm).toBe(true);
  });

  test('The submit event listener uses event.preventDefault()', () => {
    const project = getJsProject(targetFiles);
    const nodes = getSubmitListenerNodes(project);
    const hasPreventDefault = nodes.some((node) => {
      const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const propAccess = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
        return propAccess?.getName() === 'preventDefault' || call.getExpression().getText().endsWith('.preventDefault');
      });
    });
    expect(hasPreventDefault).toBe(true);
  });

  test('The submit event listener checks event.agentInvoked', () => {
    const project = getJsProject(targetFiles);
    const nodes = getSubmitListenerNodes(project);
    const hasAgentInvoked = nodes.some((node) => {
      const propAccesses = node.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const hasProp = propAccesses.some((pa) => pa.getName() === 'agentInvoked');
      const identifiers = node.getDescendantsOfKind(SyntaxKind.Identifier);
      const hasId = identifiers.some((id) => id.getText() === 'agentInvoked');
      return hasProp || hasId;
    });
    expect(hasAgentInvoked).toBe(true);
  });

  test('The submit event listener calls event.respondWith() with a Promise', () => {
    const project = getJsProject(targetFiles);
    const nodes = getSubmitListenerNodes(project);
    const hasRespondWith = nodes.some((node) => {
      const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const propAccess = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
        const isRespondWith = propAccess?.getName() === 'respondWith' || call.getExpression().getText().endsWith('.respondWith');
        return isRespondWith && call.getArguments().length > 0;
      });
    });
    expect(hasRespondWith).toBe(true);
  });

  test('The :tool-form-active pseudo-class is used to provide visual feedback', () => {
    const hasRule = getRules(targetFiles, CSSStyleRule).some(
      (r) => r.selectorText.includes(':tool-form-active') && r.style.length > 0
    );
    expect(hasRule).toBe(true);
  });

  test('The :tool-submit-active pseudo-class is used to provide visual feedback', () => {
    const hasRule = getRules(targetFiles, CSSStyleRule).some(
      (r) => r.selectorText.includes(':tool-submit-active') && r.style.length > 0
    );
    expect(hasRule).toBe(true);
  });

});
