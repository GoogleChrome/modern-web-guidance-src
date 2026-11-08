import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import { CSSGroupingRule, CSSStyleRule, type CSSRuleList, type CSSStyleSheet } from 'cssomnom';
import type { Page } from '@playwright/test';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(stylesheet: CSSStyleSheet): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  const visitRules = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        result.push(rule);
      }
      if (rule instanceof CSSGroupingRule && rule.cssRules) {
        visitRules(rule.cssRules);
      }
    }
  };
  visitRules(stylesheet.cssRules);
  return result;
}

interface PanelAndHandleMetrics {
  panel: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  handle: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  viewport: {
    width: number;
    height: number;
  };
}

async function locatePanelAndHandle(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const allElements = Array.from(document.body.querySelectorAll<HTMLElement>('*'));

    const fixedCandidates = allElements.filter((el) => {
      if (el.tagName === 'NAV' || el.closest('nav')) return false;
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed') return false;
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    });

    const topLevelFixed = fixedCandidates.filter(
      (el) => !fixedCandidates.some((other) => other !== el && other.contains(el))
    );

    const hasDragHandleSignal = (el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      const idClassAria = `${el.id} ${el.className} ${el.getAttribute('aria-label') || ''}`;
      const isHandleHook =
        el.hasAttribute('data-drag-handle') || /handle|drag|grip/i.test(idClassAria);
      const isOtherControl =
        Boolean(el.closest('input, select, textarea, a')) ||
        (Boolean(el.closest('button')) && !isHandleHook);
      if (isOtherControl) return false;
      return (
        isHandleHook ||
        style.touchAction === 'none' ||
        el.getAttribute('tabindex') === '0' ||
        style.cursor === 'grab' ||
        style.userSelect === 'none'
      );
    };

    const panel =
      topLevelFixed.find(
        (el) =>
          el.hasAttribute('data-draggable') ||
          /quick-order|order-panel|draggable/i.test(`${el.id} ${el.className}`) ||
          Array.from(el.querySelectorAll<HTMLElement>('*')).some(hasDragHandleSignal)
      ) || topLevelFixed[0];
    if (!panel) return false;
    panel.setAttribute('data-grader-panel', 'true');

    const descendants = Array.from(panel.querySelectorAll<HTMLElement>('*'));
    let handle = descendants.find((el) => el.hasAttribute('data-drag-handle') || hasDragHandleSignal(el));

    if (!handle) {
      handle = descendants.find(
        (el) =>
          !el.closest('input, select, textarea, a') &&
          (el.tagName === 'HEADER' || /handle|header|drag|grip/i.test(`${el.id} ${el.className}`))
      );
    }

    if (!handle) return false;
    handle.setAttribute('data-grader-handle', 'true');
    return true;
  });
}

async function getPanelAndHandleRects(page: Page): Promise<PanelAndHandleMetrics | null> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-grader-panel="true"]');
    const handle = document.querySelector<HTMLElement>('[data-grader-handle="true"]');
    if (!panel || !handle) return null;
    const pRect = panel.getBoundingClientRect();
    const hRect = handle.getBoundingClientRect();
    return {
      panel: {
        left: pRect.left,
        top: pRect.top,
        right: pRect.right,
        bottom: pRect.bottom,
        width: pRect.width,
        height: pRect.height,
      },
      handle: {
        left: hRect.left,
        top: hRect.top,
        right: hRect.right,
        bottom: hRect.bottom,
        width: hRect.width,
        height: hRect.height,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  });
}

