import { test, expect } from '@playwright/test';

test.describe('Eval View Dashboard', () => {
  test('should load the dashboard and show expected content', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page.locator('.landing-title')).toContainText('Guidance Evals');

    // Check suites content
    await expect(page.locator('.suite-table-row').first()).toBeVisible();
  });

  test('should load suites from API', async ({ page }) => {
    // Attempt to fetch /api/suites through the server
    const response = await page.request.get('/api/suites');
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty('suites');
  });


  test('should load specific test dashboard', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');

    // Check title
    await expect(page.locator('h1')).toContainText('Suite Results');

    // Check header info
    await expect(page.locator('#test-header')).toContainText('example-result');

    // Check grid exists and has content
    await expect(page.locator('#dashboard-grid')).toBeVisible();
    
    // Wait for actual cards to be rendered by JS
    const firstCard = page.locator('.test-card').first();
    await expect(firstCard).toBeVisible();
    
    const count = await page.locator('.test-card').count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show details and toggle diff view', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');

    // Wait for cards and click the first one
    const firstCard = page.locator('.test-card').first();
    await firstCard.click();

    // Verify modal is shown
    const modal = page.locator('#modal');
    await expect(modal).toBeVisible();

    // Verify dropdown exists and select "Diff"
    const dropdown = page.locator('.run-actions-dropdown').first();
    await expect(dropdown).toBeVisible();
    await dropdown.selectOption('diff');

    // Verify diff content is displayed
    // The title changes to "Diff: ..."
    await expect(page.locator('#modal-title')).toContainText('Diff:');
    
    // Check for diff-container and some expected diff classes
    const diffContainer = page.locator('.diff-container');
    await expect(diffContainer).toBeVisible();
    
    // Since we're using real data (example-result test), we should see some diff parts
    // We expect either added or unchanged lines
    const diffParts = page.locator('.diff-added, .diff-removed, .diff-unchanged');
    const partsCount = await diffParts.count();
    expect(partsCount).toBeGreaterThan(0);
  });

  test('should block access to hidden files', async ({ page }) => {
    const response = await page.request.get('/.gitignore');
    expect(response.status()).toBe(403);
  });

  test('should block directory traversal attempts', async () => {
    // Try to access a file that is definitely outside the project root
    const res = await fetch(`http://localhost:11432/../../../../../../../../../../etc/passwd`);
    // Both 403, 404, and 400 (if it hits remote fallbacks) are acceptable as they block access to the host system
    expect([400, 403, 404]).toContain(res.status);
  });
});