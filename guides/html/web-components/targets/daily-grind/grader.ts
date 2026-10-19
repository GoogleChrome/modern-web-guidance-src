import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type SourceFile, type ClassDeclaration, type ClassExpression } from 'ts-morph';
import { parseHTML } from 'linkedom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getCustomElementClasses(sourceFiles: SourceFile[]): (ClassDeclaration | ClassExpression)[] {
  const filtered = sourceFiles.filter((sf) => !sf.getFilePath().endsWith('.d.ts'));
  const declarations = filtered.flatMap((sf) =>
    sf.getClasses().filter((cls) => {
      const heritage = cls.getHeritageClauses();
      return heritage.some((hc) => hc.getText().includes('HTMLElement'));
    })
  );
  const expressions = filtered.flatMap((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.ClassExpression).filter((cls) => {
      const heritage = cls.getHeritageClauses();
      return heritage.some((hc) => hc.getText().includes('HTMLElement'));
    })
  );
  return [...declarations, ...expressions];
}

function getRegisteredTagNames(sourceFiles: SourceFile[]): string[] {
  const tagNames: string[] = [];
  for (const sf of sourceFiles.filter((sf) => !sf.getFilePath().endsWith('.d.ts'))) {
    const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of callExpressions) {
      const exprText = call.getExpression().getText();
      if (exprText === 'customElements.define' || exprText.endsWith('.customElements.define')) {
        const args = call.getArguments();
        if (args.length >= 2) {
          const firstArg = args[0];
          if (
            firstArg.isKind(SyntaxKind.StringLiteral) ||
            firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
          ) {
            tagNames.push(firstArg.getLiteralText());
          }
        }
      }
    }
  }
  return tagNames;
}

