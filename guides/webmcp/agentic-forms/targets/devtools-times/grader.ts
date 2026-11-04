import * as fs from 'fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import { parse, CSSStyleRule, CSSGroupingRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function extractAllStyleRules(rules: CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...extractAllStyleRules(Array.from((rule as CSSGroupingRule).cssRules)));
    }
  }
  return result;
}

function getProcessedCssStyleSheet(files: string[]): CSSStyleSheet {
  const cssBlocks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (/\.css$/i.test(file)) {
      cssBlocks.push(content);
    } else if (/\.(html|htm|astro)$/i.test(file)) {
      const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) {
        for (const match of styleMatches) {
          cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
        }
      }
    }
  }
  // Wrap emerging WebMCP pseudo-classes so CSSOM parser retains them as CSSStyleRules
  const sanitizedCss = cssBlocks.join('\n').replace(/:tool-([a-zA-Z0-9_-]+)/g, ':is(:tool-$1)');
  return parse(sanitizedCss);
}

test.describe('agentic-forms Target Grader', () => {
  test('The form element has both toolname and tooldescription attributes', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);

    const jsxElements = [
      ...project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)),
      ...project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)),
    ];

    const hasJsxToolForm = jsxElements.some((el) => {
      if (el.getTagNameNode().getText() !== 'form') return false;
      const attrs = el.getAttributes();
      const hasToolName = attrs.some((a) => a.getText().startsWith('toolname'));
      const hasToolDesc = attrs.some((a) => a.getText().startsWith('tooldescription'));
      return hasToolName && hasToolDesc;
    });

    const hasHtmlToolForm = docs.some((d) =>
      Boolean(d.document.querySelector('form[toolname][tooldescription]'))
    );

    expect(hasJsxToolForm || hasHtmlToolForm).toBe(true);
  });

  test('Input elements have associated labels or toolparamdescription attributes', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);

    const jsxAttributes = project.getSourceFiles().flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.JsxAttribute)
    );
    const hasToolParamDescJsx = jsxAttributes.some(
      (attr) => attr.getNameNode().getText() === 'toolparamdescription'
    );
    const hasToolParamDescHtml = docs.some((d) =>
      Boolean(d.document.querySelector('[toolparamdescription]'))
    );

    const jsxElements = [
      ...project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)),
      ...project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)),
    ];
    const toolForms = jsxElements.filter((el) => {
      if (el.getTagNameNode().getText() !== 'form') return false;
      const attrs = el.getAttributes();
      return attrs.some((a) => a.getText().startsWith('toolname') || a.getText().startsWith('tooldescription'));
    });

    const hasToolForms = toolForms.length > 0 || docs.some((d) =>
      Boolean(d.document.querySelector('form[toolname], form[tooldescription]'))
    );

    let toolFormInputsValid = false;
    if (hasToolForms) {
      for (const sf of project.getSourceFiles()) {
        const sfForms = sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).filter((el) =>
          el.getTagNameNode().getText() === 'form' &&
          el.getAttributes().some((a) => a.getText().startsWith('toolname') || a.getText().startsWith('tooldescription'))
        );
        if (sfForms.length > 0) {
          const inputs = [
            ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
            ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
          ].filter((el) => el.getTagNameNode().getText() === 'input');

          if (inputs.length > 0) {
            const allValid = inputs.every((input) => {
              const hasParamDesc = input.getAttributes().some((a) => a.getText().startsWith('toolparamdescription'));
              const idAttr = input.getAttributes().find((a) => a.getText().startsWith('id='));
              const idVal = idAttr?.getText().match(/id=["'](.*?)["']/)?.[1];
              const hasLabel = sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).some((label) =>
                label.getTagNameNode().getText() === 'label' &&
                (idVal ? label.getAttributes().some((a) => a.getText().includes(idVal)) : true)
              );
              return hasParamDesc || hasLabel;
            });
            if (allValid) toolFormInputsValid = true;
          }
        }
      }
    }

    expect((hasToolParamDescJsx || hasToolParamDescHtml || toolFormInputsValid) && hasToolForms).toBe(true);
  });

  test('The submit event listener uses event.preventDefault()', () => {
    const project = getJsProject(targetFiles);

    const toolFiles = project.getSourceFiles().filter((sf) => {
      const text = sf.getText();
      const hasToolForm = sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).some((el) =>
        el.getTagNameNode().getText() === 'form' &&
        el.getAttributes().some((a) => a.getText().startsWith('toolname') || a.getText().startsWith('tooldescription'))
      );
      const hasAgentHandling = text.includes('agentInvoked') || text.includes('respondWith');
      return hasToolForm || hasAgentHandling;
    });

    const hasPreventDefault = toolFiles.some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const expr = call.getExpression().getText();
        return expr.endsWith('preventDefault') || expr.endsWith('preventDefault?');
      });
    });

    expect(hasPreventDefault).toBe(true);
  });

  test('The submit event listener checks event.agentInvoked', () => {
    const project = getJsProject(targetFiles);
    const hasAgentInvoked = project.getSourceFiles().some((sf) => {
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      return propAccesses.some((pa) => pa.getName() === 'agentInvoked');
    });

    expect(hasAgentInvoked).toBe(true);
  });

  test('The submit event listener calls event.respondWith() with a Promise', () => {
    const project = getJsProject(targetFiles);
    const hasRespondWith = project.getSourceFiles().some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const exprText = call.getExpression().getText();
        const isRespondWith = exprText.endsWith('respondWith') || exprText.endsWith('respondWith?');
        return isRespondWith && call.getArguments().length > 0;
      });
    });

    expect(hasRespondWith).toBe(true);
  });

  test('The :tool-form-active pseudo-class is used to provide visual feedback', () => {
    const stylesheet = getProcessedCssStyleSheet(targetFiles);
    const fallbackSheet = getCssStyleSheet(targetFiles);
    const rules = [
      ...extractAllStyleRules(Array.from(stylesheet.cssRules)),
      ...extractAllStyleRules(Array.from(fallbackSheet.cssRules)),
    ];

    const hasToolFormActiveRule = rules.some((rule) =>
      rule.selectorText?.includes(':tool-form-active') && rule.style.length > 0
    );

    expect(hasToolFormActiveRule).toBe(true);
  });

  test('The :tool-submit-active pseudo-class is used to provide visual feedback', () => {
    const stylesheet = getProcessedCssStyleSheet(targetFiles);
    const fallbackSheet = getCssStyleSheet(targetFiles);
    const rules = [
      ...extractAllStyleRules(Array.from(stylesheet.cssRules)),
      ...extractAllStyleRules(Array.from(fallbackSheet.cssRules)),
    ];

    const hasToolSubmitActiveRule = rules.some((rule) =>
      rule.selectorText?.includes(':tool-submit-active') && rule.style.length > 0
    );

    expect(hasToolSubmitActiveRule).toBe(true);
  });
});
