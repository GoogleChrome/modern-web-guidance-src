import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import { CSSStyleRule } from 'cssomnom';
import type { Page } from '@playwright/test';

// @ts-ignore - package.json does not specify "type": "module" for tsc nodenext check
const targetFiles: string[] = getTargetFiles(import.meta.url);

async function openModalDialog(page: Page) {
  const trigger = page.getByRole('button', { name: /order now|view details/i }).first();
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await trigger.click();
  const dialog = page.locator('dialog[open]').first();
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

async function makeDialogDirty(page: Page) {
  const changed = await page.evaluate(() => {
    const dlg = document.querySelector('dialog[open]');
    if (!dlg) return false;

    const numInput = dlg.querySelector<HTMLInputElement>('input[type="number"]');
    if (numInput) {
      const current = Number(numInput.value) || 1;
      numInput.value = String(current + 1);
      numInput.dispatchEvent(new Event('input', { bubbles: true }));
      numInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    const select = dlg.querySelector<HTMLSelectElement>('select');
    if (select && select.options.length > 1) {
      select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    const radios = Array.from(dlg.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const unchecked = radios.find((r) => !r.checked);
    if (unchecked) {
      unchecked.checked = true;
      unchecked.dispatchEvent(new Event('input', { bubbles: true }));
      unchecked.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    const textInput = dlg.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'textarea, input[type="text"]',
    );
    if (textInput) {
      textInput.value = 'extra hot';
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      textInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  });
  expect(changed).toBe(true);
}

test.describe('dialog Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The overlay is a <dialog> with a non-empty accessible name (aria-labelledby or aria-label)', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const dialogs = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('dialog')).map((dialog) => ({
        dialog,
        document: d.document,
      })),
    );
    expect(dialogs.length).toBeGreaterThan(0);

    for (const { dialog, document } of dialogs) {
      const ariaLabel = dialog.getAttribute('aria-label')?.trim() ?? '';
      const ariaLabelledby = dialog.getAttribute('aria-labelledby')?.trim() ?? '';

      const hasValidLabelledby =
        ariaLabelledby.length > 0 &&
        ariaLabelledby
          .split(/\s+/)
          .some((id) => Boolean(document.getElementById(id)?.textContent?.trim()));

      expect(ariaLabel.length > 0 || hasValidLabelledby).toBe(true);
    }
  });

  test('No <dialog> has role="dialog" or aria-modal', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const dialogs = docs.flatMap((d) => Array.from(d.document.querySelectorAll('dialog')));
    expect(dialogs.length).toBeGreaterThan(0);

    for (const dialog of dialogs) {
      expect(dialog.hasAttribute('role')).toBe(false);
      expect(dialog.hasAttribute('aria-modal')).toBe(false);
    }
  });

  test('A modal dialog is opened with showModal() or command="show-modal"', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasCommandShowModal = docs.some((d) =>
      Boolean(d.document.querySelector('[command="show-modal"]')),
    );

    const project: Project = getJsProject(targetFiles);
    const callExprs = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasShowModalCall = callExprs.some((call) => {
      const expr = call.getExpression();
      return (
        expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'showModal'
      );
    });

    expect(hasCommandShowModal || hasShowModalCall).toBe(true);
  });

  test('While a modal dialog is open, scrolling over its backdrop or inside it does not scroll the page behind it (CSS overscroll-behavior & overflow)', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);
    expect(styleRules.length).toBeGreaterThan(0);

    const hasModalOverscroll = styleRules.some(
      (r) =>
        (/dialog:modal\b/.test(r.selectorText) || /\bdialog\b/.test(r.selectorText)) &&
        /\bcontain\b/.test(r.style.getPropertyValue('overscroll-behavior')),
    );

    const hasBackdropScrollContainment = styleRules.some(
      (r) =>
        /::backdrop\b/.test(r.selectorText) &&
        /\bhidden\b/.test(r.style.getPropertyValue('overflow')) &&
        /\bcontain\b/.test(r.style.getPropertyValue('overscroll-behavior')),
    );

    expect(hasModalOverscroll && hasBackdropScrollContainment).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('The overlay is a <dialog> with a non-empty accessible name in the live DOM', async ({
      page,
    }) => {
      const { dialog } = await openModalDialog(page);
      await expect(dialog).toHaveRole('dialog');
      const accessibleName = await dialog.evaluate((el) => {
        const ariaLabel = el.getAttribute('aria-label')?.trim();
        if (ariaLabel) return ariaLabel;
        const labelledBy = el.getAttribute('aria-labelledby')?.trim();
        if (labelledBy) {
          return labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
            .join(' ')
            .trim();
        }
        return '';
      });
      expect(accessibleName.length).toBeGreaterThan(0);
    });

    test('A modal dialog is opened with showModal() or command="show-modal", and :modal matches while it is open', async ({
      page,
    }) => {
      await openModalDialog(page);
      const matchesModal = await page.evaluate(() =>
        Boolean(document.querySelector('dialog:modal')),
      );
      expect(matchesModal).toBe(true);
    });

    test('Focus returns to the invoking element when a modal dialog closes', async ({ page }) => {
      const { trigger, dialog } = await openModalDialog(page);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test('Pressing Esc closes an open modal dialog unless closedby="none" is set', async ({
      page,
    }) => {
      const { dialog } = await openModalDialog(page);
      const closedBy = await dialog.getAttribute('closedby');
      expect(closedBy).not.toBe('none');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });

    test('A pointer press that starts inside the dialog and ends on the backdrop does not close it', async ({
      page,
    }) => {
      const { dialog } = await openModalDialog(page);
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        const insideX = box.x + box.width / 2;
        const insideY = box.y + box.height / 2;
        await page.mouse.move(insideX, insideY);
        await page.mouse.down();
        await page.mouse.move(5, 5);
        await page.mouse.up();
      }
      await expect(dialog).toBeVisible();
    });

    test('While the dialog has unsaved changes, it has closedby="none"', async ({ page }) => {
      const { dialog } = await openModalDialog(page);
      await makeDialogDirty(page);
      await expect(dialog).toHaveAttribute('closedby', 'none');
    });

    test('While the dialog has unsaved changes, a cancel request leaves it open until the user confirms discarding them', async ({
      page,
    }) => {
      const { dialog } = await openModalDialog(page);
      await makeDialogDirty(page);

      // Trigger a cancel request via Escape (does not close when closedby="none" is active)
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();

      // Trigger a cancel request via the cancel/close button inside the dialog
      // (which invokes request-close / requestClose() or dispatches cancel)
      const discardBtn = dialog.getByRole('button', { name: /discard/i });
      if (!(await discardBtn.isVisible())) {
        const cancelBtn = dialog
          .getByRole('button', { name: /cancel|close/i })
          .first();
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
      }
      await expect(dialog).toBeVisible();

      // Confirm discarding changes via the revealed discard button
      await expect(discardBtn).toBeVisible();
      await discardBtn.click();
      await expect(dialog).toBeHidden();
    });

    test('While a modal dialog is open, content outside it is not focusable', async ({ page }) => {
      await openModalDialog(page);
      const outsideCanFocus = await page.evaluate(() => {
        const dialogEl = document.querySelector('dialog:modal');
        if (!dialogEl) return true;
        const outsideInteractive = Array.from(
          document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea'),
        ).filter((el) => !dialogEl.contains(el));
        for (const el of outsideInteractive) {
          el.focus();
          if (document.activeElement === el) {
            return true;
          }
        }
        return false;
      });
      expect(outsideCanFocus).toBe(false);
    });

    test('While a modal dialog is open, scrolling over its backdrop or inside it does not scroll the page behind it', async ({
      page,
    }) => {
      const { dialog } = await openModalDialog(page);
      const styles = await dialog.evaluate((el) => {
        const dialogStyle = window.getComputedStyle(el);
        const backdropStyle = window.getComputedStyle(el, '::backdrop');
        return {
          dialogOverscroll: dialogStyle.overscrollBehavior,
          backdropOverscroll: backdropStyle.overscrollBehavior,
          backdropOverflow: backdropStyle.overflow,
        };
      });
      expect(styles.dialogOverscroll).toBe('contain');
      expect(styles.backdropOverscroll).toBe('contain');
      expect(styles.backdropOverflow).toBe('hidden');
    });
  });
});
