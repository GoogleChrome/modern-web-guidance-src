import * as fs from 'fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import {
  SyntaxKind,
  type Project,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type JsxElement,
} from 'ts-morph';
import type { Document } from 'linkedom';
import * as cssomnom from 'cssomnom';
import { CSSStyleRule, CSSGroupingRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';

interface CssToken {
  type: string;
  value?: string | CssToken[];
}

interface CssomnomInternal {
  Parser?: {
    prototype: {
      createStyleRule: (
        this: {
          isValidSelector: (prelude: CssToken[]) => boolean;
          normalizeNestedSelector: (prelude: CssToken[]) => string;
        },
        prelude: CssToken[],
        blockContents: unknown[],
        isNested?: boolean
      ) => CSSStyleRule | null;
    };
  };
  serialize?: (tokens: CssToken[]) => string;
}

const cssInternal = cssomnom as unknown as CssomnomInternal;
if (cssInternal.Parser && cssInternal.serialize) {
  const origCreateStyleRule = cssInternal.Parser.prototype.createStyleRule;
  const serializeTokens = cssInternal.serialize;
  const mapToken = (t: CssToken): CssToken => {
    if (t.type === 'ident' && typeof t.value === 'string' && /^tool-(form|submit)-active$/.test(t.value)) {
      return { ...t, value: 'active' };
    }
    if (Array.isArray(t.value)) {
      return { ...t, value: t.value.map(mapToken) };
    }
    return t;
  };
  cssInternal.Parser.prototype.createStyleRule = function (
    prelude: CssToken[],
    blockContents: unknown[],
    isNested = false
  ): CSSStyleRule | null {
    const rule = origCreateStyleRule.call(this, prelude, blockContents, isNested);
    if (rule) return rule;
    const patchedPrelude = prelude.map(mapToken);
    const fallback = origCreateStyleRule.call(this, patchedPrelude, blockContents, isNested);
    if (fallback) {
      const rawSelector = isNested
        ? this.normalizeNestedSelector(prelude)
        : serializeTokens(prelude).trim();
      Object.defineProperty(fallback, 'selectorText', { value: rawSelector });
    }
    return fallback;
  };
}

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getJsxAttrValue(
  el: JsxOpeningElement | JsxSelfClosingElement,
  attrName: string
): string | null {
  for (const attr of el.getAttributes()) {
    if (
      attr.isKind(SyntaxKind.JsxAttribute) &&
      attr.getNameNode().getText().toLowerCase() === attrName.toLowerCase()
    ) {
      const init = attr.getInitializer();
      if (!init) return '';
      if (init.isKind(SyntaxKind.StringLiteral)) {
        return init.getLiteralValue();
      }
      if (init.isKind(SyntaxKind.JsxExpression)) {
        const expr = init.getExpression();
        if (expr && expr.isKind(SyntaxKind.StringLiteral)) {
          return expr.getLiteralValue();
        }
        return expr ? expr.getText() : '';
      }
      return init.getText();
    }
  }
  return null;
}

function collectCssStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule) {
      result.push(...collectCssStyleRules(rule.cssRules));
    }
  }
  return result;
}

