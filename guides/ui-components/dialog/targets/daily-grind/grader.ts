import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { Node, SyntaxKind, type Project } from 'ts-morph';
import { CSSStyleRule, CSSGroupingRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';

import * as path from 'path';
import { pathToFileURL } from 'url';

const currentFileUrl = typeof __filename !== 'undefined' ? pathToFileURL(__filename).href : pathToFileURL(path.resolve('grader.ts')).href;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectStyleRules(rule.cssRules));
    }
  }
  return result;
}

function getAllDialogs(docs: Array<{ file: string; document: any }>): any[] {
  return docs.flatMap((d) => Array.from(d.document.querySelectorAll('dialog')));
}

function hasValidAccessibleName(dialog: any, doc: any, project: Project = getJsProject(targetFiles)): boolean {
  const ariaLabel = dialog.getAttribute('aria-label')?.trim();
  if (ariaLabel && ariaLabel.length > 0) {
    return true;
  }
  const labelledBy = dialog.getAttribute('aria-labelledby')?.trim();
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    return ids.some((id: string) => {
      const target = doc.getElementById(id) || doc.querySelector(`[id="${id}"]`);
      if (!target) return false;
      if (target.textContent?.trim().length > 0 || target.getAttribute('aria-label')?.trim().length > 0) {
        return true;
      }
      return project.getSourceFiles().some(
        (sf) =>
          sf.getFullText().includes(id) &&
          sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) =>
            /\.(textContent|innerText)\b/.test(bin.getLeft().getText())
          )
      );
    });
  }
  return false;
}

function hasDeclarativeModalInvoker(docs: Array<{ file: string; document: any }>): boolean {
  return docs.some((d) => {
    const invokers = Array.from(d.document.querySelectorAll('button[command][commandfor]'));
    return invokers.some((invoker: any) => {
      const cmd = invoker.getAttribute('command')?.trim().toLowerCase();
      const targetId = invoker.getAttribute('commandfor')?.trim();
      return Boolean(cmd === 'show-modal' && targetId && d.document.querySelector(`dialog[id="${targetId}"]`));
    });
  });
}

function hasImperativeShowModal(project: Project, docs: Array<{ file: string; document: any }> = []): boolean {
  const inScripts = project.getSourceFiles().some((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      const expr = call.getExpression();
      return (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'showModal'
      );
    })
  );
  const inInlineHandlers = docs.some((d) =>
    Boolean(d.document.querySelector('button[onclick*="showModal("]'))
  );
  return inScripts || inInlineHandlers;
}

function isModalImplementationValid(docs: Array<{ file: string; document: any }>, project: Project): boolean {
  const dialogs = getAllDialogs(docs);
  if (dialogs.length === 0) return false;
  return hasDeclarativeModalInvoker(docs) || hasImperativeShowModal(project, docs);
}

/** Maps every locally declared function name (declarations and `const f = () => {}`) to its node. */
function getLocalFunctions(project: Project): Map<string, Node> {
  const fns = new Map<string, Node>();
  for (const sf of project.getSourceFiles()) {
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
      const name = decl.getName();
      if (name) fns.set(name, decl);
    }
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const init = decl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        fns.set(decl.getName(), init);
      }
    }
  }
  return fns;
}

/** Resolves a handler argument (inline function or identifier) to a function node. */
function resolveFunction(arg: Node | undefined, fns: Map<string, Node>): Node | undefined {
  if (!arg) return undefined;
  if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) return arg;
  if (Node.isIdentifier(arg)) return fns.get(arg.getText());
  return arg;
}

