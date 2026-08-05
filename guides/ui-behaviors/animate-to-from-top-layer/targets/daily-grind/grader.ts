import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

// @ts-ignore
const targetFiles = getTargetFiles(import.meta.url);

test.describe('animate-to-from-top-layer Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('HTML structure includes a dialog element for top-layer rendering', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasDialog = docs.some((d) => Boolean(d.document.querySelector('dialog')));
    expect(hasDialog).toBe(true);
  });

  test('HTML structure includes a popover element for top-layer rendering', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasPopover = docs.some((d) => Boolean(d.document.querySelector('[popover]')));
    expect(hasPopover).toBe(true);
  });

  test('CSS styles include @starting-style at-rule for entry animations', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/@starting-style/i);
  });

  test('dialog CSS rules associate with @starting-style entry animation', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/dialog[^]*?@starting-style|@starting-style[^]*?dialog/i);
  });

  test('popover CSS rules associate with @starting-style entry animation', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/popover[^]*?@starting-style|@starting-style[^]*?popover/i);
  });

  test('CSS transition definitions include overlay property for top-layer transition', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/\boverlay\b/i);
  });

  test('CSS discrete transitions specify allow-discrete keyword', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/\ballow-discrete\b/i);
  });

  test('CSS transition definitions include display with allow-discrete behavior for top-layer elements', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(
      /transition(-property)?\s*:[^;]*\bdisplay\b|\bdisplay\b[^;]*\ballow-discrete\b|\ballow-discrete\b[^;]*\bdisplay\b/i
    );
  });

  test('dialog defines open state visual styles for smooth entry transition', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/dialog.*\[open\]/i);
  });

  test('popover defines open state visual styles for smooth entry transition', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/:popover-open/i);
  });

  test('base top-layer CSS rules define transition properties for smooth exit', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/transition(-property)?\s*:[^;]*(opacity|transform|display|overlay)/i);
  });

  test('dialog ::backdrop pseudo-element is configured for animation', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/::backdrop/i);
  });

  test('dialog ::backdrop pseudo-element defines transition properties', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/::backdrop[^}]*transition/i);
  });

  test('CSS includes prefers-reduced-motion media query to respect user motion preferences', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/prefers-reduced-motion\s*:\s*reduce/i);
  });

  test('prefers-reduced-motion simplifies or disables transforms or shortens transition duration', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/prefers-reduced-motion[^]*?(transform\s*:\s*none|transition-duration)/i);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('dialog can be opened into the top layer in runtime browser environment', async ({ page }) => {
      const isOpen = await page.evaluate(() => {
        const dialog = document.querySelector('dialog') as HTMLDialogElement | null;
        if (!dialog) return false;
        if (!dialog.open) {
          try {
            dialog.showModal();
          } catch (e) {}
        }
        return dialog.open;
      });
      expect(isOpen).toBe(true);
    });

    test('popover can be opened into the top layer in runtime browser environment', async ({ page }) => {
      const isPopoverOpen = await page.evaluate(() => {
        const popover = document.querySelector('[popover]') as HTMLElement | null;
        if (!popover) return false;
        if (!popover.matches(':popover-open')) {
          try {
            popover.showPopover();
          } catch (e) {}
        }
        return popover.matches(':popover-open');
      });
      expect(isPopoverOpen).toBe(true);
    });

    test('dialog can be closed from the top layer in runtime browser environment', async ({ page }) => {
      const isClosedAfterOpen = await page.evaluate(() => {
        const dialog = document.querySelector('dialog') as HTMLDialogElement | null;
        if (!dialog) return false;
        if (!dialog.open) {
          try {
            dialog.showModal();
          } catch (e) {}
        }
        if (!dialog.open) return false;
        try {
          dialog.close();
        } catch (e) {}
        return !dialog.open;
      });
      expect(isClosedAfterOpen).toBe(true);
    });
  });
});
