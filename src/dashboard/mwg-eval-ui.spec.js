import { test, expect } from '@playwright/test';

// The eval runner reads the real guides tree through /api/grouped-tasks and
// /api/available-skills. Stub both so the assertions are deterministic, and
// include markup-like names to prove directory-derived strings are escaped.
const EVIL = 'evil<img src=x onerror="window.__xss=1">';
const GROUPED = {
  guides: {
    forms: {
      switch: ['task', 'negative'],
      [EVIL]: ['task'],
    },
    layout: {
      grid: ['task'],
    },
  },
};
const SKILLS = { skills: ['other-skill', 'modern-web-guidance'] };

/** @param {import('@playwright/test').Page} page */
async function openRunner(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/api/grouped-tasks', (route) => route.fulfill({ json: GROUPED }));
  await page.route('**/api/available-skills', (route) => route.fulfill({ json: SKILLS }));
  await page.goto('/eval-ui.html');
  await expect(page.locator('.guide-row')).toHaveCount(3);
  return errors;
}

test.describe('Eval runner (MWG compliance)', () => {
  test('escapes directory names and loads without errors', async ({ page }) => {
    const errors = await openRunner(page);
    await expect(page.locator('.guide-name', { hasText: EVIL })).toBeVisible();
    await expect(page.locator('#tasks-table img')).toHaveCount(0);
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test('checkboxes have accessible names and a visible focus ring', async ({ page }) => {
    await openRunner(page);
    await expect(page.getByRole('checkbox', { name: 'Select all default tasks' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Select all negative tasks' })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'switch', exact: true })).toHaveCount(1);
    await expect(page.getByRole('checkbox', { name: 'switch: negative' })).toHaveCount(1);

    // Keyboard focus on a visually hidden task input must outline its pill.
    const taskInput = page.getByRole('checkbox', { name: 'switch: task' });
    await taskInput.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(taskInput).toBeFocused();
    const pillOutline = await taskInput.evaluate((el) => getComputedStyle(/** @type {Element} */ (el.closest('.pill-checkbox'))).outlineStyle);
    expect(pillOutline).toBe('solid');

    const rowCheck = page.getByRole('checkbox', { name: 'switch', exact: true });
    // `switch` has `task` checked and `negative` unchecked, so its row checkbox starts indeterminate.
    expect(await rowCheck.evaluate((el) => /** @type {HTMLInputElement} */ (el).indeterminate)).toBe(true);
    // `grid` only has `task` (checked), so its row checkbox starts checked and not indeterminate.
    const gridRowCheck = page.getByRole('checkbox', { name: 'grid', exact: true });
    await expect(gridRowCheck).toBeChecked();
    expect(await gridRowCheck.evaluate((el) => /** @type {HTMLInputElement} */ (el).indeterminate)).toBe(false);

    // Unchecking one default task sets the column header checkbox to indeterminate.
    await page.locator('.pill-checkbox', { has: taskInput }).click();
    const defaultHeaderCheck = page.getByRole('checkbox', { name: 'Select all default tasks' });
    expect(await defaultHeaderCheck.evaluate((el) => /** @type {HTMLInputElement} */ (el).indeterminate)).toBe(true);

    await rowCheck.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const markOutline = await rowCheck.evaluate((el) => getComputedStyle(/** @type {Element} */ (el.nextElementSibling)).outlineStyle);
    expect(markOutline).toBe('solid');

    // Clearing all tasks and submitting shows an accessible role="alert" message instead of window.alert.
    await page.locator('#action-clear-guides').click();
    await expect(page.locator('#form-error')).toBeHidden();
    await page.locator('#launch-btn').click();
    await expect(page.locator('#form-error')).toBeVisible();
    await expect(page.locator('#form-error')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#form-error')).toContainText('Please select at least one task to run.');
    // Checking any task clears the inline error automatically.
    await page.locator('.pill-checkbox', { has: taskInput }).click();
    await expect(page.locator('#form-error')).toBeHidden();
  });

  test('category collapse is a button that hides rows', async ({ page }) => {
    await openRunner(page);
    const toggle = page.getByRole('button', { name: 'forms' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.guide-row[data-category="forms"]').first()).toBeHidden();
    await expect(page.getByRole('checkbox', { name: 'switch: task' })).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('checkbox', { name: 'switch: task' })).toHaveCount(1);
  });

  test('agent radios and skill switches expose state and keep the launch payload', async ({ page }) => {
    await openRunner(page);
    /** @type {any} */
    let payload = null;
    await page.route('**/api/eval-launch', async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: { success: false, error: 'stubbed' } });
    });
    page.on('dialog', (d) => d.dismiss());

    await expect(page.getByRole('group', { name: 'Agent' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Antigravity CLI' })).toBeChecked();
    await page.getByText('Claude Code').click();
    await expect(page.getByRole('radio', { name: 'Claude Code' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Antigravity CLI' })).not.toBeChecked();

    await expect(page.getByRole('group', { name: 'Skills to Enable' })).toBeVisible();
    const mwg = page.getByRole('switch', { name: 'modern-web-guidance' }).or(page.getByRole('checkbox', { name: 'modern-web-guidance' }));
    await expect(mwg).toBeChecked();
    await page.getByText('other-skill').click();

    await page.locator('#launch-btn').click();
    await expect.poll(() => payload).not.toBeNull();
    expect(payload).toEqual({
      name: null,
      numRuns: 1,
      workerCount: null,
      agent: 'claude_code',
      tasks: ['switch/task', `${EVIL}/task`, 'grid/task'],
      skillsToEnable: ['modern-web-guidance', 'other-skill'],
    });
  });

  test('declares a dark color scheme and honors reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRunner(page);
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');
    await expect(page.locator('meta[name="text-scale"]')).toHaveAttribute('content', 'scale');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
    const shine = await page.locator('#launch-btn').evaluate((el) => getComputedStyle(el, '::before').display);
    expect(shine).toBe('none');
  });
});
