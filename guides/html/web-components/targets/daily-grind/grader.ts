import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type SourceFile, type ClassDeclaration, type ClassExpression, type Node } from 'ts-morph';
import { parseHTML } from 'linkedom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function unwrapNode(node: Node): Node {
  let current = node;
  while (
    current.isKind(SyntaxKind.AsExpression) ||
    current.isKind(SyntaxKind.TypeAssertionExpression) ||
    current.isKind(SyntaxKind.SatisfiesExpression) ||
    current.isKind(SyntaxKind.ParenthesizedExpression)
  ) {
    const expr = (current as unknown as { getExpression?: () => Node }).getExpression?.();
    if (!expr) break;
    current = expr;
  }
  return current;
}

function resolveIdentifierInitializer(node: Node, sf: SourceFile): Node {
  const unwrapped = unwrapNode(node);
  if (!unwrapped.isKind(SyntaxKind.Identifier)) return unwrapped;
  const name = unwrapped.getText();
  const decl = sf
    .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((d) => d.getName() === name);
  const init = decl?.getInitializer();
  return init ? unwrapNode(init) : unwrapped;
}

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
          const firstArg = resolveIdentifierInitializer(args[0], sf);
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

function getCreatedElementTagNames(sourceFiles: SourceFile[]): string[] {
  const tags: string[] = [];
  for (const sf of sourceFiles.filter((s) => !s.getFilePath().endsWith('.d.ts'))) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression().getText();
      if (expr === 'document.createElement' || expr.endsWith('.createElement')) {
        const arg = call.getArguments()[0];
        if (arg && (arg.isKind(SyntaxKind.StringLiteral) || arg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral))) {
          tags.push(arg.getLiteralText().toLowerCase());
        }
      }
    }
  }
  return tags;
}

