import * as fs from 'fs';
import {
  Node,
  SyntaxKind,
  type Project,
  type SourceFile,
} from 'ts-morph';
import * as cssomnom from 'cssomnom';
import {
  CSSGroupingRule,
  CSSStyleRule,
  type CSSRuleList,
  type CSSStyleSheet,
} from 'cssomnom';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

const cssomnomModule = cssomnom as any;
if (cssomnomModule.Parser?.prototype?.createStyleRule) {
  const origCreateStyleRule = cssomnomModule.Parser.prototype.createStyleRule;
  cssomnomModule.Parser.prototype.createStyleRule = function (
    prelude: any[],
    blockContents: any[],
    isNested = false
  ) {
    const rule = origCreateStyleRule.call(this, prelude, blockContents, isNested);
    if (rule) return rule;
    const mapped = prelude.map((t: any) =>
      t.type === 'ident' && (t.value === 'tool-form-active' || t.value === 'tool-submit-active')
        ? { ...t, value: 'active', originalText: 'active' }
        : t
    );
    const fallback = origCreateStyleRule.call(this, mapped, blockContents, isNested);
    if (fallback) {
      fallback._selectorAST = null;
      fallback._selectorText = cssomnomModule.serialize(prelude).trim();
    }
    return fallback;
  };
}

// @ts-expect-error -- import.meta is provided by the Playwright ESM runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getSubmitHandlerNodes(project: Project): Node[] {
  const handlers: Node[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      const isAddEventListener =
        (Node.isPropertyAccessExpression(expr) && expr.getName() === 'addEventListener') ||
        (Node.isIdentifier(expr) && expr.getText() === 'addEventListener');
      if (!isAddEventListener) continue;

      const args = call.getArguments();
      if (args.length < 2) continue;

      const eventArg = args[0];
      const eventName = Node.isStringLiteral(eventArg)
        ? eventArg.getLiteralText()
        : Node.isNoSubstitutionTemplateLiteral(eventArg)
          ? eventArg.getLiteralText()
          : '';
      if (eventName !== 'submit') continue;

      const handlerArg = args[1];
      handlers.push(handlerArg);

      if (Node.isIdentifier(handlerArg)) {
        const refName = handlerArg.getText();
        for (const fn of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
          if (fn.getName() === refName) {
            handlers.push(fn);
          }
        }
        for (const varDecl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
          if (varDecl.getName() === refName) {
            const init = varDecl.getInitializer();
            if (init) handlers.push(init);
          }
        }
      }
    }

    for (const bin of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      const left = bin.getLeft();
      if (
        Node.isPropertyAccessExpression(left) &&
        left.getName() === 'onsubmit' &&
        bin.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      ) {
        handlers.push(bin.getRight());
      }
    }
  }

  return handlers;
}

function isPromiseExpression(node: Node, sourceFile: SourceFile, visited = new Set<string>()): boolean {
  if (Node.isParenthesizedExpression(node)) {
    return isPromiseExpression(node.getExpression(), sourceFile, visited);
  }

  if (Node.isNewExpression(node)) {
    return node.getExpression().getText() === 'Promise';
  }

  if (Node.isCallExpression(node)) {
    const callee = node.getExpression();
    if (Node.isPropertyAccessExpression(callee)) {
      const propName = callee.getName();
      if (callee.getExpression().getText() === 'Promise') {
        return true;
      }
      if (propName === 'then' || propName === 'catch' || propName === 'finally') {
        return true;
      }
    }

    if (Node.isIdentifier(callee)) {
      const fnName = callee.getText();
      if (fnName === 'fetch') return true;
      if (visited.has(fnName)) return false;
      visited.add(fnName);

      for (const fn of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
        if (fn.getName() === fnName) {
          if (fn.isAsync()) return true;
          const hasPromise = fn
            .getDescendantsOfKind(SyntaxKind.Identifier)
            .some((id) => id.getText() === 'Promise' || id.getText() === 'fetch');
          if (hasPromise) return true;
        }
      }

      for (const varDecl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        if (varDecl.getName() === fnName) {
          const init = varDecl.getInitializer();
          if (init) {
            if (
              (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) &&
              init.isAsync()
            ) {
              return true;
            }
            const hasPromise = init
              .getDescendantsOfKind(SyntaxKind.Identifier)
              .some((id) => id.getText() === 'Promise' || id.getText() === 'fetch');
            if (hasPromise) return true;
          }
        }
      }
    }
  }

  if (Node.isIdentifier(node)) {
    const varName = node.getText();
    if (visited.has(varName)) return false;
    visited.add(varName);

    for (const varDecl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      if (varDecl.getName() === varName) {
        const init = varDecl.getInitializer();
        if (init && isPromiseExpression(init, sourceFile, visited)) {
          return true;
        }
      }
    }
  }

  return node
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some((id) => id.getText() === 'Promise' || id.getText() === 'fetch');
}