/** Returns the function plus every local helper it calls (transitively), so wrapper calls are traced. */
function expandWithHelpers(fn: Node, fns: Map<string, Node>, depth = 3): Node[] {
  const seen = new Set<Node>([fn]);
  let frontier = [fn];
  for (let i = 0; i < depth; i++) {
    const next: Node[] = [];
    for (const node of frontier) {
      for (const call of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const callee = call.getExpression();
        const helper = Node.isIdentifier(callee) ? fns.get(callee.getText()) : undefined;
        if (helper && !seen.has(helper)) {
          seen.add(helper);
          next.push(helper);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

/** Collects handler bodies (with traced helpers) for `addEventListener(event, fn)` and `el.on<event> = fn`. */
function getEventHandlers(project: Project, events: string[]): Node[][] {
  const fns = getLocalFunctions(project);
  const handlers: Node[][] = [];
  for (const sf of project.getSourceFiles()) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
      if (expr?.getName() !== 'addEventListener') continue;
      const eventType = call.getArguments()[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
      if (!eventType || !events.includes(eventType)) continue;
      const fn = resolveFunction(call.getArguments()[1], fns);
      if (fn) handlers.push(expandWithHelpers(fn, fns));
    }
    for (const bin of sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
      const left = bin.getLeft().asKind(SyntaxKind.PropertyAccessExpression);
      if (!left || !events.map((e) => `on${e}`).includes(left.getName())) continue;
      const fn = resolveFunction(bin.getRight(), fns);
      if (fn) handlers.push(expandWithHelpers(fn, fns));
    }
  }
  return handlers;
}

function propertyNames(nodes: Node[]): Set<string> {
  return new Set(
    nodes.flatMap((n) => n.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).map((p) => p.getName()))
  );
}

function stringLiterals(nodes: Node[]): Set<string> {
  return new Set(
    nodes.flatMap((n) => [
      ...n.getDescendantsOfKind(SyntaxKind.StringLiteral).map((s) => s.getLiteralValue()),
      ...n.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((s) => s.getLiteralValue()),
    ])
  );
}

const EQUALITY_OPS = new Set([
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken,
]);

/** True when the handler decides dismissal by event-target identity (e.g. `e.target === dialog`, `!dialog.contains(e.target)`). */
function hasTargetIdentityCheck(nodes: Node[]): boolean {
  const isTargetAccess = (n: Node) =>
    Node.isPropertyAccessExpression(n) && (n.getName() === 'target' || n.getName() === 'srcElement');
  return nodes.some(
    (n) =>
      n.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
        if (!EQUALITY_OPS.has(bin.getOperatorToken().getKind())) return false;
        const [l, r] = [bin.getLeft(), bin.getRight()];
        const targetVsRef =
          (isTargetAccess(l) && !Node.isStringLiteral(r)) || (isTargetAccess(r) && !Node.isStringLiteral(l));
        const targetTagIsDialog = [l, r].some(
          (side) =>
            Node.isPropertyAccessExpression(side) &&
            ['tagName', 'nodeName', 'localName'].includes(side.getName()) &&
            side.getExpression().getText().endsWith('.target')
        );
        return targetVsRef || targetTagIsDialog;
      }) ||
      n.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
        return expr?.getName() === 'contains' && call.getArguments().some((a) => isTargetAccess(a));
      })
  );
}

/** True when the handler (or a helper it calls) tests pointer coordinates against the dialog box. */
function usesPointerGeometry(nodes: Node[]): boolean {
  const props = propertyNames(nodes);
  return ['getBoundingClientRect', 'clientX', 'clientY', 'pageX', 'pageY', 'offsetX', 'offsetY'].some((p) =>
    props.has(p)
  );
}

/** Backdrop dismissal that relies on event-target identity instead of pointer geometry (the guide's anti-pattern). */
function hasNaiveBackdropDismiss(project: Project): boolean {
  return getEventHandlers(project, ['click', 'pointerup', 'mouseup']).some(
    (nodes) => hasTargetIdentityCheck(nodes) && !usesPointerGeometry(nodes)
  );
}

/** A keyboard handler that checks for the Escape key (the guide forbids manual Esc handling). */
function hasManualEscapeHandler(project: Project): boolean {
  return getEventHandlers(project, ['keydown', 'keyup', 'keypress']).some((nodes) => {
    const literals = stringLiterals(nodes);
    const checksKeyCode27 = nodes.some((n) =>
      n.getDescendantsOfKind(SyntaxKind.BinaryExpression).some(
        (bin) => {
          if (!EQUALITY_OPS.has(bin.getOperatorToken().getKind())) return false;
          const sides = [bin.getLeft(), bin.getRight()];
          return (
            sides.some((s) => Node.isNumericLiteral(s) && s.getLiteralValue() === 27) &&
            sides.some((s) => Node.isPropertyAccessExpression(s) && ['keyCode', 'which'].includes(s.getName()))
          );
        }
      )
    );
    return literals.has('Escape') || literals.has('Esc') || checksKeyCode27;
  });
}