test.describe('Daily Grind Web Components Grader', () => {
  test('Every custom element class implements lifecycle callbacks (connectedCallback, disconnectedCallback, attributeChangedCallback, or adoptedCallback), observedAttributes, or stateful properties and methods', () => {
    const project = getJsProject(targetFiles);
    const classes = getCustomElementClasses(project.getSourceFiles());
    expect(classes.length).toBeGreaterThan(0);

    const everyClassHasStateOrLifecycle = classes.every((cls) => {
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

    expect(everyClassHasStateOrLifecycle).toBe(true);
  });

  test('Custom element tag names are lowercase kebab-case strings containing at least one hyphen', () => {
    const project = getJsProject(targetFiles);
    const tagNames = getRegisteredTagNames(project.getSourceFiles());
    expect(tagNames.length).toBeGreaterThan(0);

    const hasValidKebabCase = tagNames.every((tag) => /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag));

    expect(hasValidKebabCase).toBe(true);
  });

  test('Any explicit custom element constructor calls super() before accessing this, so instantiating or upgrading the element succeeds without throwing a ReferenceError', () => {
    const project = getJsProject(targetFiles);
    const classes = getCustomElementClasses(project.getSourceFiles());
    expect(classes.length).toBeGreaterThan(0);

    const validConstructors = classes.every((cls) => {
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

  test('Interactive controls inside shadow roots use native semantic HTML elements (such as <button>, <input>, <select>, or <a href>) rather than non-semantic <div> or <span> elements with click handlers or tabindex', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const templateDocs = getTemplateHtmlDocuments(sourceFiles, targetFiles);
    const createdTags = getCreatedElementTagNames(sourceFiles);

    const hasSemanticControl =
      templateDocs.some(
        (d) => d.document.querySelectorAll('button, input, select, textarea, a[href]').length > 0
      ) ||
      createdTags.some((t) => ['button', 'input', 'select', 'textarea', 'a'].includes(t));

    const noDisallowedControls = templateDocs.every((d) => {
      const nonSemanticInteractive = d.document.querySelectorAll(
        'div[onclick], span[onclick], div[tabindex], span[tabindex]'
      );
      return nonSemanticInteractive.length === 0;
    });

    expect(hasSemanticControl && noDisallowedControls).toBe(true);
  });

  test('Interactive controls inside shadow roots provide an accessible name or description via text content, aria-label, or <label>, or via aria-labelledby or aria-describedby attributes where every referenced id resolves to a target element within the same document or shadow root rather than across a shadow boundary', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles().filter((sf) => !sf.getFilePath().endsWith('.d.ts'));
    const templateDocs = getTemplateHtmlDocuments(sourceFiles, targetFiles);
    const htmlDocs = getHtmlDocuments(targetFiles);
    const allScopes = [...templateDocs, ...htmlDocs];

    const ariaAttrs = ['aria-labelledby', 'aria-describedby', 'aria-controls'];
    const unresolvedAriaIds: string[] = [];

    for (const scope of allScopes) {
      for (const attr of ariaAttrs) {
        const elementsWithAria = scope.document.querySelectorAll(`[${attr}]`);
        for (const el of Array.from(elementsWithAria) as any[]) {
          const idValue = el.getAttribute(attr);
          if (idValue) {
            const ids = idValue.trim().split(/\s+/).filter(Boolean);
            for (const id of ids) {
              const target = scope.document.getElementById(id);
              if (!target) {
                unresolvedAriaIds.push(id);
              }
            }
          }
        }
      }
    }
    expect(unresolvedAriaIds).toEqual([]);

    const customClasses = getCustomElementClasses(sourceFiles);
    const setsShadowControlAriaLabelInClass = customClasses.some((cls) =>
      cls.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const exprText = call.getExpression().getText();
        if (!exprText.endsWith('.setAttribute') || exprText === 'this.setAttribute') return false;
        const firstArg = call.getArguments()[0];
        return (
          firstArg !== undefined &&
          (firstArg.isKind(SyntaxKind.StringLiteral) ||
            firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) &&
          firstArg.getLiteralText() === 'aria-label'
        );
      })
    );

    const shadowControls = templateDocs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('button, input, select, textarea, a[href]')) as any[]
    );

    const everyTemplateControlNamed = shadowControls.every((el) => {
      const hasResolvedSameTreeAria = ['aria-labelledby', 'aria-describedby'].some((attr) => {
        const val = el.getAttribute(attr);
        if (!val) return false;
        const ids = val.trim().split(/\s+/).filter(Boolean);
        return ids.length > 0 && ids.every((id: string) => Boolean(el.ownerDocument?.getElementById(id)));
      });
      const id = el.getAttribute('id');
      const hasTextOrAriaLabel =
        Boolean(el.textContent?.trim()) ||
        Boolean(el.getAttribute('aria-label')?.trim()) ||
        Boolean(el.closest('label')?.textContent?.trim()) ||
        Boolean(id && el.ownerDocument?.querySelector(`label[for="${id}"]`)?.textContent?.trim()) ||
        (shadowControls.length === 1 && setsShadowControlAriaLabelInClass);
      return hasResolvedSameTreeAria || hasTextOrAriaLabel;
    });

    // Also verify controls constructed via document.createElement(...) in custom element classes
    const createdControlTagSet = new Set(['button', 'input', 'select', 'textarea', 'a']);
    const createdControlVars: Array<{ sf: SourceFile; varName: string }> = [];
    for (const sf of sourceFiles) {
      for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expr = call.getExpression().getText();
        if (expr === 'document.createElement' || expr.endsWith('.createElement')) {
          const arg = call.getArguments()[0];
          if (arg && (arg.isKind(SyntaxKind.StringLiteral) || arg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral))) {
            const tag = arg.getLiteralText().toLowerCase();
            if (createdControlTagSet.has(tag)) {
              const varDecl = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
              const propAssign = call.getFirstAncestorByKind(SyntaxKind.BinaryExpression);
              const varName =
                varDecl?.getName() ||
                (propAssign?.getOperatorToken().getKind() === SyntaxKind.EqualsToken
                  ? propAssign.getLeft().getText()
                  : '');
              if (varName) createdControlVars.push({ sf, varName });
            }
          }
        }
      }
    }

    const everyCreatedControlNamed = createdControlVars.every(({ sf, varName }) => {
      const text = sf.getFullText();
      const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hasTextAssign = new RegExp(`\\b${escaped}\\.(?:textContent|innerText|innerHTML)\\s*=\\s*[^;\\n]+`).test(text);
      const hasAriaLabelCall = new RegExp(`\\b${escaped}\\.setAttribute\\(\\s*['"\`]aria-(?:label|labelledby|describedby)['"\`]`).test(text);
      const hasAriaPropAssign = new RegExp(`\\b${escaped}\\.ariaLabel\\s*=\\s*[^;\\n]+`).test(text);
      return hasTextAssign || hasAriaLabelCall || hasAriaPropAssign || setsShadowControlAriaLabelInClass;
    });

    expect(shadowControls.length > 0 || createdControlVars.length > 0).toBe(true);
    expect(everyTemplateControlNamed && everyCreatedControlNamed).toBe(true);
  });

  test("Shadow roots are attached with mode: 'open' (or shadowrootmode=\"open\" for Declarative Shadow DOM) so element.shadowRoot is accessible", () => {
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
          const resolvedArg = resolveIdentifierInitializer(args[0], sf);
          const argText = resolvedArg.getText();
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

  test('Custom elements are defined as autonomous custom elements extending HTMLElement rather than customized built-in elements using the is="..." attribute', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project
      .getSourceFiles()
      .filter((sf) => !sf.getFilePath().endsWith('.d.ts'));
    const customClasses = getCustomElementClasses(sourceFiles);
    expect(customClasses.length).toBeGreaterThan(0);

    const hasAutonomousClass = customClasses.every((cls) => {
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
