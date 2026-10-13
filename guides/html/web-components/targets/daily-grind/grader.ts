/**
 * Expectations status:
 * 1. TESTED: Verifies every custom element encapsulates stateful behavior, lifecycle logic, or a reusable API rather than purely presentational styling or native element re-implementation.
 * 2. SKIPPED: Base application contains no custom elements, and no tag name requirement applies.
 * 3. SKIPPED: Base application defines no custom element classes or constructors.
 * 4. SKIPPED: Base application contains no shadow roots or interactive controls within shadow roots.
 * 5. SKIPPED: Base application contains no shadow boundaries or cross-boundary ARIA references.
 * 6. SKIPPED: Base application attaches no shadow roots.
 * 7. SKIPPED: Base application defines no custom elements extending built-in elements.
 */

import { pathToFileURL } from 'url';
import path from 'path';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type ClassDeclaration, type ClassExpression } from 'ts-morph';

const currentFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;

const targetFiles: string[] = getTargetFiles(currentFileUrl);

test.describe('web-components Target Grader', () => {
  test('Every custom element encapsulates stateful behavior, lifecycle logic, or a reusable API rather than purely presentational styling or native element re-implementation', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    // Collect custom element tag names used in HTML documents
    const customElementTags = new Set<string>();
    for (const doc of docs) {
      const elements = doc.document.querySelectorAll('*');
      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        if (tag.includes('-') && !tag.startsWith('annotation-')) {
          customElementTags.add(tag);
        }
      }
    }

    // Collect custom element classes extending HTMLElement
    const sourceFiles = project.getSourceFiles();
    const classDecls = sourceFiles.flatMap(sf => [
      ...sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration),
      ...sf.getDescendantsOfKind(SyntaxKind.ClassExpression),
    ]);

    const customClasses = classDecls.filter((cls: ClassDeclaration | ClassExpression) => {
      const heritage = cls.getHeritageClauses();
      return heritage.some(h => /HTMLElement\b/.test(h.getText()));
    });

    const defineCalls = sourceFiles.flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    ).filter(call => {
      const exprText = call.getExpression().getText();
      return exprText === 'customElements.define' || exprText.endsWith('.customElements.define');
    });

    // Check if the project defines or uses custom elements
    const hasCustomElements = customElementTags.size > 0 || customClasses.length > 0 || defineCalls.length > 0;

    let hasViolatingCustomElement = false;

    if (hasCustomElements) {
      // If custom elements are used in HTML but no JS custom elements are defined,
      // they are purely presentational tags.
      if (customElementTags.size > 0 && customClasses.length === 0 && defineCalls.length === 0) {
        hasViolatingCustomElement = true;
      }

      for (const cls of customClasses) {
        const methods = cls.getMethods();
        const getters = cls.getGetAccessors();
        const setters = cls.getSetAccessors();
        const properties = cls.getProperties();

        const hasObservedAttributes =
          cls.getStaticMethod('observedAttributes') !== undefined ||
          cls.getStaticProperty('observedAttributes') !== undefined;
        const hasAttributeChanged = cls.getMethod('attributeChangedCallback') !== undefined;
        const hasCustomMethods = methods.some(
          m => !['connectedCallback', 'disconnectedCallback', 'adoptedCallback'].includes(m.getName())
        );
        const hasGettersOrSetters = getters.length > 0 || setters.length > 0;
        const hasStateProperties = properties.some(
          p => !p.isStatic() && !['shadowRoot'].includes(p.getName())
        );

        // Check for behavioral logic in class body (listeners, events, observers, timers, form association)
        const fullText = cls.getText();
        const hasBehavior =
          /\b(addEventListener|dispatchEvent|setInterval|setTimeout|fetch|MutationObserver|ResizeObserver|IntersectionObserver|attachInternals)\b/.test(
            fullText
          );

        const encapsulatesStateOrBehavior =
          hasObservedAttributes ||
          hasAttributeChanged ||
          hasCustomMethods ||
          hasGettersOrSetters ||
          hasStateProperties ||
          hasBehavior;

        if (!encapsulatesStateOrBehavior) {
          hasViolatingCustomElement = true;
          break;
        }
      }
    }

    expect(hasViolatingCustomElement).toBe(false);
  });
});