/** A keyboard handler that intercepts Tab to cycle focus (a manual focus trap). */
function hasManualFocusTrap(project: Project): boolean {
  return getEventHandlers(project, ['keydown', 'keyup']).some((nodes) => {
    const literals = stringLiterals(nodes);
    return literals.has('Tab') && propertyNames(nodes).has('focus');
  });
}

/** Code that toggles `inert` on page content. */
function togglesInert(project: Project): boolean {
  return project.getSourceFiles().some(
    (sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
        const left = bin.getLeft().asKind(SyntaxKind.PropertyAccessExpression);
        return bin.getOperatorToken().getKind() === SyntaxKind.EqualsToken && left?.getName() === 'inert';
      }) ||
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const name = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName();
        const attr = call.getArguments()[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
        return (name === 'setAttribute' || name === 'toggleAttribute' || name === 'removeAttribute') && attr === 'inert';
      })
  );
}

/** A `close` listener (or a helper it calls) that moves focus manually instead of relying on native focus return. */
function hasManualFocusReturnOnClose(project: Project): boolean {
  return getEventHandlers(project, ['close']).some((nodes) => propertyNames(nodes).has('focus'));
}

test.describe('dialog Target Grader', () => {
  test('The overlay is a <dialog> with a non-empty accessible name (aria-labelledby or aria-label)', () => {
    const docs = getHtmlDocuments(targetFiles);
    const dialogsWithDocs = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('dialog')).map((dialog) => ({ dialog, doc: d.document }))
    );
    const allNamed =
      dialogsWithDocs.length > 0 &&
      dialogsWithDocs.every(({ dialog, doc }) => hasValidAccessibleName(dialog, doc));
    expect(allNamed).toBe(true);
  });

  test('A modal dialog is opened with showModal() or command="show-modal", and :modal matches while it is open', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);
    const modalDialogs = dialogs.filter((d) => !d.hasAttribute('popover'));
    const hasNoStaticOpenAttr = modalDialogs.length > 0 && modalDialogs.every((d) => !d.hasAttribute('open'));
    const openedWithShowModal = isModalImplementationValid(docs, project);
    expect(hasNoStaticOpenAttr && openedWithShowModal).toBe(true);
  });

  test('Focus returns to the invoking element when a modal dialog closes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const invokersAreButtons = docs.some((d) => {
      const hasTriggerButtons =
        Boolean(d.document.querySelector('.hero button')) &&
        Boolean(d.document.querySelector('.card button'));
      const hasUnconvertedLinks = Boolean(d.document.querySelector('.hero a, .card a'));
      return hasTriggerButtons && !hasUnconvertedLinks;
    });
    expect(
      isModalImplementationValid(docs, project) && invokersAreButtons && !hasManualFocusReturnOnClose(project)
    ).toBe(true);
  });

  test('Pressing Esc closes an open modal dialog unless closedby="none" is set', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);
    const allDialogsHaveValidClosedBy = dialogs.every((d) => {
      const closedBy = d.getAttribute('closedby')?.trim().toLowerCase();
      return !closedBy || closedBy === 'any' || closedBy === 'closerequest' || closedBy === 'none';
    });
    expect(
      isModalImplementationValid(docs, project) &&
        allDialogsHaveValidClosedBy &&
        !hasManualEscapeHandler(project)
    ).toBe(true);
  });

  test('When light dismiss is requested on a dialog, clicking the backdrop closes it', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);
    const hasNativeLightDismiss = dialogs.some((d) => {
      const closedBy = d.getAttribute('closedby')?.trim().toLowerCase();
      const popoverAttr = d.getAttribute('popover')?.trim().toLowerCase();
      return (
        closedBy === 'any' ||
        (d.hasAttribute('popover') && (!popoverAttr || popoverAttr === 'auto'))
      );
    });
    const allCalls = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasPointerLightDismiss =
      allCalls.some(
        (c) => c.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'getBoundingClientRect'
      ) &&
      allCalls.some(
        (c) => c.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'close'
      );
    const hasNaiveClickLightDismiss = hasNaiveBackdropDismiss(project);
    const lightDismissNotRequested =
      !hasNaiveClickLightDismiss &&
      dialogs.every((d) => {
        const closedBy = d.getAttribute('closedby')?.trim().toLowerCase();
        return !closedBy || closedBy === 'closerequest' || closedBy === 'none';
      });
    expect(
      dialogs.length > 0 &&
        (hasNativeLightDismiss || hasPointerLightDismiss || lightDismissNotRequested)
    ).toBe(true);
  });

  test('A backdrop-click fallback, if present, does not close the dialog when a press starts inside the dialog and ends on the backdrop', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);

    const sourceFiles = project.getSourceFiles();
    const allCalls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const listenerCalls = allCalls.filter(
      (call) => call.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'addEventListener'
    );
    const pointerListenerEvents = listenerCalls
      .map((call) => call.getArguments()[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue())
      .filter(Boolean);

    const hasTargetEqualityClickDismiss = hasNaiveBackdropDismiss(project);

    const hasBoundsCheckWithClose =
      allCalls.some(
        (call) =>
          call.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() ===
          'getBoundingClientRect'
      ) &&
      allCalls.some(
        (call) =>
          call.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'close'
      ) &&
      pointerListenerEvents.some((ev) =>
        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].includes(ev || '')
      );

    const hasPressAndReleaseTracking =
      (pointerListenerEvents.includes('pointerdown') &&
        (pointerListenerEvents.includes('pointerup') || pointerListenerEvents.includes('click'))) ||
      (pointerListenerEvents.includes('mousedown') &&
        (pointerListenerEvents.includes('mouseup') || pointerListenerEvents.includes('click')));

    const fallbackChecksBothPressAndRelease =
      !hasTargetEqualityClickDismiss && (!hasBoundsCheckWithClose || hasPressAndReleaseTracking);

    expect(dialogs.length > 0 && fallbackChecksBothPressAndRelease).toBe(true);
  });

  test('When a dialog guards unsaved form changes, it has closedby="none"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);

    const sourceFiles = project.getSourceFiles();
    const cancelListenersPreventDefault = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
        if (expr?.getName() !== 'addEventListener') return false;
        if (call.getArguments()[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() !== 'cancel') {
          return false;
        }
        const handler = call.getArguments()[1];
        if (!handler) return false;
        const scope =
          handler.getKind() === SyntaxKind.ArrowFunction ||
          handler.getKind() === SyntaxKind.FunctionExpression
            ? handler
            : sf;
        return scope
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((c) => c.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'preventDefault');
      })
    );

    const setsClosedByNoneInJs = sourceFiles.some((sf) =>
      /\bclosedBy\s*=\s*['"`]none['"`]|setAttribute\s*\(\s*['"`]closedby['"`]\s*,\s*['"`]none['"`]\s*\)/i.test(
        sf.getFullText()
      )
    );

    const guardedDialogsValid =
      !cancelListenersPreventDefault ||
      setsClosedByNoneInJs ||
      dialogs.some((d) => d.getAttribute('closedby')?.trim().toLowerCase() === 'none');

    expect(dialogs.length > 0 && guardedDialogsValid).toBe(true);
  });

  test('When a dialog guards unsaved form changes, it stays open after a cancel request with unsaved edits until the user confirms', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);

    const closedByNoneDialogs = dialogs.filter(
      (d) => d.getAttribute('closedby')?.trim().toLowerCase() === 'none'
    );

    const hasCancelGuardWhenClosedByNone =
      closedByNoneDialogs.length === 0 ||
      project.getSourceFiles().some((sf) =>
        sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
          const expr = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
          if (expr?.getName() !== 'addEventListener') return false;
          if (call.getArguments()[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() !== 'cancel') {
            return false;
          }
          const handler = call.getArguments()[1];
          if (!handler) return false;
          const scope =
            handler.getKind() === SyntaxKind.ArrowFunction ||
            handler.getKind() === SyntaxKind.FunctionExpression
              ? handler
              : sf;
          return scope
            .getDescendantsOfKind(SyntaxKind.CallExpression)
            .some((c) => c.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'preventDefault');
        })
      );

    expect(dialogs.length > 0 && hasCancelGuardWhenClosedByNone).toBe(true);
  });

  test('A non-modal dialog panel leaves the page behind it interactive', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);

    const hasImperativeShow = project.getSourceFiles().some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some(
        (call) => call.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'show'
      )
    );
    const nonModalDialogs = dialogs.filter((d) => d.hasAttribute('popover') || hasImperativeShow);
    const nonModalHasCloseControl = nonModalDialogs.every((d) =>
      Boolean(d.querySelector('button, [popovertargetaction="hide"], [command="close"], [command="hide-popover"]'))
    );
    const togglesInertOnPage = togglesInert(project);

    expect(
      dialogs.length > 0 &&
        (isModalImplementationValid(docs, project) || nonModalDialogs.length > 0) &&
        nonModalHasCloseControl &&
        !togglesInertOnPage
    ).toBe(true);
  });

  test('While a modal dialog is open, content outside it is not focusable', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);

    const hasMainPageOutsideDialogs = docs.some((d) => {
      const mainOrHeader = d.document.querySelector('main, header, nav, footer');
      return Boolean(mainOrHeader && !mainOrHeader.closest('dialog'));
    });

    expect(
      dialogs.length > 0 &&
        hasMainPageOutsideDialogs &&
        isModalImplementationValid(docs, project) &&
        !hasManualFocusTrap(project) &&
        !togglesInert(project)
    ).toBe(true);
  });

  test('No <dialog> has role="dialog" or aria-modal', () => {
    const docs = getHtmlDocuments(targetFiles);
    const dialogs = getAllDialogs(docs);
    const noneHaveRedundantAria =
      dialogs.length > 0 &&
      dialogs.every((d) => d.getAttribute('role') !== 'dialog' && !d.hasAttribute('aria-modal'));
    expect(noneHaveRedundantAria).toBe(true);
  });

  test('While a modal dialog is open, scrolling over its backdrop or inside it does not scroll the page behind it', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const dialogRules = styleRules.filter((r) =>
      (r.selectorText || '')
        .split(',')
        .some((s) => {
          const subject = s.trim().split(/[\s>+~]+/).pop() || '';
          return (
            !subject.includes('::') &&
            !/^dialog[-_]/i.test(subject) &&
            (/^dialog\b/i.test(subject) || /:modal\b/.test(subject))
          );
        })
    );

    const hasModalOverscrollContain =
      dialogRules.some((r) => {
        const overscroll =
          r.style.getPropertyValue('overscroll-behavior') ||
          r.style.getPropertyValue('overscroll-behavior-y') ||
          r.style.getPropertyValue('overscroll-behavior-block');
        return /\b(contain|none)\b/.test(overscroll);
      }) &&
      !dialogRules.some((r) => {
        const overflow =
          r.style.getPropertyValue('overflow') ||
          r.style.getPropertyValue('overflow-y') ||
          r.style.getPropertyValue('overflow-block');
        return /\b(visible|clip)\b/.test(overflow);
      });

    const backdropRules = styleRules.filter((r) =>
      (r.selectorText || '').split(',').some((s) => /::backdrop\b/.test(s))
    );

    const hasBackdropOverflow = backdropRules.some((r) => {
      const overflow =
        r.style.getPropertyValue('overflow') ||
        r.style.getPropertyValue('overflow-y') ||
        r.style.getPropertyValue('overflow-block');
      return /\b(hidden|auto|scroll)\b/.test(overflow);
    });

    const hasBackdropOverscroll = backdropRules.some((r) => {
      const overscroll =
        r.style.getPropertyValue('overscroll-behavior') ||
        r.style.getPropertyValue('overscroll-behavior-y') ||
        r.style.getPropertyValue('overscroll-behavior-block');
      return /\b(contain|none)\b/.test(overscroll);
    });

    expect(hasModalOverscrollContain && hasBackdropOverflow && hasBackdropOverscroll).toBe(true);
  });
});
