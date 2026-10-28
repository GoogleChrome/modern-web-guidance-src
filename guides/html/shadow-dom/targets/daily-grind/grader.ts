import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ClassDeclaration,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type SourceFile,
  type StringLiteral,
  type NoSubstitutionTemplateLiteral,
} from 'ts-morph';
import { parseHTML } from 'linkedom';
import { parse, CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getStringLiteralValue(node: any): string | undefined {
  if (!node) return undefined;
  const kind = node.getKind?.();
  if (
    kind === SyntaxKind.StringLiteral ||
    kind === SyntaxKind.NoSubstitutionTemplateLiteral
  ) {
    return (node as StringLiteral | NoSubstitutionTemplateLiteral).getLiteralValue();
  }
  return undefined;
}

function getAllSourceFiles(): SourceFile[] {
  return getJsProject(targetFiles).getSourceFiles();
}

function getAllTemplateDocuments(): any[] {
  const htmlDocs = getHtmlDocuments(targetFiles);
  const templateDocs: any[] = [];

  for (const { document } of htmlDocs) {
    const templates: any[] = Array.from(document.querySelectorAll('template'));
    for (const tmpl of templates) {
      const inner = tmpl.innerHTML || tmpl.textContent || '';
      if (inner.trim()) {
        templateDocs.push(parseHTML(inner).document);
      }
    }
  }

  const sourceFiles = getAllSourceFiles();
  for (const sf of sourceFiles) {
    const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const expr of binaryExprs) {
      if (expr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
      const left = expr.getLeft();
      if (
        left.getKind() === SyntaxKind.PropertyAccessExpression &&
        (left as any).getName() === 'innerHTML'
      ) {
        const rightVal = getStringLiteralValue(expr.getRight());
        if (rightVal) {
          templateDocs.push(parseHTML(rightVal).document);
        }
      }
    }
  }

  return templateDocs;
}

function getTemplateStyleSheets(): CSSStyleSheet[] {
  const sheets: CSSStyleSheet[] = [];
  for (const doc of getAllTemplateDocuments()) {
    const styleEls: any[] = Array.from(doc.querySelectorAll('style'));
    for (const styleEl of styleEls) {
      const css = styleEl.textContent || '';
      if (css.trim()) {
        sheets.push(parse(css));
      }
    }
  }
  return sheets;
}

function getConstructedStyleSheets(): CSSStyleSheet[] {
  const sheets: CSSStyleSheet[] = [];
  const sourceFiles = getAllSourceFiles();
  for (const sf of sourceFiles) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propName = (expr as any).getName();
        if (propName === 'replaceSync' || propName === 'replace') {
          const argVal = getStringLiteralValue(call.getArguments()[0]);
          if (argVal) {
            sheets.push(parse(argVal));
          }
        }
      }
    }
  }

  return sheets;
}

function getShadowStyleSheets(): CSSStyleSheet[] {
  return [...getTemplateStyleSheets(), ...getConstructedStyleSheets()];
}