test.describe('drag Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('Draggable element CSS defines a viewport-relative positioning model such as position: fixed', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasFixedPosition =
      styleRules.some((r) => r.style.getPropertyValue('position').trim() === 'fixed') ||
      docs.some((d) => Boolean(d.document.querySelector('.fixed, [class*="fixed"]')));

    expect(hasFixedPosition).toBe(true);
  });

  test('Dedicated drag handle CSS declares user-select: none and -webkit-user-select: none while keeping panel content selectable', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);

    const handleUserSelectRules = styleRules.filter(
      (r) =>
        r.style.getPropertyValue('user-select').trim() === 'none' &&
        r.style.getPropertyValue('-webkit-user-select').trim() === 'none'
    );
    expect(handleUserSelectRules.length).toBeGreaterThan(0);

    const fixedPanelRules = styleRules.filter(
      (r) => r.style.getPropertyValue('position').trim() === 'fixed'
    );
    expect(fixedPanelRules.length).toBeGreaterThan(0);

    const panelDisablesSelection = fixedPanelRules.some(
      (r) => r.style.getPropertyValue('user-select').trim() === 'none'
    );
    expect(panelDisablesSelection).toBe(false);
  });

  test('Drag handle CSS defines touch-action: none', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasTouchActionNone =
      styleRules.some((r) => r.style.getPropertyValue('touch-action').trim() === 'none') ||
      docs.some((d) => Boolean(d.document.querySelector('.touch-none, [class*="touch-none"]')));

    expect(hasTouchActionNone).toBe(true);
  });

  test('JavaScript uses pointer capture on the handle or document/window pointermove, pointerup, and pointercancel listeners', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    expect(callExpressions.length).toBeGreaterThan(0);

    const usesSetPointerCapture = callExpressions.some((call) => {
      const expr = call.getExpression();
      return (
        expr.isKind(SyntaxKind.PropertyAccessExpression) &&
        expr.getName() === 'setPointerCapture'
      );
    });

    const registeredGlobalPointerEvents = new Set<string>();
    for (const call of callExpressions) {
      const expr = call.getExpression();
      if (
        expr.isKind(SyntaxKind.PropertyAccessExpression) &&
        expr.getName() === 'addEventListener'
      ) {
        const targetText = expr.getExpression().getText();
        if (/\b(document|window|globalThis)\b/.test(targetText)) {
          const firstArg = call.getArguments()[0];
          if (firstArg && firstArg.isKind(SyntaxKind.StringLiteral)) {
            registeredGlobalPointerEvents.add(firstArg.getLiteralValue());
          }
        }
      }
    }

    const usesGlobalPointerListeners =
      registeredGlobalPointerEvents.has('pointermove') &&
      registeredGlobalPointerEvents.has('pointerup') &&
      registeredGlobalPointerEvents.has('pointercancel');

    expect(usesSetPointerCapture || usesGlobalPointerListeners).toBe(true);
  });

  test('JavaScript checks for primary pointer button before starting a drag', () => {
    const project: Project = getJsProject(targetFiles);
    const propAccesses = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression));
    expect(propAccesses.length).toBeGreaterThan(0);

    const checksPrimaryButton = propAccesses.some((prop) => {
      const name = prop.getName();
      return name === 'button' || name === 'buttons' || name === 'isPrimary';
    });

    expect(checksPrimaryButton).toBe(true);
  });

  test('Drag handle CSS defines cursor: grab and cursor: grabbing states', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasCursorGrab =
      styleRules.some((r) => r.style.getPropertyValue('cursor').trim() === 'grab') ||
      docs.some((d) => Boolean(d.document.querySelector('.cursor-grab, [class*="cursor-grab"]')));
    const hasCursorGrabbing =
      styleRules.some((r) => r.style.getPropertyValue('cursor').trim() === 'grabbing') ||
      docs.some((d) =>
        Boolean(d.document.querySelector('.cursor-grabbing, [class*="cursor-grabbing"]'))
      );

    expect(hasCursorGrab && hasCursorGrabbing).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('The draggable element uses a viewport-relative positioning model such as position: fixed', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const position = await page.$eval(
        '[data-grader-panel="true"]',
        (el) => window.getComputedStyle(el).position
      );
      expect(position).toBe('fixed');
    });

    test('The dedicated drag handle uses user-select: none while non-handle content remains selectable', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const selectionState = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-grader-panel="true"]');
        const handle = document.querySelector<HTMLElement>('[data-grader-handle="true"]');
        if (!panel || !handle) return null;

        const handleUserSelect = window.getComputedStyle(handle).userSelect;
        const nonHandleElements = Array.from(panel.querySelectorAll<HTMLElement>('*')).filter(
          (el) =>
            el !== handle &&
            !handle.contains(el) &&
            !el.contains(handle) &&
            (el.textContent || '').trim().length > 0
        );

        const hasSelectableNonHandleContent = nonHandleElements.some(
          (el) => window.getComputedStyle(el).userSelect !== 'none'
        );

        return { handleUserSelect, hasSelectableNonHandleContent };
      });

      expect(selectionState).not.toBeNull();
      expect(
        selectionState!.handleUserSelect === 'none' &&
          selectionState!.hasSelectableNonHandleContent
      ).toBe(true);
    });

    test('The drag handle defines touch-action: none in computed styles', async ({ page }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const touchAction = await page.$eval(
        '[data-grader-handle="true"]',
        (el) => window.getComputedStyle(el).touchAction
      );
      expect(touchAction).toBe('none');
    });

    test('Repositioning coordinates preserve the pointer offset from the element top-left corner calculated on pointer down', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const initial = await getPanelAndHandleRects(page);
      expect(initial).not.toBeNull();

      const grabX = Math.round(initial!.handle.left + initial!.handle.width * 0.65);
      const grabY = Math.round(initial!.handle.top + initial!.handle.height * 0.5);
      const expectedOffsetX = grabX - initial!.panel.left;
      const expectedOffsetY = grabY - initial!.panel.top;

      const dx = initial!.panel.left > 250 ? -120 : 120;
      const roomBelow = Math.max(0, initial!.viewport.height - initial!.panel.bottom);
      const dy =
        initial!.panel.top > 60
          ? -40
          : Math.min(40, Math.max(10, Math.floor(roomBelow * 0.75)));
      const targetX = grabX + dx;
      const targetY = grabY + dy;

      await page.mouse.move(grabX, grabY);
      await page.mouse.down();
      await page.mouse.move(targetX, targetY, { steps: 10 });
      await page.mouse.up();

      const after = await getPanelAndHandleRects(page);
      expect(after).not.toBeNull();

      const actualOffsetX = targetX - after!.panel.left;
      const actualOffsetY = targetY - after!.panel.top;
      const movedDistanceX = Math.abs(after!.panel.left - initial!.panel.left);

      expect(
        movedDistanceX > 80 &&
          Math.abs(actualOffsetX - expectedOffsetX) <= 3 &&
          Math.abs(actualOffsetY - expectedOffsetY) <= 3
      ).toBe(true);
    });

    test('Drag coordinates are clamped to viewport limits so the element cannot be moved fully off-screen', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const initial = await getPanelAndHandleRects(page);
      expect(initial).not.toBeNull();

      const grabX = Math.round(initial!.handle.left + initial!.handle.width / 2);
      const grabY = Math.round(initial!.handle.top + initial!.handle.height / 2);

      await page.mouse.move(grabX, grabY);
      await page.mouse.down();
      await page.mouse.move(-500, -500, { steps: 20 });

      const topLeftClamped = await getPanelAndHandleRects(page);
      expect(topLeftClamped).not.toBeNull();

      await page.mouse.move(
        initial!.viewport.width + 500,
        initial!.viewport.height + 500,
        { steps: 20 }
      );
      await page.mouse.up();

      const bottomRightClamped = await getPanelAndHandleRects(page);
      expect(bottomRightClamped).not.toBeNull();

      const isTopLeftClamped =
        topLeftClamped!.panel.left >= -1 &&
        topLeftClamped!.panel.left <= 5 &&
        topLeftClamped!.panel.top >= -1 &&
        topLeftClamped!.panel.top <= 5;

      const isBottomRightClamped =
        bottomRightClamped!.panel.right <= bottomRightClamped!.viewport.width + 2 &&
        bottomRightClamped!.panel.bottom <= bottomRightClamped!.viewport.height + 2 &&
        bottomRightClamped!.panel.left >=
          bottomRightClamped!.viewport.width - bottomRightClamped!.panel.width - 5 &&
        bottomRightClamped!.panel.bottom >= bottomRightClamped!.viewport.height - 40 &&
        bottomRightClamped!.panel.top >= 0;

      expect(isTopLeftClamped && isBottomRightClamped).toBe(true);
    });

    test('The drag sequence remains active after the pointer leaves the handle', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const initial = await getPanelAndHandleRects(page);
      expect(initial).not.toBeNull();

      const grabX = Math.round(initial!.handle.left + initial!.handle.width / 2);
      const grabY = Math.round(initial!.handle.top + initial!.handle.height / 2);

      await page.mouse.move(grabX, grabY);
      await page.mouse.down();
      await page.mouse.move(grabX - 10, grabY, { steps: 2 });

      // Jump pointer well outside the handle's bounding box
      const midX = 500;
      const midY = grabY;
      await page.mouse.move(midX, midY);
      const mid = await getPanelAndHandleRects(page);
      expect(mid).not.toBeNull();

      // Move pointer again while outside initial handle bounds to verify drag stays active
      const nextX = 250;
      const roomAbove = mid!.panel.top;
      const roomBelow = mid!.viewport.height - mid!.panel.bottom;
      const dirY = roomAbove >= roomBelow ? -1 : 1;
      const stepY = dirY * Math.min(30, Math.floor(Math.max(roomAbove, roomBelow) * 0.75));
      const nextY = grabY + stepY;
      // The pointer must end outside the handle's bounding box as it was before this move
      const pointerOutsideHandle =
        nextX < mid!.handle.left ||
        nextX > mid!.handle.right ||
        nextY < mid!.handle.top ||
        nextY > mid!.handle.bottom;
      expect(pointerOutsideHandle).toBe(true);
      await page.mouse.move(nextX, nextY);
      const duringDrag = await getPanelAndHandleRects(page);
      expect(duringDrag).not.toBeNull();

      await page.mouse.up();

      // Move after release to verify drag ended
      await page.mouse.move(600, grabY);
      const afterRelease = await getPanelAndHandleRects(page);
      expect(afterRelease).not.toBeNull();

      const continuedWhileOutside =
        Math.abs(duringDrag!.panel.left - mid!.panel.left - (nextX - midX)) <= 3 &&
        Math.abs(duringDrag!.panel.top - mid!.panel.top - (nextY - midY)) <= 3;

      const stoppedAfterRelease =
        Math.abs(afterRelease!.panel.left - duringDrag!.panel.left) <= 1 &&
        Math.abs(afterRelease!.panel.top - duringDrag!.panel.top) <= 1;

      expect(continuedWhileOutside && stoppedAfterRelease).toBe(true);
    });

    test('Interactive controls inside the draggable element remain functional and activating them does not start a drag', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const initial = await getPanelAndHandleRects(page);
      expect(initial).not.toBeNull();

      const controlRect = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-grader-panel="true"]');
        if (!panel) return null;
        const ctrl = panel.querySelector<HTMLElement>('button, input, select, textarea');
        if (!ctrl) return null;
        const r = ctrl.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
      expect(controlRect).not.toBeNull();

      const ctrlX = Math.round(controlRect!.left + controlRect!.width / 2);
      const ctrlY = Math.round(controlRect!.top + controlRect!.height / 2);

      await page.mouse.move(ctrlX, ctrlY);
      await page.mouse.down();
      await page.mouse.move(ctrlX - 100, ctrlY - 60, { steps: 5 });
      await page.mouse.up();

      const afterControlDrag = await getPanelAndHandleRects(page);
      expect(afterControlDrag).not.toBeNull();

      const didNotDragFromControl =
        Math.abs(afterControlDrag!.panel.left - initial!.panel.left) <= 1 &&
        Math.abs(afterControlDrag!.panel.top - initial!.panel.top) <= 1;

      const controlInteractionWorked = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-grader-panel="true"]');
        if (!panel) return false;
        const beforeText = panel.textContent || '';

        const actionButtons = Array.from(
          panel.querySelectorAll<HTMLButtonElement>('button')
        ).filter((btn) => btn.getAttribute('type') !== 'submit');
        const incButton = actionButtons.find((btn) =>
          /\+|increase|add/i.test(`${btn.textContent} ${btn.getAttribute('aria-label') || ''}`)
        );

        if (incButton) {
          incButton.click();
        }

        const numInput = panel.querySelector<HTMLInputElement>('input[type="number"]');
        if (numInput) {
          numInput.value = '3';
          numInput.dispatchEvent(new Event('input', { bubbles: true }));
          numInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const selectEl = panel.querySelector<HTMLSelectElement>('select');
        if (selectEl && selectEl.options.length > 1) {
          selectEl.selectedIndex = 1;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const afterText = panel.textContent || '';
        return afterText !== beforeText || (numInput !== null && numInput.value === '3');
      });

      expect(didNotDragFromControl && controlInteractionWorked).toBe(true);
    });

    test('The drag handle is keyboard-focusable without using role="application"', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const focusableState = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-grader-panel="true"]');
        const handle = document.querySelector<HTMLElement>('[data-grader-handle="true"]');
        if (!panel || !handle) return null;

        const hasApplicationRole =
          handle.getAttribute('role') === 'application' ||
          panel.getAttribute('role') === 'application' ||
          panel.querySelector('[role="application"]') !== null;

        handle.focus();
        const isFocused = document.activeElement === handle;

        return {
          hasApplicationRole,
          tabIndex: handle.tabIndex,
          isFocused,
        };
      });

      expect(focusableState).not.toBeNull();
      expect(
        !focusableState!.hasApplicationRole &&
          focusableState!.tabIndex >= 0 &&
          focusableState!.isFocused
      ).toBe(true);
    });

    test('The element is repositionable with keyboard arrow keys when the drag handle is focused, using the same viewport constraints as pointer movement', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      await page.locator('[data-grader-handle="true"]').focus();
      const pos0 = await getPanelAndHandleRects(page);
      expect(pos0).not.toBeNull();

      await page.keyboard.press('ArrowLeft');
      const posLeft = await getPanelAndHandleRects(page);
      expect(posLeft).not.toBeNull();

      await page.keyboard.press('ArrowRight');
      const posRight = await getPanelAndHandleRects(page);
      expect(posRight).not.toBeNull();

      let movedVertically = false;
      if (posRight!.panel.top >= 20) {
        await page.keyboard.press('ArrowUp');
        const posUp = await getPanelAndHandleRects(page);
        expect(posUp).not.toBeNull();

        await page.keyboard.press('ArrowDown');
        const posDown = await getPanelAndHandleRects(page);
        expect(posDown).not.toBeNull();

        movedVertically =
          posUp!.panel.top < posRight!.panel.top &&
          posDown!.panel.top > posUp!.panel.top;
      } else {
        await page.keyboard.press('ArrowDown');
        const posDown = await getPanelAndHandleRects(page);
        expect(posDown).not.toBeNull();

        await page.keyboard.press('ArrowUp');
        const posUp = await getPanelAndHandleRects(page);
        expect(posUp).not.toBeNull();

        movedVertically =
          posDown!.panel.top > posRight!.panel.top &&
          posUp!.panel.top < posDown!.panel.top;
      }

      const movedAllFourDirections =
        posLeft!.panel.left < pos0!.panel.left &&
        posRight!.panel.left > posLeft!.panel.left &&
        movedVertically;

      // Test right viewport boundary clamping via ArrowRight
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
      }
      const rightBoundary = await getPanelAndHandleRects(page);
      expect(rightBoundary).not.toBeNull();

      // Move near top-left and test top-left viewport boundary clamping via ArrowLeft and ArrowUp
      const grabX = Math.round(rightBoundary!.handle.left + rightBoundary!.handle.width / 2);
      const grabY = Math.round(rightBoundary!.handle.top + rightBoundary!.handle.height / 2);
      await page.mouse.move(grabX, grabY);
      await page.mouse.down();
      await page.mouse.move(5, 5, { steps: 20 });
      await page.mouse.up();

      await page.locator('[data-grader-handle="true"]').focus();
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowUp');
      }
      const topLeftBoundary = await getPanelAndHandleRects(page);
      expect(topLeftBoundary).not.toBeNull();

      const clampedWithinViewport =
        rightBoundary!.panel.right <= rightBoundary!.viewport.width + 2 &&
        topLeftBoundary!.panel.left >= -1 &&
        topLeftBoundary!.panel.left <= 5 &&
        topLeftBoundary!.panel.top >= -1 &&
        topLeftBoundary!.panel.top <= 5;

      expect(movedAllFourDirections && clampedWithinViewport).toBe(true);
    });

    test('Without JavaScript the element, its content, and its controls remain visible, readable, and functional in a sensible default position', async ({
      browser,
      TARGET_URL,
    }) => {
      const noJsContext = await browser.newContext({ javaScriptEnabled: false });
      try {
        const noJsPage = await noJsContext.newPage();
        await noJsPage.goto(TARGET_URL);

        const found = await locatePanelAndHandle(noJsPage);
        expect(found).toBe(true);

        const noJsState = await noJsPage.evaluate(() => {
          const panel = document.querySelector<HTMLElement>('[data-grader-panel="true"]');
          if (!panel) return null;
          const style = window.getComputedStyle(panel);
          const rect = panel.getBoundingClientRect();
          const controls = Array.from(
            panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a')
          );
          const visibleEnabledControls = controls.filter((c) => {
            const cs = window.getComputedStyle(c);
            const cr = c.getBoundingClientRect();
            const isDisabled =
              (c as HTMLButtonElement | HTMLInputElement | HTMLSelectElement).disabled === true;
            return (
              cs.display !== 'none' &&
              cs.visibility !== 'hidden' &&
              cr.width > 0 &&
              cr.height > 0 &&
              !isDisabled
            );
          });

          return {
            isVisible:
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              parseFloat(style.opacity || '1') > 0 &&
              rect.width > 0 &&
              rect.height > 0,
            withinViewport:
              rect.left >= 0 &&
              rect.top >= 0 &&
              rect.right <= window.innerWidth + 2 &&
              rect.bottom <= window.innerHeight + 2,
            textLength: (panel.textContent || '').trim().length,
            controlCount: visibleEnabledControls.length,
          };
        });

        expect(noJsState).not.toBeNull();
        expect(
          noJsState!.isVisible &&
            noJsState!.withinViewport &&
            noJsState!.textLength > 10 &&
            noJsState!.controlCount > 0
        ).toBe(true);
      } finally {
        await noJsContext.close();
      }
    });

    test('A pointerdown event with a non-primary button does not start a drag', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const initial = await getPanelAndHandleRects(page);
      expect(initial).not.toBeNull();

      const grabX = Math.round(initial!.handle.left + initial!.handle.width / 2);
      const grabY = Math.round(initial!.handle.top + initial!.handle.height / 2);

      await page.mouse.move(grabX, grabY);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(grabX - 120, grabY - 60, { steps: 5 });
      await page.mouse.up({ button: 'right' });

      const afterRightDrag = await getPanelAndHandleRects(page);
      expect(afterRightDrag).not.toBeNull();

      expect(
        Math.abs(afterRightDrag!.panel.left - initial!.panel.left) <= 1 &&
          Math.abs(afterRightDrag!.panel.top - initial!.panel.top) <= 1
      ).toBe(true);
    });

    test('The drag handle provides a visual grab indicator transitioning from cursor: grab to cursor: grabbing on drag', async ({
      page,
    }) => {
      const found = await locatePanelAndHandle(page);
      expect(found).toBe(true);

      const initial = await getPanelAndHandleRects(page);
      expect(initial).not.toBeNull();

      const idleCursor = await page.$eval(
        '[data-grader-handle="true"]',
        (el) => window.getComputedStyle(el).cursor
      );

      const grabX = Math.round(initial!.handle.left + initial!.handle.width / 2);
      const grabY = Math.round(initial!.handle.top + initial!.handle.height / 2);

      await page.mouse.move(grabX, grabY);
      await page.mouse.down();
      await page.mouse.move(grabX - 40, grabY - 20, { steps: 3 });

      const draggingCursor = await page.$eval(
        '[data-grader-handle="true"]',
        (el) => window.getComputedStyle(el).cursor
      );

      await page.mouse.up();

      const releasedCursor = await page.$eval(
        '[data-grader-handle="true"]',
        (el) => window.getComputedStyle(el).cursor
      );

      expect(
        idleCursor === 'grab' && draggingCursor === 'grabbing' && releasedCursor === 'grab'
      ).toBe(true);
    });
  });
});
