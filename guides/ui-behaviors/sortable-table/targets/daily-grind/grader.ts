import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('sortable-table Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The <table> and its ancestors have no aria-live attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const table = docs.map((d) => d.document.querySelector('#seasonal-drinks, table')).find(Boolean);
    expect(table).not.toBeUndefined();

    let current: any = table;
    while (current) {
      if (typeof current.getAttribute === 'function') {
        expect(current.getAttribute('aria-live')).toBeNull();
      }
      current = current.parentElement;
    }
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Each sortable column header is a <th scope="col"> containing a <button type="button"> whose text is the column name', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const sortableHeaders = table.locator('thead th:has(button)');
      const count = await sortableHeaders.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const th = sortableHeaders.nth(i);
        await expect(th).toHaveAttribute('scope', 'col');

        const button = th.locator('button');
        await expect(button).toHaveAttribute('type', 'button');

        const buttonText = (await button.innerText()).trim();
        expect(buttonText.length).toBeGreaterThan(0);
        expect(buttonText.toLowerCase()).not.toContain('sort ascending');
        expect(buttonText.toLowerCase()).not.toContain('sort descending');
      }
    });

    test('Activating a sortable header\'s button sets aria-sort="ascending" on its <th>, and activating it again sets aria-sort="descending"', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const th = table.locator('thead th:has(button)').first();
      await expect(th).toBeAttached();

      const button = th.locator('button');
      await expect(button).toBeAttached();

      await button.click();
      await page.waitForTimeout(50);
      await expect(th).toHaveAttribute('aria-sort', 'ascending');

      await button.click();
      await page.waitForTimeout(50);
      await expect(th).toHaveAttribute('aria-sort', 'descending');
    });

    test('At most one <th> has an aria-sort attribute at any time, and no <button> has aria-sort', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const sortableButtons = table.locator('thead th button');
      const count = await sortableButtons.count();
      expect(count).toBeGreaterThan(1);

      const thWithAriaSort = table.locator('thead th[aria-sort]');
      const buttonWithAriaSort = table.locator('thead th button[aria-sort]');

      expect(await thWithAriaSort.count()).toBeLessThanOrEqual(1);
      expect(await buttonWithAriaSort.count()).toBe(0);

      await sortableButtons.nth(0).click();
      await page.waitForTimeout(50);
      expect(await thWithAriaSort.count()).toBe(1);
      expect(await buttonWithAriaSort.count()).toBe(0);

      await sortableButtons.nth(1).click();
      await page.waitForTimeout(50);
      expect(await thWithAriaSort.count()).toBe(1);
      expect(await buttonWithAriaSort.count()).toBe(0);
    });

    test('After sorting, a reference to a <tr> element taken before sorting is still attached to the <tbody>, and the <tbody> is the same node', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const button = table.locator('thead th button').first();
      await expect(button).toBeAttached();

      const ready = await page.evaluate(() => {
        const tableEl = document.getElementById('seasonal-drinks');
        const tbody = tableEl?.querySelector('tbody');
        if (!tbody || tbody.rows.length === 0) return false;
        (window as any).__testTbodyBefore = tbody;
        (window as any).__testTrBefore = tbody.rows[0];
        return true;
      });
      expect(ready).toBe(true);

      await button.click();
      await page.waitForTimeout(50);

      const check = await page.evaluate(() => {
        const tbodyBefore = (window as any).__testTbodyBefore;
        const trBefore = (window as any).__testTrBefore;
        const tbodyAfter = document.querySelector('#seasonal-drinks tbody');
        return {
          sameTbody: tbodyBefore !== null && tbodyBefore === tbodyAfter,
          trStillAttached: trBefore !== null && trBefore.parentElement === tbodyAfter,
        };
      });

      expect(check.sameTbody).toBe(true);
      expect(check.trStillAttached).toBe(true);
    });

    test('Rows are sorted into the correct order for the activated column, with numeric columns compared as numbers', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const buttons = table.locator('thead th button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThan(0);

      await buttons.first().click();
      await page.waitForTimeout(50);

      const rows = table.locator('tbody tr');
      expect(await rows.count()).toBe(3);

      const firstDrinkText = await rows.nth(0).innerText();
      const lastDrinkText = await rows.nth(2).innerText();
      expect(firstDrinkText).toContain('Cold Brew');
      expect(lastDrinkText).toContain('Maple Oat Latte');

      const project = getJsProject(targetFiles);
      const sourceFiles = project.getSourceFiles();
      expect(sourceFiles.length).toBeGreaterThan(0);

      const hasNumericComparison = sourceFiles.some((sf) => {
        const text = sf.getText();
        return (
          /type\s*===?\s*['"]number['"]/.test(text) &&
          /(Number\(|parseFloat\(|\b[a-zA-Z0-9_.]+\s*-\s*[a-zA-Z0-9_.]+)/.test(text)
        );
      });
      expect(hasNumericComparison).toBe(true);
    });

    test('A role="status" element present in the DOM before sorting receives a message naming the column and direction after each sort', async ({ page }) => {
      const status = page.locator('[role="status"]');
      await expect(status).toBeAttached();

      const button = page.locator('#seasonal-drinks thead th button').first();
      await expect(button).toBeAttached();

      await button.click();
      await page.waitForTimeout(50);

      const msg1 = (await status.textContent()) || '';
      expect(msg1.toLowerCase()).toContain('ascending');
      expect(msg1.toLowerCase()).toContain('drink');

      await button.click();
      await page.waitForTimeout(50);

      const msg2 = (await status.textContent()) || '';
      expect(msg2.toLowerCase()).toContain('descending');
      expect(msg2.toLowerCase()).toContain('drink');
    });

    test('Focus remains on the activated header button after sorting', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const button = table.locator('thead th button').first();
      await expect(button).toBeAttached();

      await button.focus();
      await button.click();
      await page.waitForTimeout(50);

      const isFocused = await button.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBe(true);
    });

    test('The sort icon inside each header button has aria-hidden="true"', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const buttons = table.locator('thead th button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const icon = button.locator('svg, [class*="icon"], img').first();
        await expect(icon).toBeAttached();
        await expect(icon).toHaveAttribute('aria-hidden', 'true');
      }
    });

    test('The sort buttons use commandfor referencing the table\'s id with a command value starting with --, and a command event listener handles sorting', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const tableId = await table.getAttribute('id');
      expect(tableId).toBeTruthy();

      const buttons = table.locator('thead th button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThan(0);

      for (let i = 0; i < buttonCount; i++) {
        const btn = buttons.nth(i);
        await expect(btn).toHaveAttribute('commandfor', tableId!);
        const command = await btn.getAttribute('command');
        expect(command).toMatch(/^--/);
      }

      const project = getJsProject(targetFiles);
      const sourceFiles = project.getSourceFiles();
      expect(sourceFiles.length).toBeGreaterThan(0);

      const hasCommandListener = sourceFiles.some((sf) => {
        return sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
          const exprText = call.getExpression().getText();
          if (!exprText.endsWith('addEventListener')) return false;
          const args = call.getArguments();
          if (args.length === 0) return false;
          const eventName = args[0].getText().replace(/['"]/g, '');
          return eventName === 'command';
        });
      });

      expect(hasCommandListener).toBe(true);
    });

    test('Sorting reorders the existing <tr> nodes in the <tbody>; rows are not recreated or cloned', async ({ page }) => {
      const table = page.locator('#seasonal-drinks');
      await expect(table).toBeAttached();

      const button = table.locator('thead th button').first();
      await expect(button).toBeAttached();

      const ready = await page.evaluate(() => {
        const tableEl = document.getElementById('seasonal-drinks');
        const tbody = tableEl?.querySelector('tbody');
        if (!tbody || tbody.rows.length < 2) return false;
        (window as any).__testRowsBefore = Array.from(tbody.querySelectorAll('tr'));
        return true;
      });
      expect(ready).toBe(true);

      await button.click();
      await page.waitForTimeout(50);

      const result = await page.evaluate(() => {
        const rowsBefore: HTMLTableRowElement[] = (window as any).__testRowsBefore || [];
        const tableEl = document.getElementById('seasonal-drinks');
        const tbody = tableEl?.querySelector('tbody');
        const rowsAfter = Array.from(tbody?.querySelectorAll('tr') || []);

        const sameNodeInstances =
          rowsBefore.length > 0 &&
          rowsBefore.length === rowsAfter.length &&
          rowsBefore.every((row) => rowsAfter.includes(row)) &&
          rowsAfter.every((row) => rowsBefore.includes(row));

        const orderChanged = rowsBefore.some((row, i) => row !== rowsAfter[i]);

        return {
          sameNodeInstances,
          orderChanged,
        };
      });

      expect(result.sameNodeInstances).toBe(true);
      expect(result.orderChanged).toBe(true);
    });
  });
});
