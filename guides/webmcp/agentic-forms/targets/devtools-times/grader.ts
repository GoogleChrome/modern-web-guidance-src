import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type JsxAttribute,
} from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

type JsxTagNode = JsxOpeningElement | JsxSelfClosingElement;

function getTagName(node: JsxTagNode): string {
  return node.getTagNameNode().getText();
}

function getJsxAttributeMap(node: JsxTagNode): Map<string, JsxAttribute> {
  const map = new Map<string, JsxAttribute>();
  for (const prop of node.getAttributes()) {
    if (prop.isKind(SyntaxKind.JsxAttribute)) {
      map.set(prop.getNameNode().getText().toLowerCase(), prop);
    }
  }
  return map;
}

function getJsxAttrStringValue(attr: JsxAttribute | undefined): string | null {
  if (!attr) return null;
  const init = attr.getInitializer();
  if (!init) return '';
  if (init.isKind(SyntaxKind.StringLiteral)) {
    return init.getLiteralValue();
  }
  if (init.isKind(SyntaxKind.JsxExpression)) {
    const expr = init.getExpression();
    if (!expr) return '';
    if (
      expr.isKind(SyntaxKind.StringLiteral) ||
      expr.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    ) {
      return expr.getLiteralValue();
    }
    return expr.getText().trim();
  }
  return init.getText().trim();
}

function getAllJsxTags(project: ReturnType<typeof getJsProject>): JsxTagNode[] {
  return project.getSourceFiles().flatMap((sf) => [
    ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]);
}

