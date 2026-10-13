import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import { CSSStyleRule, type CSSStyleSheet } from 'cssomnom';
import { parseHTML } from 'linkedom';

// @ts-ignore - TS1470 in nodenext when package.json lacks type: module
const targetFiles: string[] = getTargetFiles(import.meta.url);

function hasCustomElementDefinition(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const exprText = call.getExpression().getText();
      if (exprText === 'customElements.define' || exprText.endsWith('.customElements.define')) {
        const args = call.getArguments();
        if (args.length >= 2) {
          const firstArg = args[0].getText().replace(/['"`]/g, '');
          if (firstArg.includes('-')) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function attachesOpenShadowRoot(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const exprText = call.getExpression().getText();
      if (exprText === 'this.attachShadow' || exprText.endsWith('.attachShadow')) {
        const args = call.getArguments();
        if (args.length > 0 && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
          const obj = args[0].asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
          const modeProp = obj.getProperty('mode');
          if (modeProp && modeProp.getKind() === SyntaxKind.PropertyAssignment) {
            const propAssign = modeProp.asKindOrThrow(SyntaxKind.PropertyAssignment);
            const initText = propAssign.getInitializer()?.getText().replace(/['"`]/g, '');
            if (initText === 'open') {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function definesTemplateOutsideConstructor(project: Project, docs: Array<{ file: string; document: any }>): boolean {
  for (const doc of docs) {
    if (doc.document.querySelector('template')) {
      return true;
    }
  }
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const exprText = call.getExpression().getText();
      if (exprText === 'document.createElement' || exprText.endsWith('.createElement')) {
        const args = call.getArguments();
        if (args.length > 0 && args[0].getText().replace(/['"`]/g, '').toLowerCase() === 'template') {
          const insideConstructor = call.getFirstAncestorByKind(SyntaxKind.Constructor);
          if (!insideConstructor) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function clonesTemplateContent(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const exprText = call.getExpression().getText();
      if (exprText.endsWith('.cloneNode')) {
        const args = call.getArguments();
        if (args.length > 0 && args[0].getText() === 'true') {
          return true;
        }
      }
      if (exprText === 'document.importNode' || exprText.endsWith('.importNode')) {
        const args = call.getArguments();
        if (args.length >= 2 && args[1].getText() === 'true') {
          return true;
        }
      }
    }
  }
  return false;
}

function hasNoInnerHTMLInConstructor(project: Project): boolean {
  let foundConstructor = false;
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const classes = sf.getClasses();
    for (const cls of classes) {
      const ctors = cls.getConstructors();
      for (const ctor of ctors) {
        const ctorText = ctor.getText();
        if (ctorText.includes('attachShadow') || ctorText.includes('super()')) {
          foundConstructor = true;
          const binExprs = ctor.getDescendantsOfKind(SyntaxKind.BinaryExpression);
          for (const be of binExprs) {
            if (be.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
              const leftText = be.getLeft().getText();
              if (leftText.endsWith('innerHTML')) {
                return false;
              }
            }
          }
        }
      }
    }
  }
  return foundConstructor;
}

function hasSlottedLightDomChildren(docs: Array<{ file: string; document: any }>): boolean {
  for (const doc of docs) {
    const elements = Array.from(doc.document.querySelectorAll('*'));
    for (const el of elements as any[]) {
      if (el.tagName && el.tagName.includes('-')) {
        const slottedChildren = el.querySelectorAll('[slot]');
        if (slottedChildren.length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function hasUnslottedLightDomChildren(docs: Array<{ file: string; document: any }>): boolean {
  for (const doc of docs) {
    const elements = Array.from(doc.document.querySelectorAll('*'));
    for (const el of elements as any[]) {
      if (el.tagName && el.tagName.includes('-')) {
        const children = Array.from(el.children);
        const unslotted = children.filter((c: any) => !c.hasAttribute('slot'));
        if (unslotted.length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function getTemplateDocuments(project: Project, docs: Array<{ file: string; document: any }>): any[] {
  const templateDocs: any[] = [];
  for (const doc of docs) {
    const tmpl = doc.document.querySelector('template');
    if (tmpl) {
      templateDocs.push(parseHTML(tmpl.innerHTML || tmpl.content?.toString() || '').document);
    }
  }
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const binExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const be of binExprs) {
      if (be.getOperatorToken().getKind() === SyntaxKind.EqualsToken && be.getLeft().getText().includes('innerHTML')) {
        const right = be.getRight();
        const text = right.getText();
        const rawHtml = text.replace(/^[`'"]|[`'"]$/g, '');
        if (rawHtml.includes('<slot')) {
          templateDocs.push(parseHTML(rawHtml).document);
        }
      }
    }
  }
  return templateDocs;
}

function templateHasNamedAndDefaultSlots(project: Project, docs: Array<{ file: string; document: any }>): boolean {
  const tmplDocs = getTemplateDocuments(project, docs);
  if (tmplDocs.length === 0) return false;
  return tmplDocs.some((doc) => {
    const namedSlots = doc.querySelectorAll('slot[name]');
    const defaultSlots = doc.querySelectorAll('slot:not([name])');
    return namedSlots.length > 0 && defaultSlots.length > 0;
  });
}

function listensForSlotChange(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const exprText = call.getExpression().getText();
      if (exprText.endsWith('addEventListener')) {
        const args = call.getArguments();
        if (args.length > 0 && args[0].getText().replace(/['"`]/g, '') === 'slotchange') {
          return true;
        }
      }
    }
  }
  return false;
}

function filtersAssignedContent(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    const usesAssignedElements = calls.some((c) => c.getExpression().getText().endsWith('assignedElements'));
    if (usesAssignedElements) return true;

    const usesAssignedNodes = calls.some((c) => c.getExpression().getText().endsWith('assignedNodes'));
    if (usesAssignedNodes) {
      const sfText = sf.getText();
      if (
        sfText.includes('trim()') ||
        sfText.includes('ELEMENT_NODE') ||
        sfText.includes('nodeType === 1') ||
        sfText.includes('nodeType === 3')
      ) {
        return true;
      }
    }
  }
  return false;
}

function updatesComponentStateOnSlotChange(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const exprText = call.getExpression().getText();
      if (exprText.endsWith('toggleAttribute') || exprText.endsWith('setAttribute')) {
        return true;
      }
    }
  }
  return false;
}

function hasShadowRootStyles(project: Project, docs: Array<{ file: string; document: any }>): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    if (propAccesses.some((pa) => pa.getName() === 'adoptedStyleSheets')) {
      return true;
    }
    const sfText = sf.getText();
    if (sfText.includes('shadowRoot') && sfText.includes('<style>')) {
      return true;
    }
  }
  for (const doc of docs) {
    const tmpl = doc.document.querySelector('template');
    if (tmpl && (tmpl.innerHTML.includes('<style') || tmpl.innerHTML.includes('<link rel="stylesheet"'))) {
      return true;
    }
  }
  return false;
}

function usesConstructedOrShadowStyleSheet(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
    for (const ne of newExprs) {
      if (ne.getExpression().getText() === 'CSSStyleSheet') {
        return true;
      }
    }
  }
  return false;
}

function hasNoGlobalCardStyleRule(stylesheet: CSSStyleSheet): boolean {
  const rules = Array.from(stylesheet.cssRules || []) as CSSStyleRule[];
  const hasCard = rules.some((r) => {
    if (r instanceof CSSStyleRule && r.selectorText) {
      const selectors = r.selectorText.split(',').map((s) => s.trim());
      return selectors.some((s) => s === '.card' || s.startsWith('.card ') || s.startsWith('.card:'));
    }
    return false;
  });
  return !hasCard;
}

function hasEncapsulatedCardStyles(project: Project): boolean {
  for (const sf of project.getSourceFiles()) {
    if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;
    const sfText = sf.getText();
    if (
      sfText.includes('.card') &&
      (sfText.includes('replaceSync') || sfText.includes('CSSStyleSheet') || sfText.includes('<style>'))
    ) {
      return true;
    }
  }
  return false;
}

test.describe('daily-grind Target Grader', () => {
  test('Requirement 1: Custom element is registered via customElements.define', () => {
    const project = getJsProject(targetFiles);
    expect(hasCustomElementDefinition(project)).toBe(true);
  });

  test('Requirement 1: Component attaches an open shadow root (mode: open)', () => {
    const project = getJsProject(targetFiles);
    expect(attachesOpenShadowRoot(project)).toBe(true);
  });

  test('Requirement 2: Component defines a template once outside the constructor', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    expect(definesTemplateOutsideConstructor(project, docs)).toBe(true);
  });

  test('Requirement 2: Shadow root is built by cloning template content with cloneNode or importNode', () => {
    const project = getJsProject(targetFiles);
    expect(clonesTemplateContent(project)).toBe(true);
  });

  test('Requirement 2: Component constructor does not assign innerHTML per instance', () => {
    const project = getJsProject(targetFiles);
    expect(hasNoInnerHTMLInConstructor(project)).toBe(true);
  });

  test('Requirement 3: Light DOM markup specifies slot attributes for projection into named slots', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(hasSlottedLightDomChildren(docs)).toBe(true);
  });

  test('Requirement 3: Light DOM markup includes unslotted elements for the default slot', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(hasUnslottedLightDomChildren(docs)).toBe(true);
  });

  test('Requirement 3: Component template defines both named slots and a default slot', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    expect(templateHasNamedAndDefaultSlots(project, docs)).toBe(true);
  });

  test('Requirement 4: Component registers a slotchange event listener on slots', () => {
    const project = getJsProject(targetFiles);
    expect(listensForSlotChange(project)).toBe(true);
  });

  test('Requirement 4: Whitespace-only text is ignored using assignedElements or filtering assignedNodes', () => {
    const project = getJsProject(targetFiles);
    expect(filtersAssignedContent(project)).toBe(true);
  });

  test('Requirement 4: Component updates state or attributes when slot content changes', () => {
    const project = getJsProject(targetFiles);
    expect(updatesComponentStateOnSlotChange(project)).toBe(true);
  });

  test('Requirement 5: Component styles are encapsulated in the shadow root', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    expect(hasShadowRootStyles(project, docs)).toBe(true);
  });

  test('Requirement 5: Component utilizes a constructed CSSStyleSheet or shadow stylesheet', () => {
    const project = getJsProject(targetFiles);
    expect(usesConstructedOrShadowStyleSheet(project)).toBe(true);
  });

  test('Requirement 6: Global page stylesheet does not contain styles for .card', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    expect(hasNoGlobalCardStyleRule(stylesheet)).toBe(true);
  });

  test('Requirement 6: Component internal .card styles are encapsulated in component styles', () => {
    const project = getJsProject(targetFiles);
    expect(hasEncapsulatedCardStyles(project)).toBe(true);
  });
});
