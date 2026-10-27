import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
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
    expect(isModalImplementationValid(docs, project) && invokersAreButtons).toBe(true);
  });

  test('Pressing Esc closes an open modal dialog unless closedby="none" is set', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const dialogs = getAllDialogs(docs);
    const allDialogsHaveValidClosedBy = dialogs.every((d) => {
      const closedBy = d.getAttribute('closedby')?.trim().toLowerCase();
      return !closedBy || closedBy === 'any' || closedBy === 'closerequest' || closedBy === 'none';
    });
    const hasManualEscapeHandler = project.getSourceFiles().some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
        if (expr?.getName() !== 'addEventListener') return false;
        const eventType = call.getArguments()[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
        if (eventType !== 'keydown' && eventType !== 'keyup') return false;
        const handler = call.getArguments()[1];
        const handlerText =
          handler?.getKind() === SyntaxKind.ArrowFunction ||
          handler?.getKind() === SyntaxKind.FunctionExpression
            ? handler.getText()
            : sf.getFullText();
        return /\bEscape\b|\bEsc\b/.test(handlerText) && /\.close\s*\(/.test(handlerText);
      })
    );
    expect(
      isModalImplementationValid(docs, project) &&
        allDialogsHaveValidClosedBy &&
        !hasManualEscapeHandler
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
    const hasNaiveClickLightDismiss = allCalls.some((call) => {
      if (call.getExpression().asKind(SyntaxKind.PropertyAccessExpression)?.getName() !== 'addEventListener') {
        return false;
      }
      const eventType = call.getArguments()[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
      if (eventType !== 'click' && eventType !== 'pointerup' && eventType !== 'mouseup') return false;
      const handlerText = call.getArguments()[1]?.getText() || '';
      return (
        (/\.target\s*===?\s*|\s===?\s*[^;)]*\.target\b/.test(handlerText) ||
          /!\s*[\w$.]+\.contains\s*\(\s*[\w$.]*\.target\b/.test(handlerText)) &&
        /\.close\s*\(/.test(handlerText)
      );
    });
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

    const hasTargetEqualityClickDismiss = listenerCalls.some((call) => {
      const eventType = call.getArguments()[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
      if (eventType !== 'click' && eventType !== 'pointerup' && eventType !== 'mouseup') return false;
      const handlerText = call.getArguments()[1]?.getText() || '';
      return (
        (/\.target\s*===?\s*|\s===?\s*[^;)]*\.target\b/.test(handlerText) ||
          /!\s*[\w$.]+\.contains\s*\(\s*[\w$.]*\.target\b/.test(handlerText)) &&
        /\.close\s*\(/.test(handlerText)
      );
    });

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
    const togglesInertOnPage = project.getSourceFiles().some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) =>
        /\.inert\b/.test(bin.getLeft().getText())
      )
    );

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

    expect(dialogs.length > 0 && hasMainPageOutsideDialogs && isModalImplementationValid(docs, project)).toBe(true);
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