test.describe('agentic-forms Target Grader', () => {
  test('The form element has both toolname and tooldescription attributes', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);

    const jsxForms = getAllJsxTags(project).filter((tag) => getTagName(tag) === 'form');
    const htmlForms = docs.flatMap((d) => Array.from(d.document.querySelectorAll('form')));

    const validJsxForms = jsxForms.filter((form) => {
      const attrs = getJsxAttributeMap(form);
      const toolName = getJsxAttrStringValue(attrs.get('toolname'));
      const toolDesc = getJsxAttrStringValue(attrs.get('tooldescription'));
      return Boolean(toolName && toolName.trim().length > 0 && toolDesc && toolDesc.trim().length > 0);
    });

    const validHtmlForms = htmlForms.filter((form: any) => {
      const toolName = form.getAttribute('toolname');
      const toolDesc = form.getAttribute('tooldescription');
      return Boolean(toolName && toolName.trim().length > 0 && toolDesc && toolDesc.trim().length > 0);
    });

    const totalAnnotatedForms = validJsxForms.length + validHtmlForms.length;
    expect(totalAnnotatedForms).toBeGreaterThan(0);

    if (jsxForms.length > 0) {
      expect(validJsxForms.length).toBe(jsxForms.length);
    }
    if (htmlForms.length > 0) {
      expect(validHtmlForms.length).toBe(htmlForms.length);
    }
  });

  test('Input elements have associated labels or toolparamdescription attributes', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);

    // Ensure the forms have been annotated for WebMCP or inputs have toolparamdescription
    const allTags = getAllJsxTags(project);
    const hasWebMcpFormOrInput =
      allTags.some((tag) => {
        const attrs = getJsxAttributeMap(tag);
        return (
          attrs.has('toolname') ||
          attrs.has('tooldescription') ||
          attrs.has('toolparamdescription')
        );
      }) ||
      docs.some((d) =>
        Boolean(
          d.document.querySelector('[toolname], [tooldescription], [toolparamdescription]'),
        ),
      );
    expect(hasWebMcpFormOrInput).toBe(true);

    let checkedInputCount = 0;

    for (const sf of project.getSourceFiles()) {
      const sfTags: JsxTagNode[] = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
      const sfForms = sfTags.filter((t) => getTagName(t) === 'form');
      if (sfForms.length === 0) continue;

      const labelForIds = new Set<string>();
      for (const tag of sfTags) {
        if (getTagName(tag) === 'label') {
          const attrs = getJsxAttributeMap(tag);
          const forVal = getJsxAttrStringValue(attrs.get('htmlfor') ?? attrs.get('for'));
          if (forVal) labelForIds.add(forVal);
        }
      }

      const inputs = sfTags.filter((t) =>
        ['input', 'select', 'textarea'].includes(getTagName(t)),
      );

      for (const input of inputs) {
        checkedInputCount++;
        const attrs = getJsxAttributeMap(input);
        const paramDesc = getJsxAttrStringValue(attrs.get('toolparamdescription'));
        const hasParamDesc = Boolean(paramDesc && paramDesc.trim().length > 0);

        const idVal = getJsxAttrStringValue(attrs.get('id'));
        const hasAssociatedLabelByFor = Boolean(idVal && labelForIds.has(idVal));

        const hasWrappingLabel = input
          .getAncestors()
          .some(
            (anc) =>
              anc.isKind(SyntaxKind.JsxElement) &&
              anc.getOpeningElement().getTagNameNode().getText() === 'label',
          );

        const hasFieldsetParamDesc = input.getAncestors().some((anc) => {
          if (!anc.isKind(SyntaxKind.JsxElement)) return false;
          const opening = anc.getOpeningElement();
          if (opening.getTagNameNode().getText() !== 'fieldset') return false;
          const fsAttrs = getJsxAttributeMap(opening);
          const fsDesc = getJsxAttrStringValue(fsAttrs.get('toolparamdescription'));
          return Boolean(fsDesc && fsDesc.trim().length > 0);
        });

        expect(
          hasParamDesc || hasAssociatedLabelByFor || hasWrappingLabel || hasFieldsetParamDesc,
        ).toBe(true);
      }
    }

    for (const { document } of docs) {
      const forms = Array.from(document.querySelectorAll('form'));
      for (const form of forms as any[]) {
        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
        for (const input of inputs as any[]) {
          checkedInputCount++;
          const paramDesc = input.getAttribute('toolparamdescription');
          const hasParamDesc = Boolean(paramDesc && paramDesc.trim().length > 0);
          const id = input.getAttribute('id');
          const hasLabelFor = Boolean(id && document.querySelector(`label[for="${id}"]`));
          const hasWrappingLabel = Boolean(input.closest('label'));
          const hasFieldsetDesc = Boolean(input.closest('fieldset[toolparamdescription]'));
          expect(hasParamDesc || hasLabelFor || hasWrappingLabel || hasFieldsetDesc).toBe(true);
        }
      }
    }

    expect(checkedInputCount).toBeGreaterThan(0);
  });

  test('The submit event listener uses event.preventDefault()', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasPreventDefault = callExpressions.some((call) => {
      const expr = call.getExpression();
      return (
        expr.isKind(SyntaxKind.PropertyAccessExpression) &&
        expr.getName() === 'preventDefault'
      );
    });

    expect(hasPreventDefault).toBe(true);
  });

  test('The submit event listener checks event.agentInvoked', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAgentInvokedPropAccess = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((prop) => prop.getName() === 'agentInvoked'),
    );

    const hasAgentInvokedBinding = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.BindingElement)
        .some(
          (b) =>
            b.getNameNode().getText() === 'agentInvoked' ||
            b.getPropertyNameNode()?.getText() === 'agentInvoked',
        ),
    );

    expect(hasAgentInvokedPropAccess || hasAgentInvokedBinding).toBe(true);
  });

  test('The submit event listener calls event.respondWith() with a Promise', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const respondWithCalls = callExpressions.filter((call) => {
      const expr = call.getExpression();
      if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
        return expr.getName() === 'respondWith';
      }
      return false;
    });

    expect(respondWithCalls.length).toBeGreaterThan(0);

    for (const call of respondWithCalls) {
      expect(call.getArguments().length).toBeGreaterThan(0);
    }
  });

  test('The :tool-form-active pseudo-class is used to provide visual feedback', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);

    const matchingRules = styleRules.filter((rule) =>
      rule.selectorText.includes(':tool-form-active'),
    );

    expect(matchingRules.length).toBeGreaterThan(0);
    const hasDeclarations = matchingRules.some((rule) => rule.style.length > 0);
    expect(hasDeclarations).toBe(true);
  });

  test('The :tool-submit-active pseudo-class is used to provide visual feedback for forms without toolautosubmit', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);

    const validJsxForms = getAllJsxTags(project)
      .filter((tag) => getTagName(tag) === 'form')
      .filter((form) => {
        const attrs = getJsxAttributeMap(form);
        const toolName = getJsxAttrStringValue(attrs.get('toolname'));
        const toolDesc = getJsxAttrStringValue(attrs.get('tooldescription'));
        return Boolean(toolName && toolName.trim().length > 0 && toolDesc && toolDesc.trim().length > 0);
      });

    const validHtmlForms = docs
      .flatMap((d) => Array.from(d.document.querySelectorAll('form')))
      .filter((form: any) => {
        const toolName = form.getAttribute('toolname');
        const toolDesc = form.getAttribute('tooldescription');
        return Boolean(toolName && toolName.trim().length > 0 && toolDesc && toolDesc.trim().length > 0);
      });

    expect(validJsxForms.length + validHtmlForms.length).toBeGreaterThan(0);

    const formsWithoutAutoSubmitCount =
      validJsxForms.filter((form) => {
        const attrs = getJsxAttributeMap(form);
        if (!attrs.has('toolautosubmit')) return true;
        const val = getJsxAttrStringValue(attrs.get('toolautosubmit'));
        return val === null || val.trim().toLowerCase() === 'false';
      }).length +
      validHtmlForms.filter((form: any) => {
        if (!form.hasAttribute('toolautosubmit')) return true;
        const val = form.getAttribute('toolautosubmit');
        return val !== null && val.trim().toLowerCase() === 'false';
      }).length;

    const styleRules = getRules(targetFiles, CSSStyleRule);
    const hasSubmitActiveRule = styleRules.some(
      (rule) =>
        rule.selectorText.includes(':tool-submit-active') && rule.style.length > 0,
    );

    expect(formsWithoutAutoSubmitCount === 0 || hasSubmitActiveRule).toBe(true);
  });
});
