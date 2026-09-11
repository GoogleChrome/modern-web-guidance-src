import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { SyntaxKind, Node, type Project } from 'ts-morph';
import { tokenize, CSSStyleRule } from 'cssomnom';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

// @ts-ignore - import.meta is available in ESM runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getTargetCssText(files: string[]): string {
  const cssBlocks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.css')) {
      cssBlocks.push(content);
    } else if (/\.(html|htm|astro)$/i.test(file)) {
      try {
        const { document } = parseHTML(content);
        document.querySelectorAll('style').forEach((style: any) => {
          if (style.textContent) cssBlocks.push(style.textContent);
        });
      } catch {
        const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatches) {
          for (const match of styleMatches) {
            cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
          }
        }
      }
    }
  }
  return cssBlocks.join('\n');
}

function hasPseudoClassRule(cssText: string, pseudoClassName: string): boolean {
  if (!cssText.trim()) return false;
  const tokens = tokenize(cssText);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type === 'colon' && tokens[i + 1].type === 'ident' && tokens[i + 1].value === pseudoClassName) {
      let openBraceIdx = -1;
      for (let j = i + 2; j < tokens.length; j++) {
        if (tokens[j].type === '{') {
          openBraceIdx = j;
          break;
        }
        if (tokens[j].type === '}' || tokens[j].type === 'semicolon') {
          break;
        }
      }
      if (openBraceIdx !== -1) {
        let hasDecl = false;
        for (let k = openBraceIdx + 1; k < tokens.length; k++) {
          if (tokens[k].type === '}') break;
          if (tokens[k].type !== 'whitespace' && tokens[k].type !== 'comment') {
            hasDecl = true;
            break;
          }
        }
        if (hasDecl) return true;
      }
    }
  }
  return false;
}

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
    const cssText = getTargetCssText(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);
    const hasStyleRule = Array.from(stylesheet.cssRules).some(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.includes(':tool-form-active') && r.style.length > 0
    );
    const hasRule = hasStyleRule || hasPseudoClassRule(cssText, 'tool-form-active');
    expect(hasRule).toBe(true);
  });

  test('The :tool-submit-active pseudo-class is used to provide visual feedback', () => {
    const cssText = getTargetCssText(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);
    const hasStyleRule = Array.from(stylesheet.cssRules).some(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.includes(':tool-submit-active') && r.style.length > 0
    );
    const hasRule = hasStyleRule || hasPseudoClassRule(cssText, 'tool-submit-active');
    expect(hasRule).toBe(true);
  });

});
