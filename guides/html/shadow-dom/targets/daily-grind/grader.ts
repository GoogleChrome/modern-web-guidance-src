import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { Node, SyntaxKind, type SourceFile } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getStringLiteralValue(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  return undefined;
}

function getAllSourceFiles(): SourceFile[] {
  return getJsProject(targetFiles).getSourceFiles();
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

// Classes that extend something (custom element classes), declared or passed inline to define().
function getElementClasses(sourceFiles: SourceFile[]): Node[] {
  return sourceFiles.flatMap((sf) =>
    [
      ...sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration),
      ...sf.getDescendantsOfKind(SyntaxKind.ClassExpression),
    ].filter((cls) => Boolean(cls.getExtends()))
  );
}

// True when `node` runs once per instance: inside a constructor, a non-static method/accessor,
// or a non-static field initializer of a class.
function isInPerInstanceCode(node: Node): boolean {
  for (const ancestor of node.getAncestors()) {
    if (Node.isConstructorDeclaration(ancestor)) return true;
    if (
      (Node.isMethodDeclaration(ancestor) ||
        Node.isGetAccessorDeclaration(ancestor) ||
        Node.isSetAccessorDeclaration(ancestor) ||
        Node.isPropertyDeclaration(ancestor)) &&
      !ancestor.isStatic()
    ) {
      return true;
    }
    if (Node.isClassStaticBlockDeclaration(ancestor)) return false;
    if (Node.isClassDeclaration(ancestor) || Node.isClassExpression(ancestor)) return false;
  }
  return false;
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
  test('The component defines a <template> once outside the constructor and builds each instance shadow root by cloning its .content without assigning innerHTML per instance', () => {
    const sourceFiles = getAllSourceFiles();
    const htmlDocs = getHtmlDocuments(targetFiles);
    const calls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    // A <template> in markup, or document.createElement('template') outside per-instance code.
    const hasHtmlTemplate = htmlDocs.some(({ document }) =>
      Boolean(document.querySelector('template'))
    );
    const hasJsTemplateOutsideInstance = calls.some((call) => {
      const callee = unwrapExpression(call.getExpression());
      if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'createElement') {
        return false;
      }
      const arg = getStringLiteralValue(call.getArguments()[0]);
      return arg?.toLowerCase() === 'template' && !isInPerInstanceCode(call);
    });

    // <x>.content.cloneNode(true) or document.importNode(<x>.content, true)
    const isContentAccess = (n: Node | undefined) => {
      const u = unwrapExpression(n);
      return Node.isPropertyAccessExpression(u) && u.getName() === 'content';
    };
    const clonesTemplateContent = calls.some((call) => {
      const callee = unwrapExpression(call.getExpression());
      if (!Node.isPropertyAccessExpression(callee)) return false;
      const args = call.getArguments();
      if (callee.getName() === 'cloneNode') {
        return isContentAccess(callee.getExpression()) && args[0]?.getKind() === SyntaxKind.TrueKeyword;
      }
      if (callee.getName() === 'importNode') {
        return isContentAccess(args[0]) && args[1]?.getKind() === SyntaxKind.TrueKeyword;
      }
      return false;
    });

    // No `.innerHTML =` / `.innerHTML +=` inside per-instance code of a custom element class.
    const assignsInnerHtmlPerInstance = getElementClasses(sourceFiles).some((cls) =>
      cls.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
        const op = bin.getOperatorToken().getKind();
        if (op !== SyntaxKind.EqualsToken && op !== SyntaxKind.PlusEqualsToken) return false;
        const left = unwrapExpression(bin.getLeft());
        return (
          Node.isPropertyAccessExpression(left) &&
          left.getName() === 'innerHTML' &&
          isInPerInstanceCode(bin)
        );
      })
    );

    expect(
      (hasHtmlTemplate || hasJsTemplateOutsideInstance) &&
        clonesTemplateContent &&
        !assignsInnerHtmlPerInstance
    ).toBe(true);
  });

  test('A slotchange listener reads the slot assignment via assignedElements() or filtered assignedNodes()', () => {
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

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await page.evaluate(async () => {
        // The card component: the custom element tag with the most upgraded, shadow-hosting
        // instances in the page (open roots only; closed roots are not reachable here).
        (window as any).__cardHosts = () => {
          const byTag = new Map<string, Element[]>();
          for (const el of Array.from(document.querySelectorAll('*'))) {
            if (!el.localName.includes('-') || !el.shadowRoot) continue;
            byTag.set(el.localName, [...(byTag.get(el.localName) ?? []), el]);
          }
          let best: Element[] = [];
          for (const list of byTag.values()) if (list.length > best.length) best = list;
          return best;
        };
        const tags = new Set(
          Array.from(document.querySelectorAll('*'))
            .map((el) => el.localName)
            .filter((n) => n.includes('-'))
        );
        await Promise.race([
          Promise.all(Array.from(tags, (t) => customElements.whenDefined(t))),
          new Promise((r) => setTimeout(r, 2000)),
        ]);
      });
    });

    test('The custom element attaches an open shadow root (mode: "open") to encapsulate its internal DOM subtree', async ({
      page,
    }) => {
      const hasOpenShadowRoots = await page.evaluate(() => {
        const hosts: Element[] = (window as any).__cardHosts();
        // One component instance per Seasonal Favorites drink.
        return hosts.length >= 3 && hosts.every((h) => h.shadowRoot!.mode === 'open');
      });

      expect(hasOpenShadowRoots).toBe(true);
    });

    test('Light DOM children with slot attributes are projected into matching named <slot name="..."> elements inside the shadow root, while unslotted children are projected into the default <slot>', async ({
      page,
    }) => {
      const projectsCorrectly = await page.evaluate(() => {
        const hosts: Element[] = (window as any).__cardHosts();
        if (hosts.length < 3) return false;

        const IGNORED = new Set(['script', 'template', 'style', 'link']);
        let slottedCount = 0;
        for (const host of hosts) {
          for (const child of Array.from(host.children)) {
            if (IGNORED.has(child.localName)) continue;
            const slot = child.assignedSlot;
            if (!slot || slot.getRootNode() !== host.shadowRoot) return false;
            const wanted = child.getAttribute('slot')?.trim() ?? '';
            if (wanted) slottedCount++;
            // Named children land in the slot of that name; unslotted ones in the default slot.
            if (slot.name !== wanted) return false;
          }
        }
        // Card content is supplied from the page as slotted Light DOM children.
        return slottedCount > 0;
      });

      expect(projectsCorrectly).toBe(true);
    });

    test('Adding or removing a slotted Light DOM element after upgrade updates the component state, attributes, or rendered DOM, ignoring whitespace-only text', async ({
      page,
    }) => {
      const updatedProperly = await page.evaluate(async () => {
        const hosts: Element[] = (window as any).__cardHosts();
        if (hosts.length < 3) return false;

        // Use a fresh, childless instance of the component so the check does not depend on
        // how the page configures existing cards (attribute names, pre-slotted content).
        const tagName = hosts[0].localName;
        const parent = hosts[0].parentElement!;
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

    test('Component styles live in the shadow root via adoptedStyleSheets, a <style> element, or a <link rel="stylesheet"> inside the shadow tree', async ({
      page,
    }) => {
      const stylesInShadowRoot = await page.evaluate(() => {
        const hosts: Element[] = (window as any).__cardHosts();
        if (hosts.length < 3) return false;

        return hosts.every((host) => {
          const sr = host.shadowRoot!;
          const adopted = sr.adoptedStyleSheets.some((s) => s.cssRules.length > 0);
          const styleEl = Array.from(sr.querySelectorAll('style')).some(
            (s) => (s.sheet?.cssRules.length ?? 0) > 0
          );
          const linkEl = Array.from(sr.querySelectorAll('link')).some(
            (l) =>
              l.relList.contains('stylesheet') &&
              Boolean(l.getAttribute('href')?.trim())
          );
          return adopted || styleEl || linkEl;
        });
      });

      expect(stylesInShadowRoot).toBe(true);
    });

    test('A Light DOM element outside the component that uses the same class name as an internal element does not receive the component styles', async ({
      page,
    }) => {
      const isIsolated = await page.evaluate(() => {
        const hosts: Element[] = (window as any).__cardHosts();
        if (hosts.length < 3) return false;
        const sr = hosts[0].shadowRoot!;

        // Class names already used in the Light DOM may be styled by the page itself, so only
        // probe class names that exist solely inside the component.
        const lightClasses = new Set(
          Array.from(document.querySelectorAll('[class]')).flatMap((el) =>
            Array.from(el.classList)
          )
        );
        const probes = new Map<string, string>(); // class -> tag of the internal element
        for (const el of Array.from(sr.querySelectorAll('[class]'))) {
          for (const cls of Array.from(el.classList)) {
            if (!lightClasses.has(cls) && !probes.has(cls)) probes.set(cls, el.localName);
          }
        }
        if (probes.size === 0) return false;

        const PROPS = [
          'background-color', 'background-image', 'box-shadow', 'border-top-left-radius',
          'border-top-width', 'border-top-style', 'border-top-color', 'padding-top',
          'padding-left', 'margin-top', 'color', 'font-size', 'font-weight', 'text-align',
          'display', 'position', 'line-height',
        ];

        // An outside element with the internal class must look exactly like the same element
        // without the class.
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        try {
          for (const [cls, tag] of probes) {
            const probe = document.createElement(tag);
            probe.className = cls;
            const control = document.createElement(tag);
            wrapper.append(probe, control);
            const ps = getComputedStyle(probe);
            const cs = getComputedStyle(control);
            if (PROPS.some((p) => ps.getPropertyValue(p) !== cs.getPropertyValue(p))) {
              return false;
            }
            probe.remove();
            control.remove();
          }
          return true;
        } finally {
          wrapper.remove();
        }
      });

      expect(isIsolated).toBe(true);
    });
  });
});
