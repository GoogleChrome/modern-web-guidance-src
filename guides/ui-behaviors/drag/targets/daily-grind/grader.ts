import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Daily Grind Drag Grader', () => {

  test('Draggable element uses a viewport-relative positioning model such as position: fixed', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasFixedPosition =
      rules.some((r) => r instanceof CSSStyleRule && r.style.getPropertyValue('position') === 'fixed') ||
      docs.some((d) => Boolean(d.document.querySelector('.fixed, [class*="fixed"]')));

    expect(hasFixedPosition).toBe(true);
  });

  test('Dedicated drag handle defines user-select: none to prevent text highlighting during drag', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasUserSelectNone =
      rules.some(
        (r) =>
          r instanceof CSSStyleRule &&
          /(?:handle|drag)/i.test(r.selectorText) &&
          r.style.getPropertyValue('user-select') === 'none'
      ) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="handle"].select-none, [class*="drag"].select-none'))
      );

    expect(hasUserSelectNone).toBe(true);
  });

  test('Dedicated drag handle includes -webkit-user-select: none for Safari compatibility', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const hasWebkitUserSelectNone = rules.some(
      (r) =>
        r instanceof CSSStyleRule &&
        /(?:handle|drag)/i.test(r.selectorText) &&
        r.style.getPropertyValue('-webkit-user-select') === 'none'
    );

    expect(hasWebkitUserSelectNone).toBe(true);
  });

  test('Non-handle content within the draggable component remains selectable', () => {
    const docs = getHtmlDocuments(targetFiles);
    const panelEl = docs
      .map((d) =>
        d.document.querySelector(
          'aside, dialog, [popover], [class*="panel"], [id*="panel"], [class*="draggable"], [id*="draggable"]'
        )
      )
      .find(Boolean);

    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const panelRule = rules.find(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        Boolean(panelEl) &&
        Boolean(r.selectorText) &&
        ((panelEl?.id && r.selectorText.includes(`#${panelEl.id}`)) ||
          Array.from(panelEl?.classList || []).some((cls) => r.selectorText.includes(`.${cls}`)))
    );

    const nonHandleSelectable =
      Boolean(panelEl) && (!panelRule || panelRule.style.getPropertyValue('user-select') !== 'none');

    expect(nonHandleSelectable).toBe(true);
  });

  test('Drag handle defines touch-action: none to prevent competing touch gestures', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasTouchActionNone =
      rules.some(
        (r) =>
          r instanceof CSSStyleRule &&
          /(?:handle|drag)/i.test(r.selectorText) &&
          r.style.getPropertyValue('touch-action') === 'none'
      ) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="handle"].touch-none, [class*="drag"].touch-none'))
      );

    expect(hasTouchActionNone).toBe(true);
  });

  test('Pointer repositioning calculates and preserves pointer offset from element top-left corner on grab', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const preservesOffset = sourceFiles.some((sf) => {
      const binExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasOffsetCalc = binExprs.some((be) => {
        const text = be.getText();
        return (
          be.getOperatorToken().getText() === '-' &&
          /clientX|clientY|pageX|pageY/.test(text) &&
          /left|top|rect|bounds/i.test(text)
        );
      });
      const hasOffsetUse = binExprs.some((be) => {
        const text = be.getText();
        return (
          be.getOperatorToken().getText() === '-' &&
          /clientX|clientY|pageX|pageY/.test(text) &&
          /offset/i.test(text)
        );
      });
      return hasOffsetCalc && hasOffsetUse;
    });

    expect(preservesOffset).toBe(true);
  });

  test('Drag coordinates are clamped to viewport limits so the element cannot move off-screen', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const clampsToViewport = sourceFiles.some((sf) => {
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const hasViewportDim = propAccesses.some((pa) =>
        /innerWidth|innerHeight|clientWidth|clientHeight/.test(pa.getName())
      );
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasMathClamping = callExprs.some((ce) =>
        /Math\.(min|max|clamp)/.test(ce.getExpression().getText())
      );
      return hasViewportDim && hasMathClamping;
    });

    expect(clampsToViewport).toBe(true);
  });

  test('Drag sequence remains active using pointer capture or window/document event listeners', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasCaptureOrDocListeners = sourceFiles.some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const usesPointerCapture = callExprs.some((ce) =>
        ce.getExpression().getText().includes('setPointerCapture')
      );
      const usesDocListeners = callExprs.some((ce) => {
        const text = ce.getText();
        return (
          (text.includes('document.addEventListener') || text.includes('window.addEventListener')) &&
          (text.includes('pointermove') || text.includes('pointerup') || text.includes('pointercancel'))
        );
      });
      return usesPointerCapture || usesDocListeners;
    });

    expect(hasCaptureOrDocListeners).toBe(true);
  });

  test('Interactive controls inside the draggable element remain functional and distinct from drag handle', () => {
    const docs = getHtmlDocuments(targetFiles);
    const doc = docs[0]?.document;
    const panelEl = doc?.querySelector(
      'aside, dialog, [popover], [class*="panel"], [id*="panel"], [class*="draggable"], [id*="draggable"]'
    );
    const hasControls = Boolean(panelEl?.querySelector('a, button, input, select, textarea'));

    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const controlsProtected =
      Boolean(panelEl) &&
      hasControls &&
      sourceFiles.some((sf) => {
        const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
        const usesClosest = callExprs.some((ce) => ce.getExpression().getText().includes('closest'));
        const handleEl = doc?.querySelector(
          'button[class*="handle"], button[id*="handle"], [class*="handle"], [id*="handle"]'
        );
        const handleIsSeparateChild =
          Boolean(handleEl) &&
          Boolean(panelEl?.contains(handleEl)) &&
          (panelEl?.querySelectorAll('a, button, input, select, textarea').length ?? 0) >
            (handleEl?.querySelectorAll('a, button, input, select, textarea').length ?? 0);

        return usesClosest || handleIsSeparateChild;
      });

    expect(controlsProtected).toBe(true);
  });

  test('Drag handle is keyboard-focusable without assigning role="application"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const doc = docs[0]?.document;
    const hasAppRole = Boolean(doc?.querySelector('[role="application"]'));
    const htmlHandle = doc?.querySelector(
      'button[class*="handle"], button[id*="handle"], [class*="handle"][tabindex], [id*="handle"][tabindex]'
    );

    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    let jsFocusable = false;
    for (const sf of sourceFiles) {
      const binExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      for (const be of binExprs) {
        if (be.getLeft().getText().includes('tabIndex') && be.getRight().getText() === '0') {
          jsFocusable = true;
        }
      }
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const ce of callExprs) {
        if (
          ce.getExpression().getText().includes('setAttribute') &&
          ce.getArguments()[0]?.getText().includes('tabindex')
        ) {
          jsFocusable = true;
        }
      }
    }

    const isKeyboardFocusable = (Boolean(htmlHandle) || jsFocusable) && !hasAppRole;
    expect(isKeyboardFocusable).toBe(true);
  });

  test('Element is repositionable with keyboard arrow keys when the drag handle is focused', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const handlesArrowKeys = sourceFiles.some((sf) => {
      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      return stringLiterals.some((s) => /Arrow(Left|Right|Up|Down)/.test(s.getLiteralText()));
    });

    expect(handlesArrowKeys).toBe(true);
  });

  test('Keyboard arrow key navigation prevents default scrolling behavior', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callsPreventDefault = sourceFiles.some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((ce) => ce.getExpression().getText().endsWith('preventDefault'));
    });

    expect(callsPreventDefault).toBe(true);
  });

  test('Draggable component remains visible, readable, and functional in default position without JavaScript', () => {
    const docs = getHtmlDocuments(targetFiles);
    const panelEl = docs
      .map((d) =>
        d.document.querySelector(
          'aside, dialog, [popover], [class*="panel"], [id*="panel"], [class*="draggable"], [id*="draggable"]'
        )
      )
      .find(Boolean);

    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const panelRule = rules.find(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        Boolean(panelEl) &&
        Boolean(r.selectorText) &&
        ((panelEl?.id && r.selectorText.includes(`#${panelEl.id}`)) ||
          Array.from(panelEl?.classList || []).some((cls) => r.selectorText.includes(`.${cls}`)))
    );

    const isVisibleWithoutJs =
      Boolean(panelEl) &&
      !panelEl?.hasAttribute('hidden') &&
      (!panelRule || panelRule.style.getPropertyValue('display') !== 'none');

    expect(isVisibleWithoutJs).toBe(true);
  });

  test('Generic draggable element does not require dialog or popover controls, but sets margin: 0 if dialog/popover is used', () => {
    const docs = getHtmlDocuments(targetFiles);
    const panelEl = docs
      .map((d) =>
        d.document.querySelector(
          'aside, dialog, [popover], [class*="panel"], [id*="panel"], [class*="draggable"], [id*="draggable"]'
        )
      )
      .find(Boolean);

    const isDialogOrPopover =
      Boolean(panelEl) && (panelEl?.tagName === 'DIALOG' || panelEl?.hasAttribute('popover'));

    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const panelRule = rules.find(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        Boolean(panelEl) &&
        Boolean(r.selectorText) &&
        ((panelEl?.id && r.selectorText.includes(`#${panelEl.id}`)) ||
          Array.from(panelEl?.classList || []).some((cls) => r.selectorText.includes(`.${cls}`)))
    );

    const satisfiesMarginRequirement =
      Boolean(panelEl) &&
      (!isDialogOrPopover || (Boolean(panelRule) && panelRule?.style.getPropertyValue('margin') === '0'));

    expect(satisfiesMarginRequirement).toBe(true);
  });

  test('Non-primary pointerdown events do not initiate a drag', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const ignoresNonPrimary = sourceFiles.some((sf) => {
      const binExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const checksButton = binExprs.some((be) => {
        const left = be.getLeft().getText();
        const right = be.getRight().getText();
        return (
          (left.includes('button') && (right === '0' || right === "'0'")) ||
          (right.includes('button') && (left === '0' || left === "'0'"))
        );
      });
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const checksPrimary = propAccesses.some((pa) => pa.getName() === 'isPrimary');
      return checksButton || checksPrimary;
    });

    expect(ignoresNonPrimary).toBe(true);
  });

  test('Drag handle provides a visual grab indicator with cursor: grab', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasGrabCursor =
      rules.some(
        (r) =>
          r instanceof CSSStyleRule &&
          /(?:handle|drag)/i.test(r.selectorText) &&
          r.style.getPropertyValue('cursor') === 'grab'
      ) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="handle"].cursor-grab, [class*="drag"].cursor-grab'))
      );

    expect(hasGrabCursor).toBe(true);
  });

  test('Drag handle communicates active drag state with cursor: grabbing', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasGrabbingCursor =
      rules.some(
        (r) =>
          r instanceof CSSStyleRule &&
          /(?:handle|drag)/i.test(r.selectorText) &&
          r.style.getPropertyValue('cursor') === 'grabbing'
      ) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="handle"].cursor-grabbing, [class*="drag"].cursor-grabbing'))
      );

    expect(hasGrabbingCursor).toBe(true);
  });

});