function getTemplateHtmlDocuments(
  sourceFiles: SourceFile[],
  files: string[]
): Array<{ document: any }> {
  const docs: Array<{ document: any }> = [];
  for (const sf of sourceFiles.filter((sf) => !sf.getFilePath().endsWith('.d.ts'))) {
    const literals = [
      ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
      ...sf.getDescendantsOfKind(SyntaxKind.TemplateExpression),
      ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ];
    for (const lit of literals) {
      const text = lit.getText().replace(/^[`"']|[`"']$/g, '');
      if (text.includes('<') && text.includes('>')) {
        try {
          const { document } = parseHTML(text);
          docs.push({ document });
        } catch {
          // ignore non-HTML string literals
        }
      }
    }
  }
  const htmlDocs = getHtmlDocuments(files);
  for (const hDoc of htmlDocs) {
    const templates = hDoc.document.querySelectorAll('template');
    for (const t of Array.from(templates) as any[]) {
      if (t.innerHTML && t.innerHTML.includes('<') && t.innerHTML.includes('>')) {
        try {
          const { document } = parseHTML(t.innerHTML);
          docs.push({ document });
        } catch {
          // ignore
        }
      }
    }
  }
  return docs;
}

test.describe('Daily Grind Web Components Grader', () => {

  test('Custom element encapsulates stateful behavior or lifecycle logic rather than purely presentational styling', () => {
    const project = getJsProject(targetFiles);
    const classes = getCustomElementClasses(project.getSourceFiles());

    const hasStateOrLifecycle = classes.some((cls) => {
      const methods = cls.getMethods();
      const hasLifecycleMethod = methods.some((m) => {
        const name = m.getName();
        return (
          name === 'connectedCallback' ||
          name === 'disconnectedCallback' ||
          name === 'attributeChangedCallback' ||
          name === 'adoptedCallback'
        );
      });

      const getAccessors = cls.getGetAccessors();
      const setAccessors = cls.getSetAccessors();
      const properties = cls.getProperties();
      const hasObservedAttributes =
        cls.getStaticProperty('observedAttributes') !== undefined ||
        cls.getStaticMember('observedAttributes') !== undefined;
      const hasCustomMethods = methods.some((m) => !m.getName().startsWith('constructor'));
      const hasPropsOrAccessors =
        getAccessors.length > 0 || setAccessors.length > 0 || properties.length > 0;

      return hasLifecycleMethod || hasObservedAttributes || (hasPropsOrAccessors && hasCustomMethods);
    });

    expect(classes.length > 0 && hasStateOrLifecycle).toBe(true);
  });

  test('Custom element tag names are lowercase kebab-case strings containing at least one hyphen', () => {
    const project = getJsProject(targetFiles);
    const tagNames = getRegisteredTagNames(project.getSourceFiles());

    const hasValidKebabCase =
      tagNames.length > 0 &&
      tagNames.every((tag) => /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag));

    expect(hasValidKebabCase).toBe(true);
  });

  test('Explicit custom element constructor calls super() before accessing this', () => {
    const project = getJsProject(targetFiles);
    const classes = getCustomElementClasses(project.getSourceFiles());

    const validConstructors =
      classes.length > 0 &&
      classes.every((cls) => {
        const ctors = cls.getConstructors();
        if (ctors.length === 0) return true;

        return ctors.every((ctor) => {
          const superCall = ctor
            .getDescendantsOfKind(SyntaxKind.SuperKeyword)
            .find((s) => s.getParent()?.isKind(SyntaxKind.CallExpression));
          if (!superCall) return false;

          const superPos = superCall.getStart();
          const thisAccesses = ctor.getDescendantsOfKind(SyntaxKind.ThisKeyword);
          const hasThisBeforeSuper = thisAccesses.some((t) => t.getStart() < superPos);

          return !hasThisBeforeSuper;
        });
      });

    expect(validConstructors).toBe(true);
  });

  test('Interactive controls inside shadow roots use semantic HTML elements rather than non-semantic elements with click handlers or tabindex', () => {
    const project = getJsProject(targetFiles);
    const templateDocs = getTemplateHtmlDocuments(project.getSourceFiles(), targetFiles);

    const hasSemanticControl = templateDocs.some(
      (d) => d.document.querySelectorAll('button, input, select, textarea, a[href]').length > 0
    );
    const noDisallowedControls = templateDocs.every((d) => {
      const nonSemanticInteractive = d.document.querySelectorAll(
        'div[onclick], span[onclick], div[tabindex], span[tabindex]'
      );
      return nonSemanticInteractive.length === 0;
    });

    expect(hasSemanticControl && noDisallowedControls).toBe(true);
  });

  test('Every id referenced by ARIA attributes resolves to a target element within the same document or shadow root', () => {
    const project = getJsProject(targetFiles);
    const classes = getCustomElementClasses(project.getSourceFiles());
    const tagNames = getRegisteredTagNames(project.getSourceFiles());
    const templateDocs = getTemplateHtmlDocuments(project.getSourceFiles(), targetFiles);
    const htmlDocs = getHtmlDocuments(targetFiles);
    const allScopes = [...templateDocs, ...htmlDocs];

    const ariaAttrs = ['aria-labelledby', 'aria-describedby', 'aria-controls'];
    let totalRefsFound = 0;
    let allRefsResolved = true;

    for (const scope of allScopes) {
      for (const attr of ariaAttrs) {
        const elementsWithAria = scope.document.querySelectorAll(`[${attr}]`);
        for (const el of Array.from(elementsWithAria) as any[]) {
          const idValue = el.getAttribute(attr);
          if (idValue) {
            const ids = idValue.trim().split(/\s+/).filter(Boolean);
            for (const id of ids) {
              totalRefsFound++;
              const target = scope.document.getElementById(id);
              if (!target) {
                allRefsResolved = false;
              }
            }
          }
        }
      }
    }

    const hasCustomElements = classes.length > 0 || tagNames.length > 0;
    const passesRequirement = totalRefsFound === 0 || allRefsResolved;
    expect(hasCustomElements && passesRequirement).toBe(true);
  });

  test('Shadow roots are attached with open mode so shadowRoot is accessible', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project
      .getSourceFiles()
      .filter((sf) => !sf.getFilePath().endsWith('.d.ts'));

    const attachesOpenShadow = sourceFiles.some((sf) => {
      const attachCalls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
        const exprText = call.getExpression().getText();
        return exprText === 'this.attachShadow' || exprText.endsWith('.attachShadow');
      });

      return attachCalls.some((call) => {
        const args = call.getArguments();
        if (args.length > 0) {
          const argText = args[0].getText();
          return /\bmode\s*:\s*['"`]open['"`]/.test(argText);
        }
        return false;
      });
    });

    const htmlDocs = getHtmlDocuments(targetFiles);
    const hasDsdOpen = htmlDocs.some(
      (d) => d.document.querySelectorAll('template[shadowrootmode="open"]').length > 0
    );

    expect(attachesOpenShadow || hasDsdOpen).toBe(true);
  });

  test('Custom elements are defined as autonomous custom elements extending HTMLElement rather than customized built-in elements', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project
      .getSourceFiles()
      .filter((sf) => !sf.getFilePath().endsWith('.d.ts'));
    const customClasses = getCustomElementClasses(sourceFiles);

    const hasAutonomousClass =
      customClasses.length > 0 &&
      customClasses.every((cls) => {
        const heritageClauses = cls.getHeritageClauses();
        return heritageClauses.some((hc) => {
          const types = hc.getTypeNodes();
          return types.some((t) => t.getText().includes('HTMLElement'));
        });
      });

    const registersAutonomous = sourceFiles.some((sf) => {
      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExpressions.some((call) => {
        const exprText = call.getExpression().getText();
        if (exprText === 'customElements.define' || exprText.endsWith('.customElements.define')) {
          const args = call.getArguments();
          return args.length === 2 || (args.length === 3 && !args[2].getText().includes('extends'));
        }
        return false;
      });
    });

    const htmlDocs = getHtmlDocuments(targetFiles);
    const hasNoCustomizedBuiltinAttr = htmlDocs.every(
      (d) => d.document.querySelectorAll('[is]').length === 0
    );

    expect(hasAutonomousClass && registersAutonomous && hasNoCustomizedBuiltinAttr).toBe(true);
  });

});