function collectStyleRules(rules: any[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    } else if (rule && rule.cssRules) {
      result.push(...collectStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function unwrapExpression(node: Node | undefined): Node | undefined {
  let current = node;
  while (
    current &&
    (Node.isParenthesizedExpression(current) ||
      Node.isAsExpression(current) ||
      Node.isTypeAssertion(current) ||
      Node.isSatisfiesExpression(current) ||
      Node.isNonNullExpression(current))
  ) {
    current = current.getExpression();
  }
  return current;
}

const MAX_HANDLER_CALL_DEPTH = 3;

// Resolves an event handler / callee expression to the function-like nodes whose bodies run.
function resolveFunctionNodes(expr: Node | undefined): Node[] {
  const node = unwrapExpression(expr);
  if (!node) return [];

  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return [node];
  }

  // handler.bind(this, ...)
  if (Node.isCallExpression(node)) {
    const callee = unwrapExpression(node.getExpression());
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'bind') {
      return resolveFunctionNodes(callee.getExpression());
    }
    return [];
  }

  // this.method / this.#method
  if (Node.isPropertyAccessExpression(node)) {
    if (!Node.isThisExpression(unwrapExpression(node.getExpression()))) return [];
    const cls = node.getFirstAncestor(
      (a) => Node.isClassDeclaration(a) || Node.isClassExpression(a)
    );
    if (!cls || !(Node.isClassDeclaration(cls) || Node.isClassExpression(cls))) {
      return [];
    }
    const name = node.getName();
    const results: Node[] = [];
    for (const member of cls.getMembers()) {
      if (Node.isMethodDeclaration(member) && member.getName() === name) {
        results.push(member);
      } else if (Node.isPropertyDeclaration(member) && member.getName() === name) {
        results.push(...resolveFunctionNodes(member.getInitializer()));
      }
    }
    return results;
  }

  // Same-file named function or variable initialized with a function
  if (Node.isIdentifier(node)) {
    const name = node.getText();
    const sf = node.getSourceFile();
    const results: Node[] = [];
    for (const fn of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
      if (fn.getName() === name) results.push(fn);
    }
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      if (decl.getName() !== name) continue;
      const init = unwrapExpression(decl.getInitializer());
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        results.push(init);
      }
    }
    return results;
  }

  return [];
}

const ARRAY_FILTER_METHODS = new Set(['filter', 'some', 'every', 'find', 'findIndex']);

// True if the function (or functions it calls, up to MAX_HANDLER_CALL_DEPTH) reads slot
// assignments via assignedElements(), or via assignedNodes() combined with filtering.
function handlerUsesAssignedContent(
  fnNode: Node,
  depth: number,
  visited: Set<Node>
): boolean {
  if (visited.has(fnNode)) return false;
  visited.add(fnNode);

  const calls = fnNode.getDescendantsOfKind(SyntaxKind.CallExpression);
  const filtersNodes =
    calls.some((call) => {
      const callee = unwrapExpression(call.getExpression());
      return (
        Node.isPropertyAccessExpression(callee) &&
        (ARRAY_FILTER_METHODS.has(callee.getName()) || callee.getName() === 'trim')
      );
    }) ||
    fnNode
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((p) => p.getName() === 'nodeType');

  for (const call of calls) {
    const callee = unwrapExpression(call.getExpression());
    if (!Node.isPropertyAccessExpression(callee)) continue;
    const name = callee.getName();
    if (name === 'assignedElements') return true;
    if (name === 'assignedNodes' && filtersNodes) return true;
  }

  if (depth >= MAX_HANDLER_CALL_DEPTH) return false;

  for (const call of calls) {
    for (const target of resolveFunctionNodes(call.getExpression())) {
      if (handlerUsesAssignedContent(target, depth + 1, visited)) return true;
    }
  }
  return false;
}

function getSlotchangeHandlerExpressions(sourceFiles: SourceFile[]): Node[] {
  const handlers: Node[] = [];
  for (const sf of sourceFiles) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = unwrapExpression(call.getExpression());
      if (!Node.isPropertyAccessExpression(callee)) continue;
      if (callee.getName() !== 'addEventListener') continue;
      const [eventArg, handlerArg] = call.getArguments();
      if (getStringLiteralValue(eventArg) !== 'slotchange' || !handlerArg) continue;
      handlers.push(handlerArg);
    }
    for (const bin of sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
      const left = unwrapExpression(bin.getLeft());
      if (Node.isPropertyAccessExpression(left) && left.getName() === 'onslotchange') {
        handlers.push(bin.getRight());
      }
    }
  }
  return handlers;
}

