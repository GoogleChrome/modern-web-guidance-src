import {
  test,
  expect,
} from '../../../../../src/grading/test-fixture.ts';

test.describe('prevent-page-scroll-under-modal-dialog Target Grader', () => {
  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('The <dialog> element is opened as a modal using showModal() so that it renders in the top layer with a ::backdrop pseudo-element', async ({
      page,
    }) => {
      const modalCount = await page.locator('dialog').count();
      expect(modalCount).toBeGreaterThan(0);

      const modalState = await page.evaluate(() => {
        const dialog = document.querySelector('dialog');
        if (!dialog) return null;
        return {
          open: dialog.open,
          matchesModal: dialog.matches(':modal'),
        };
      });

      expect(modalState).not.toBeNull();
      expect(modalState?.open).toBe(true);
      expect(modalState?.matchesModal).toBe(true);
    });

    test('When open as a modal, the <dialog> element has a computed overscroll-behavior (overscroll-behavior-x and overscroll-behavior-y) of contain or none to prevent scroll chaining from the dialog to the underlying page', async ({
      page,
    }) => {
      const modalCount = await page.locator('dialog:modal').count();
      expect(modalCount).toBeGreaterThan(0);

      const overscroll = await page.$eval('dialog:modal', (el) => {
        const style = window.getComputedStyle(el);
        return {
          x: style.overscrollBehaviorX,
          y: style.overscrollBehaviorY,
        };
      });

      expect(['contain', 'none']).toContain(overscroll.x);
      expect(['contain', 'none']).toContain(overscroll.y);
    });

    test('When open as a modal, the <dialog> element is a scroll container (its computed overflow-x and overflow-y are auto, scroll, or hidden, and not visible or clip)', async ({
      page,
    }) => {
      const modalCount = await page.locator('dialog:modal').count();
      expect(modalCount).toBeGreaterThan(0);

      const overflow = await page.$eval('dialog:modal', (el) => {
        const style = window.getComputedStyle(el);
        return {
          x: style.overflowX,
          y: style.overflowY,
        };
      });

      expect(['auto', 'scroll', 'hidden']).toContain(overflow.x);
      expect(['auto', 'scroll', 'hidden']).toContain(overflow.y);
    });

    test('The dialog::backdrop pseudo-element establishes a scroll container by having a computed overflow (overflow-x and overflow-y) of hidden or auto, and not visible or clip', async ({
      page,
    }) => {
      const modalCount = await page.locator('dialog:modal').count();
      expect(modalCount).toBeGreaterThan(0);

      const backdropOverflow = await page.$eval('dialog:modal', (el) => {
        const style = window.getComputedStyle(el, '::backdrop');
        return {
          x: style.overflowX,
          y: style.overflowY,
        };
      });

      expect(['hidden', 'auto']).toContain(backdropOverflow.x);
      expect(['hidden', 'auto']).toContain(backdropOverflow.y);
    });

    test('The dialog::backdrop pseudo-element has a computed overscroll-behavior (overscroll-behavior-x and overscroll-behavior-y) of contain or none so scroll gestures over the backdrop do not chain to the underlying page', async ({
      page,
    }) => {
      const modalCount = await page.locator('dialog:modal').count();
      expect(modalCount).toBeGreaterThan(0);

      const backdropOverscroll = await page.$eval('dialog:modal', (el) => {
        const style = window.getComputedStyle(el, '::backdrop');
        return {
          x: style.overscrollBehaviorX,
          y: style.overscrollBehaviorY,
        };
      });

      expect(['contain', 'none']).toContain(backdropOverscroll.x);
      expect(['contain', 'none']).toContain(backdropOverscroll.y);
    });

    test('While the modal <dialog> is open, the <html> and <body> elements are not scroll-locked via overflow: hidden or position: fixed', async ({
      page,
    }) => {
      const modalCount = await page.locator('dialog:modal').count();
      expect(modalCount).toBeGreaterThan(0);

      const rootStyles = await page.evaluate(() => {
        const htmlStyle = window.getComputedStyle(document.documentElement);
        const bodyStyle = window.getComputedStyle(document.body);
        return {
          htmlOverflowX: htmlStyle.overflowX,
          htmlOverflowY: htmlStyle.overflowY,
          htmlPosition: htmlStyle.position,
          bodyOverflowX: bodyStyle.overflowX,
          bodyOverflowY: bodyStyle.overflowY,
          bodyPosition: bodyStyle.position,
        };
      });

      expect(rootStyles.htmlOverflowX).not.toBe('hidden');
      expect(rootStyles.htmlOverflowY).not.toBe('hidden');
      expect(rootStyles.htmlPosition).not.toBe('fixed');
      expect(rootStyles.bodyOverflowX).not.toBe('hidden');
      expect(rootStyles.bodyOverflowY).not.toBe('hidden');
      expect(rootStyles.bodyPosition).not.toBe('fixed');
    });
  });
});