function collectStyleRules(ruleList: CSSRuleList): CSSStyleRule[] {
  const styleRules: CSSStyleRule[] = [];
  for (const rule of Array.from(ruleList)) {
    if (rule instanceof CSSStyleRule) {
      styleRules.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      styleRules.push(...collectStyleRules(rule.cssRules));
    }
  }
  return styleRules;
}

test.describe('agentic-forms Target Grader', () => {
  test('Basic presence: the modified source files contain toolname', () => {
    const hasToolname = targetFiles.some(
      (f) => fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('toolname')
    );
    expect(hasToolname).toBe(true);
  });

  test('The form element has both toolname and tooldescription attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasAnnotatedForm = docs.some(({ document }) =>
      Array.from(document.querySelectorAll('form')).some((form: any) => {
        const toolName = form.getAttribute('toolname')?.trim();
        const toolDesc = form.getAttribute('tooldescription')?.trim();
        return Boolean(toolName && toolDesc);
      })
    );
    expect(hasAnnotatedForm).toBe(true);
  });

  test('Input elements have associated labels or toolparamdescription attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasDescribedInputs = docs.some(({ document }) =>
      Array.from(document.querySelectorAll('form[toolname], form')).some((form: any) => {
        const controls = Array.from(
          form.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea'
          )
        );
        if (controls.length === 0) return false;

        return controls.every((ctrl: any) => {
          const hasToolParamDesc = Boolean(ctrl.getAttribute('toolparamdescription')?.trim());
          const hasFieldsetDesc = Boolean(
            ctrl.closest('fieldset')?.getAttribute('toolparamdescription')?.trim()
          );
          const hasWrappingLabel = Boolean(ctrl.closest('label')?.textContent?.trim());
          const id = ctrl.getAttribute('id')?.trim();
          const hasForLabel = Boolean(
            id &&
              Array.from(document.querySelectorAll('label')).some(
                (lbl: any) => lbl.getAttribute('for') === id && Boolean(lbl.textContent?.trim())
              )
          );
          const hasAriaDesc = Boolean(
            ctrl.getAttribute('aria-description')?.trim() ||
              ctrl.getAttribute('aria-label')?.trim()
          );

          return (
            hasToolParamDesc ||
            hasFieldsetDesc ||
            hasWrappingLabel ||
            hasForLabel ||
            hasAriaDesc
          );
        });
      })
    );
    expect(hasDescribedInputs).toBe(true);
  });

  test('The submit event listener uses event.preventDefault()', () => {
    const project: Project = getJsProject(targetFiles);
    const handlers = getSubmitHandlerNodes(project);
    const usesPreventDefault = handlers.some((handler) =>
      handler.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression();
        return Node.isPropertyAccessExpression(expr) && expr.getName() === 'preventDefault';
      })
    );
    expect(usesPreventDefault).toBe(true);
  });

  test('The submit event listener checks event.agentInvoked', () => {
    const project: Project = getJsProject(targetFiles);
    const handlers = getSubmitHandlerNodes(project);
    const checksAgentInvoked = handlers.some(
      (handler) =>
        handler
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((prop) => prop.getName() === 'agentInvoked') ||
        handler
          .getDescendantsOfKind(SyntaxKind.BindingElement)
          .some((binding) => binding.getName() === 'agentInvoked') ||
        handler
          .getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
          .some(
            (elem) =>
              elem.getArgumentExpression()?.asKind(SyntaxKind.StringLiteral)?.getLiteralText() ===
              'agentInvoked'
          )
    );
    expect(checksAgentInvoked).toBe(true);
  });

  test('The submit event listener calls event.respondWith() with a Promise', () => {
    const project: Project = getJsProject(targetFiles);
    const handlers = getSubmitHandlerNodes(project);
    const callsRespondWithPromise = handlers.some((handler) =>
      handler.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression();
        const isRespondWith =
          (Node.isPropertyAccessExpression(expr) && expr.getName() === 'respondWith') ||
          (Node.isIdentifier(expr) && expr.getText() === 'respondWith');
        if (!isRespondWith) return false;

        const args = call.getArguments();
        if (args.length === 0) return false;

        return isPromiseExpression(args[0], handler.getSourceFile());
      })
    );
    expect(callsRespondWithPromise).toBe(true);
  });

  test('The :tool-form-active pseudo-class is used to provide visual feedback', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const hasToolFormActive = styleRules.some(
      (rule) =>
        rule.selectorText.includes(':tool-form-active') &&
        (rule.style.length > 0 || Boolean(rule.style.cssText?.trim()))
    );
    expect(hasToolFormActive).toBe(true);
  });

  test('The :tool-submit-active pseudo-class is used to provide visual feedback', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const hasToolSubmitActive = styleRules.some(
      (rule) =>
        rule.selectorText.includes(':tool-submit-active') &&
        (rule.style.length > 0 || Boolean(rule.style.cssText?.trim()))
    );
    expect(hasToolSubmitActive).toBe(true);
  });
});
