import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../../../src/grading/test-fixture.ts';

const TABLE = '#seasonal-drinks';
const SORT_BUTTONS = `${TABLE} thead th button`;

/** The column name a header button exposes: its text minus aria-hidden decoration. */
function columnName(button: Locator): Promise<string> {
  return button.evaluate((btn) => {
    const clone = btn.cloneNode(true) as HTMLElement;
    for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
    return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}

/**
 * Checks the current DOM row order against the clicked column, the way a user would read it:
 * numbers (optionally formatted, e.g. "$4.50", "12,104", "190 cal") compare numerically, text
 * compares with a base-sensitivity collator. Ties may land in any order.
 */
function columnSortState(button: Locator, direction: 'ascending' | 'descending') {
  return button.evaluate((btn, dir) => {
    const th = btn.closest('th');
    const tbody = btn.closest('table')?.tBodies[0];
    if (!th || !tbody) return { sorted: false, numeric: false };
    const values = [...tbody.rows].map((row) => {
      const cell = row.cells[th.cellIndex];
      if (!cell) return '';
      const time = cell.querySelector('time[datetime]');
      return (cell.dataset.value ?? time?.getAttribute('datetime') ?? cell.textContent ?? '').trim();
    });
    const numeric = values.length > 0 && values.every((v) => /^[^\d\p{L}]{0,2}-?\d[\d,]*(\.\d+)?\s*[\p{L}%]{0,8}$/u.test(v));
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const compare = (a: string, b: string) =>
      numeric ? Number(a.replace(/[^\d.-]/g, '')) - Number(b.replace(/[^\d.-]/g, '')) : collator.compare(a, b);
    const factor = dir === 'ascending' ? 1 : -1;
    const sorted = values.every((v, i) => i === 0 || factor * compare(values[i - 1], v) <= 0);
    return { sorted, numeric };
  }, direction);
}

async function expectSorted(button: Locator, direction: 'ascending' | 'descending') {
  await expect.poll(async () => (await columnSortState(button, direction)).sorted).toBe(true);
}

/** Records the current tbody and rows by identity so later checks can detect rebuilds or clones. */
async function snapshotRows(page: Page) {
  const count = await page.evaluate((sel) => {
    const tbody = document.querySelector(`${sel} tbody`);
    const w = window as any;
    w.__gradeTbody = tbody;
    w.__gradeRows = tbody ? [...tbody.querySelectorAll(':scope > tr')] : [];
    return w.__gradeRows.length;
  }, TABLE);
  expect(count).toBeGreaterThan(1);
}

/** Current rows as indexes into the snapshot; -1 marks a row that was not in the snapshot. */
function rowIdentity(page: Page) {
  return page.evaluate((sel) => {
    const w = window as any;
    const tbody = document.querySelector(`${sel} tbody`);
    return {
      sameTbody: tbody === w.__gradeTbody,
      order: tbody ? [...tbody.querySelectorAll(':scope > tr')].map((row) => w.__gradeRows.indexOf(row)) : [],
    };
  }, TABLE);
}

test.describe('sortable-table Target Grader', () => {
  test.beforeEach(async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await expect(page.locator(SORT_BUTTONS).first()).toBeAttached();
  });

  test('Each sortable column header is a <th scope="col"> containing a <button type="button"> whose text is the column name', async ({ page }) => {
    const buttons = page.locator(SORT_BUTTONS);
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      await expect(button.locator('xpath=ancestor::th[1]')).toHaveAttribute('scope', 'col');
      await expect(button).toHaveAttribute('type', 'button');

      const name = await columnName(button);
      expect(name).not.toBe('');
      expect(name).not.toMatch(/\bsort/i);

      // The label stays the column name after sorting.
      await button.click();
      await expect(button.locator('xpath=ancestor::th[1]')).toHaveAttribute('aria-sort', /^(ascending|descending)$/);
      expect(await columnName(button)).toBe(name);
    }
  });

  test('Activating a sortable header\'s button sets aria-sort="ascending" on its <th>, and activating it again sets aria-sort="descending"', async ({ page }) => {
    const button = page.locator(SORT_BUTTONS).first();
    const th = button.locator('xpath=ancestor::th[1]');

    await button.click();
    await expect(th).toHaveAttribute('aria-sort', 'ascending');
    await button.click();
    await expect(th).toHaveAttribute('aria-sort', 'descending');
  });

  test('At most one <th> has an aria-sort attribute at any time, and no <button> has aria-sort', async ({ page }) => {
    const buttons = page.locator(SORT_BUTTONS);
    const sortedHeaders = page.locator(`${TABLE} th[aria-sort]`);
    const buttonsWithAriaSort = page.locator(`${TABLE} button[aria-sort]`);
    const count = await buttons.count();

    expect(await sortedHeaders.count()).toBeLessThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      await button.click();
      await expect(button.locator('xpath=ancestor::th[1]')).toHaveAttribute('aria-sort', 'ascending');
      await expect(sortedHeaders).toHaveCount(1);
      await expect(buttonsWithAriaSort).toHaveCount(0);
    }
  });

  test('After sorting, a reference to a <tr> element taken before sorting is still attached to the <tbody>, and the <tbody> is the same node', async ({ page }) => {
    const button = page.locator(SORT_BUTTONS).first();
    await snapshotRows(page);

    await button.click();
    await expectSorted(button, 'ascending');

    const { sameTbody, order } = await rowIdentity(page);
    expect(sameTbody).toBe(true);
    expect(order).not.toContain(-1);
  });

  test('Rows are sorted into the correct order for the activated column, with numeric columns compared as numbers', async ({ page }) => {
    await expect(page.locator(`${TABLE} tbody tr`)).toHaveCount(3);

    const buttons = page.locator(SORT_BUTTONS);
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      await button.click();
      await expectSorted(button, 'ascending');
      await button.click();
      await expectSorted(button, 'descending');
    }
  });

  test('A role="status" element present in the DOM before sorting receives a message naming the column and direction after each sort', async ({ page }) => {
    const button = page.locator(SORT_BUTTONS).first();
    const name = (await columnName(button)).toLowerCase();

    const existing = await page.evaluate(() => {
      const statuses = [...document.querySelectorAll('[role="status"], output')];
      (window as any).__gradeStatuses = statuses;
      return statuses.length;
    });
    expect(existing).toBeGreaterThan(0);
    const statusText = () =>
      page.evaluate(() => ((window as any).__gradeStatuses as Element[]).map((s) => s.textContent ?? '').join(' | ').toLowerCase());

    await button.click();
    await expect.poll(statusText).toContain(name);
    await expect.poll(statusText).toContain('ascending');

    await button.click();
    await expect.poll(statusText).toContain('descending');
    expect(await statusText()).toContain(name);
  });

  test('The <table> and its ancestors have no aria-live attribute', async ({ page }) => {
    const button = page.locator(SORT_BUTTONS).first();
    await button.click();
    await expectSorted(button, 'ascending');

    const liveAncestors = await page.evaluate((sel) => {
      const found: string[] = [];
      for (let el = document.querySelector(sel); el; el = el.parentElement) {
        if (el.hasAttribute('aria-live')) found.push(el.tagName);
      }
      return found;
    }, TABLE);
    expect(liveAncestors).toEqual([]);
  });

  test('Focus remains on the activated header button after sorting', async ({ page }) => {
    const button = page.locator(SORT_BUTTONS).first();
    await button.focus();
    await page.keyboard.press('Enter');
    await expectSorted(button, 'ascending');
    await expect(button).toBeFocused();

    await button.click();
    await expectSorted(button, 'descending');
    await expect(button).toBeFocused();
  });

  test('The sort icon inside each header button has aria-hidden="true"', async ({ page }) => {
    const buttons = page.locator(SORT_BUTTONS);
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const icons = await buttons.nth(i).evaluate((btn) => {
        const hidden = [...btn.querySelectorAll('[aria-hidden="true"]')];
        const graphics = [...btn.querySelectorAll('svg, img, [class*="icon" i], [class*="arrow" i]')];
        return {
          hiddenCount: hidden.length,
          exposedGraphics: graphics.filter((g) => !hidden.some((h) => h.contains(g))).length,
        };
      });
      expect(icons.hiddenCount).toBeGreaterThan(0);
      expect(icons.exposedGraphics).toBe(0);
    }
  });

  test('The sort buttons use commandfor referencing the table\'s id with a command value starting with --, and a command event listener handles sorting', async ({ page }) => {
    const buttons = page.locator(SORT_BUTTONS);
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const wiring = await buttons.nth(i).evaluate((btn) => ({
        targetsTable: btn.getAttribute('commandfor') === btn.closest('table')?.id && btn.closest('table')?.id !== '',
        command: btn.getAttribute('command') ?? '',
      }));
      expect(wiring.targetsTable).toBe(true);
      expect(wiring.command).toMatch(/^--/);
    }

    // A `command` event dispatched on the table, with no click, must sort. This proves the
    // table has a command listener rather than per-button click handlers.
    const button = buttons.first();
    await button.evaluate((btn) => {
      const table = btn.closest('table');
      const CommandEventCtor = (window as any).CommandEvent;
      table?.dispatchEvent(new CommandEventCtor('command', { command: btn.getAttribute('command'), source: btn }));
    });
    await expect(button.locator('xpath=ancestor::th[1]')).toHaveAttribute('aria-sort', 'ascending');
    await expectSorted(button, 'ascending');
  });

  test('Sorting reorders the existing <tr> nodes in the <tbody>; rows are not recreated or cloned', async ({ page }) => {
    const button = page.locator(SORT_BUTTONS).first();
    await snapshotRows(page);

    await button.click();
    await expectSorted(button, 'ascending');
    const ascending = await rowIdentity(page);

    await button.click();
    await expectSorted(button, 'descending');
    const descending = await rowIdentity(page);

    for (const { sameTbody, order } of [ascending, descending]) {
      expect(sameTbody).toBe(true);
      expect(order).not.toContain(-1);
      expect([...order].sort((a, b) => a - b)).toEqual(order.map((_, i) => i));
    }
    // Ascending and descending must differ, so the existing rows really moved.
    expect(descending.order).not.toEqual(ascending.order);
  });
});