test.describe('agentic-forms Target Grader', () => {
  test('Basic presence: the modified source files contain toolname', () => {
    const hasToolname = targetFiles.some(
      (f) =>
        fs.existsSync(f) &&
        !fs.statSync(f).isDirectory() &&
        fs.readFileSync(f, 'utf8').includes('toolname')
    );
    expect(hasToolname).toBe(true);
  });

  test('The form element has both toolname and tooldescription attributes', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasHtmlAgenticForm = docs.some((d) =>
      Array.from(d.document.querySelectorAll('form')).some(
        (form) =>
          Boolean(form.getAttribute('toolname')?.trim()) &&
          Boolean(form.getAttribute('tooldescription')?.trim())
      )
    );

    const project: Project = getJsProject(targetFiles);
    const jsxForms = project
      .getSourceFiles()
      .flatMap((sf) => [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ])
      .filter((el) => el.getTagNameNode().getText() === 'form');

    const hasJsxAgenticForm = jsxForms.some(
      (formEl) =>
        Boolean(getJsxAttrValue(formEl, 'toolname')?.trim()) &&
        Boolean(getJsxAttrValue(formEl, 'tooldescription')?.trim())
    );

    expect(hasHtmlAgenticForm || hasJsxAgenticForm).toBe(true);
  });

  test('Input elements have associated labels or toolparamdescription attributes', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    let totalInputs = 0;
    let allInputsAnnotated = true;

    for (const { document } of docs) {
      const forms = Array.from(document.querySelectorAll('form[toolname]'));
      for (const form of forms) {
        const inputs = Array.from(form.querySelectorAll('input, select, textarea')).filter((el) => {
          const type = (el.getAttribute('type') || '').toLowerCase();
          return !['submit', 'button', 'reset', 'hidden'].includes(type);
        });
        for (const input of inputs) {
          totalInputs++;
          const id = input.getAttribute('id')?.trim();
          const hasParamDesc =
            Boolean(input.getAttribute('toolparamdescription')?.trim()) ||
            Boolean(input.closest('fieldset[toolparamdescription]'));
          const hasLabel =
            Boolean(input.closest('label')?.textContent?.trim()) ||
            Boolean(id && document.querySelector(`label[for="${id}"]`)?.textContent?.trim());
          const hasAria = Boolean(
            input.getAttribute('aria-description')?.trim() ||
              input.getAttribute('aria-label')?.trim()
          );
          if (!hasParamDesc && !hasLabel && !hasAria) {
            allInputsAnnotated = false;
          }
        }
      }
    }

    const project: Project = getJsProject(targetFiles);
    for (const sf of project.getSourceFiles()) {
      const labelElements = sf
        .getDescendantsOfKind(SyntaxKind.JsxElement)
        .filter((el) => el.getOpeningElement().getTagNameNode().getText() === 'label');
      const labelForIds = new Set<string>();
      for (const labelEl of labelElements) {
        const opening = labelEl.getOpeningElement();
        const forVal =
          getJsxAttrValue(opening, 'htmlFor')?.trim() ?? getJsxAttrValue(opening, 'for')?.trim();
        if (forVal && labelEl.getJsxChildren().length > 0) {
          labelForIds.add(forVal);
        }
      }

      const jsxForms = sf
        .getDescendantsOfKind(SyntaxKind.JsxElement)
        .filter(
          (el) =>
            el.getOpeningElement().getTagNameNode().getText() === 'form' &&
            getJsxAttrValue(el.getOpeningElement(), 'toolname') !== null
        );

      for (const formEl of jsxForms) {
        const inputNodes = [
          ...formEl.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
          ...formEl.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
        ].filter((el) => {
          const tag = el.getTagNameNode().getText();
          if (!['input', 'select', 'textarea'].includes(tag)) return false;
          const type = (getJsxAttrValue(el, 'type') || '').toLowerCase();
          return !['submit', 'button', 'reset', 'hidden'].includes(type);
        });

        for (const inputEl of inputNodes) {
          totalInputs++;
          const hasParamDesc =
            Boolean(getJsxAttrValue(inputEl, 'toolparamdescription')?.trim()) ||
            inputEl
              .getAncestors()
              .some(
                (anc): anc is JsxElement =>
                  anc.isKind(SyntaxKind.JsxElement) &&
                  anc.getOpeningElement().getTagNameNode().getText() === 'fieldset' &&
                  Boolean(getJsxAttrValue(anc.getOpeningElement(), 'toolparamdescription')?.trim())
              );
          const hasWrappingLabel = inputEl
            .getAncestors()
            .some(
              (anc): anc is JsxElement =>
                anc.isKind(SyntaxKind.JsxElement) &&
                anc.getOpeningElement().getTagNameNode().getText() === 'label'
            );
          const id = getJsxAttrValue(inputEl, 'id')?.trim();
          const hasMatchingLabel = Boolean(id && labelForIds.has(id));
          const hasAria = Boolean(
            getJsxAttrValue(inputEl, 'aria-description')?.trim() ||
              getJsxAttrValue(inputEl, 'aria-label')?.trim()
          );

          if (!hasParamDesc && !hasWrappingLabel && !hasMatchingLabel && !hasAria) {
            allInputsAnnotated = false;
          }
        }
      }
    }

    expect(totalInputs > 0 && allInputsAnnotated).toBe(true);
  });

  test('The submit event listener uses event.preventDefault()', () => {
    const project: Project = getJsProject(targetFiles);
    const hasPreventDefault = project
      .getSourceFiles()
      .filter((sf) => !sf.isDeclarationFile())
      .some((sf) =>
        sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
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
    const project: Project = getJsProject(targetFiles);
    const hasAgentInvokedCheck = project
      .getSourceFiles()
      .filter((sf) => !sf.isDeclarationFile())
      .some((sf) => {
        const hasPropAccess = sf
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((prop) => prop.getName() === 'agentInvoked');
        const hasBinding = sf
          .getDescendantsOfKind(SyntaxKind.BindingElement)
          .some((b) => b.getNameNode().getText() === 'agentInvoked');
        return hasPropAccess || hasBinding;
      });

    expect(hasAgentInvokedCheck).toBe(true);
  });

  test('The submit event listener calls event.respondWith() with a Promise', () => {
    const project: Project = getJsProject(targetFiles);
    const hasRespondWithPromise = project
      .getSourceFiles()
      .filter((sf) => !sf.isDeclarationFile())
      .some((sf) =>
        sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
          const expr = call.getExpression();
          if (
            !expr.isKind(SyntaxKind.PropertyAccessExpression) ||
            expr.getName() !== 'respondWith'
          ) {
            return false;
          }
          const args = call.getArguments();
          if (args.length === 0) return false;
          const firstArg = args[0];
          return (
            !firstArg.isKind(SyntaxKind.StringLiteral) &&
            !firstArg.isKind(SyntaxKind.NumericLiteral) &&
            !firstArg.isKind(SyntaxKind.TrueKeyword) &&
            !firstArg.isKind(SyntaxKind.FalseKeyword)
          );
        })
      );

    expect(hasRespondWithPromise).toBe(true);
  });

  test('The :tool-form-active pseudo-class is used to provide visual feedback', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectCssStyleRules(stylesheet.cssRules);
    const hasCssRule = styleRules.some(
      (rule) => rule.selectorText.includes(':tool-form-active') && rule.style.length > 0
    );

    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasHtmlUtility = docs.some((d) =>
      Boolean(d.document.querySelector('[class*="tool-form-active"]'))
    );

    expect(hasCssRule || hasHtmlUtility).toBe(true);
  });

  test('The :tool-submit-active pseudo-class is used to provide visual feedback', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectCssStyleRules(stylesheet.cssRules);
    const hasCssRule = styleRules.some(
      (rule) => rule.selectorText.includes(':tool-submit-active') && rule.style.length > 0
    );

    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasHtmlUtility = docs.some((d) =>
      Boolean(d.document.querySelector('[class*="tool-submit-active"]'))
    );

    expect(hasCssRule || hasHtmlUtility).toBe(true);
  });
});