test.describe('shadow-dom Target Grader', () => {
  test('The custom element attaches an open shadow root (mode: "open") to encapsulate its internal DOM subtree', () => {
    const sourceFiles = getAllSourceFiles();
    const calls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasOpenShadowRoot = calls.some((call: CallExpression) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      if ((expr as any).getName() !== 'attachShadow') return false;

      const firstArg = call.getArguments()[0];
      if (!firstArg || firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
        return false;
      }

      const modeProp = (firstArg as ObjectLiteralExpression).getProperty('mode');
      if (!modeProp || modeProp.getKind() !== SyntaxKind.PropertyAssignment) {
        return false;
      }

      const init = (modeProp as PropertyAssignment).getInitializer();
      return getStringLiteralValue(init) === 'open';
    });

    expect(hasOpenShadowRoot).toBe(true);
  });

  test('The component defines a <template> once outside the constructor and builds each instance shadow root by cloning its .content without assigning innerHTML per instance', () => {
    const sourceFiles = getAllSourceFiles();
    const htmlDocs = getHtmlDocuments(targetFiles);

    // Check that a <template> is defined either in HTML or via document.createElement('template') outside any constructor
    const hasHtmlTemplate = htmlDocs.some(({ document }) =>
      Boolean(document.querySelector('template'))
    );

    const calls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasJsTemplateOutsideConstructor = calls.some((call) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      if ((expr as any).getName() !== 'createElement') return false;
      const arg = getStringLiteralValue(call.getArguments()[0]);
      if (arg?.toLowerCase() !== 'template') return false;
      return !call.getFirstAncestorByKind(SyntaxKind.Constructor);
    });

    // Check that inside a custom element class (constructor or method), .content is cloned via cloneNode(true) or importNode(..., true)
    const classes = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration)
    );

    const clonesTemplateWithoutPerInstanceInnerHTML = classes.some(
      (cls: ClassDeclaration) => {
        const classCalls = cls.getDescendantsOfKind(SyntaxKind.CallExpression);
        const hasCloneCall = classCalls.some((call) => {
          const expr = call.getExpression();
          if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
          const methodName = (expr as any).getName();

          if (methodName === 'cloneNode') {
            const receiver = (expr as any).getExpression();
            const isContent =
              receiver.getKind() === SyntaxKind.PropertyAccessExpression &&
              receiver.getName() === 'content';
            const firstArg = call.getArguments()[0];
            const isTrue = firstArg?.getKind() === SyntaxKind.TrueKeyword;
            return isContent && isTrue;
          }

          if (methodName === 'importNode') {
            const args = call.getArguments();
            const firstArg = args[0];
            const secondArg = args[1];
            const isContent =
              firstArg?.getKind() === SyntaxKind.PropertyAccessExpression &&
              (firstArg as any).getName() === 'content';
            const isTrue = secondArg?.getKind() === SyntaxKind.TrueKeyword;
            return isContent && isTrue;
          }

          return false;
        });

        const binaryExprs = cls.getDescendantsOfKind(SyntaxKind.BinaryExpression);
        const assignsInnerHtmlInInstance = binaryExprs.some((bin) => {
          if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
            return false;
          }
          // Ignore static initializers
          if (bin.getFirstAncestorByKind(SyntaxKind.PropertyDeclaration)?.isStatic()) {
            return false;
          }
          if (bin.getFirstAncestorByKind(SyntaxKind.ClassStaticBlockDeclaration)) {
            return false;
          }
          const left = bin.getLeft();
          return (
            left.getKind() === SyntaxKind.PropertyAccessExpression &&
            (left as any).getName() === 'innerHTML'
          );
        });

        return hasCloneCall && !assignsInnerHtmlInInstance;
      }
    );

    expect(
      (hasHtmlTemplate || hasJsTemplateOutsideConstructor) &&
        clonesTemplateWithoutPerInstanceInnerHTML
    ).toBe(true);
  });

  test('Light DOM children with slot attributes are projected into matching named <slot name="..."> elements inside the shadow root, while unslotted children are projected into the default <slot>', () => {
    const htmlDocs = getHtmlDocuments(targetFiles);
    const templateDocs = getAllTemplateDocuments();

    // Verify Light DOM uses custom elements with slotted children
    const lightSlottedEls = htmlDocs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('[slot]'))
    );
    const usedSlotNames = new Set(
      lightSlottedEls
        .map((el: any) => el.getAttribute('slot')?.trim())
        .filter(Boolean)
    );

    // Check if any custom element in Light DOM has unslotted element children
    const customElementsInLightDom = htmlDocs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('*')).filter((el: any) =>
        el.tagName.includes('-')
      )
    );
    const hasUnslottedLightChildren = customElementsInLightDom.some((ce: any) =>
      Array.from(ce.children).some((child: any) => !child.hasAttribute('slot'))
    );

    // Verify template has matching named <slot name="..."> for every used slot name in Light DOM
    const templateNamedSlots = new Set(
      templateDocs.flatMap((doc) =>
        Array.from(doc.querySelectorAll('slot[name]'))
          .map((slot: any) => slot.getAttribute('name')?.trim())
          .filter(Boolean)
      )
    );

    const allUsedSlotsExistInTemplate =
      usedSlotNames.size > 0 &&
      Array.from(usedSlotNames).every((name) => templateNamedSlots.has(name));

    const hasDefaultSlotInTemplate = templateDocs.some((doc) =>
      Boolean(doc.querySelector('slot:not([name]), slot[name=""]'))
    );

    const defaultSlotSatisfied =
      !hasUnslottedLightChildren || hasDefaultSlotInTemplate;

    expect(
      customElementsInLightDom.length > 0 &&
        allUsedSlotsExistInTemplate &&
        defaultSlotSatisfied
    ).toBe(true);
  });

  test('Adding or removing a slotted Light DOM element after upgrade updates the component state, attributes, or rendered DOM via a slotchange listener using assignedElements() or filtered assignedNodes()', () => {
    const sourceFiles = getAllSourceFiles();
    const handlers = getSlotchangeHandlerExpressions(sourceFiles);

    // The slotchange handler itself (or a method/function it calls) must read the slot's
    // assigned content via assignedElements() or filtered assignedNodes().
    const handlerReadsAssignedContent = handlers.some((handler) =>
      resolveFunctionNodes(handler).some((fn) =>
        handlerUsesAssignedContent(fn, 0, new Set())
      )
    );

    expect(handlerReadsAssignedContent).toBe(true);
  });

  test('Component styles live in the shadow root via adoptedStyleSheets, a <style> element, or a <link rel="stylesheet"> inside the shadow tree', () => {
    const templateDocs = getAllTemplateDocuments();
    const sourceFiles = getAllSourceFiles();

    const hasAdoptedStyleSheets = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((prop) => prop.getName() === 'adoptedStyleSheets')
    );
    const adoptedSheetHasRules =
      hasAdoptedStyleSheets &&
      getConstructedStyleSheets().some((sheet) => sheet.cssRules.length > 0);

    const shadowStyleHasRules = getTemplateStyleSheets().some(
      (sheet) => sheet.cssRules.length > 0
    );

    const shadowHasStylesheetLink = templateDocs.some((doc) =>
      Array.from(doc.querySelectorAll('link[rel]')).some(
        (link: any) =>
          String(link.getAttribute('rel')).toLowerCase().split(/\s+/).includes('stylesheet') &&
          Boolean(link.getAttribute('href')?.trim())
      )
    );

    expect(
      adoptedSheetHasRules || shadowStyleHasRules || shadowHasStylesheetLink
    ).toBe(true);
  });

  test('A Light DOM element outside the component that uses the same class name as an internal element does not receive the component styles', () => {
    const globalSheet = getCssStyleSheet(targetFiles);
    const globalRules = collectStyleRules(Array.from(globalSheet.cssRules));
    const shadowSheets = getShadowStyleSheets();
    const shadowRules = shadowSheets.flatMap((s) =>
      collectStyleRules(Array.from(s.cssRules))
    );

    // The component's card styles (e.g. .card or article inside shadow root) must not remain leaked as global .card rules
    const hasGlobalCardRule = globalRules.some((r) =>
      r.selectorText
        .split(',')
        .some((sel) => sel.trim() === '.card' || sel.trim().startsWith('.card '))
    );

    const hasEncapsulatedCardRule = shadowRules.some(
      (r) =>
        r.style.getPropertyValue('background') !== '' ||
        r.style.getPropertyValue('background-color') !== '' ||
        r.style.getPropertyValue('border-radius') !== '' ||
        r.style.getPropertyValue('box-shadow') !== ''
    );

    expect(!hasGlobalCardRule && hasEncapsulatedCardRule).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Dynamic slotchange updates component state, attributes, or rendered DOM when slotted Light DOM element is added or removed, ignoring whitespace text nodes', async ({
      page,
    }) => {
      const updatedProperly = await page.evaluate(async () => {
        const cards = Array.from(document.querySelectorAll('.grid > *')).filter(
          (el) => el.shadowRoot
        );
        if (cards.length < 2) return false;

        // Use a fresh, childless instance of the component so the check does not depend on
        // how the page configures existing cards (attribute names, pre-slotted content).
        const tagName = cards[0].localName;
        const parent = cards[0].parentElement!;
        await customElements.whenDefined(tagName);
        const settle = () => new Promise((r) => setTimeout(r, 50));

        const createFresh = async () => {
          const el = document.createElement(tagName);
          parent.appendChild(el);
          await settle();
          return el;
        };

        const getSnapshot = (host: Element) => {
          const sr = host.shadowRoot!;
          const hostAttrs = host
            .getAttributeNames()
            .sort()
            .map((a) => `${a}=${host.getAttribute(a)}`)
            .join(';');
          // Skip slot fallback content: the browser stops rendering it as soon as anything is
          // assigned, which would register as a change even without a slotchange reaction.
          const shadowDisplay = Array.from(sr.querySelectorAll('*'))
            .filter((el) => !el.parentElement?.closest('slot'))
            .map((el) => `${el.tagName}:${getComputedStyle(el).display}`)
            .join('|');
          return `${hostAttrs}__${getComputedStyle(host).display}__${sr.innerHTML}__${shadowDisplay}`;
        };

        // Whitespace-only text must not count as slotted content.
        const wsHost = await createFresh();
        if (!wsHost.shadowRoot) return false;
        const wsInitial = getSnapshot(wsHost);
        wsHost.appendChild(document.createTextNode('   \n  '));
        await settle();
        const whitespaceIsNoop = getSnapshot(wsHost) === wsInitial;
        wsHost.remove();

        // Adding a slotted element to some named slot must change state; removing it must revert.
        const slotNames = Array.from(
          wsHost.shadowRoot.querySelectorAll('slot[name]')
        )
          .map((s) => s.getAttribute('name')!)
          .filter((n) => n.trim());

        let addRemoveUpdates = false;
        for (const name of new Set(slotNames)) {
          const host = await createFresh();
          const initialSnap = getSnapshot(host);

          const slotted = document.createElement('span');
          slotted.setAttribute('slot', name);
          slotted.textContent = 'New';
          host.appendChild(slotted);
          await settle();
          const afterAddSnap = getSnapshot(host);

          slotted.remove();
          await settle();
          const afterRemoveSnap = getSnapshot(host);
          host.remove();

          if (afterAddSnap !== initialSnap && afterRemoveSnap === initialSnap) {
            addRemoveUpdates = true;
            break;
          }
        }

        return whitespaceIsNoop && addRemoveUpdates;
      });

      expect(updatedProperly).toBe(true);
    });

    test('A Light DOM element outside the component with an internal class name does not receive the component shadow styles', async ({
      page,
    }) => {
      const isIsolated = await page.evaluate(() => {
        const host = Array.from(document.querySelectorAll('.grid > *')).find(
          (el) => el.shadowRoot
        );
        if (!host || !host.shadowRoot) return false;

        const probe = document.createElement('div');
        probe.className = 'card';
        document.body.appendChild(probe);
        const probeStyle = window.getComputedStyle(probe);
        const probeBoxShadow = probeStyle.boxShadow;
        const probePadding = probeStyle.paddingTop;
        probe.remove();

        return probeBoxShadow === 'none' && probePadding === '0px';
      });

      expect(isIsolated).toBe(true);
    });
  });
});
