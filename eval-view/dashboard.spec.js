import { test, expect } from '@playwright/test';

test.describe('Eval View Dashboard', () => {
  test('should load the dashboard and show expected content', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page.locator('.landing-title')).toContainText('Results');

    // Check tabs exist
    await expect(page.locator('.tab-button[data-tab="overview"]')).toBeVisible();
    await expect(page.locator('.tab-button[data-tab="explorer"]')).toBeVisible();
    await expect(page.locator('.tab-button[data-tab="trends"]')).toBeVisible();

    // Check overview content
    await expect(page.locator('#latest-guided-metric')).toBeVisible();
    await expect(page.locator('#latest-unguided-metric')).toBeVisible();
  });

  test('should load results from harness directory', async ({ page }) => {
    // Attempt to fetch results/tests.json through the server
    const response = await page.request.get('/results/tests.json');
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty('tests');
  });

  test('should navigate to explorer tab', async ({ page }) => {
    await page.goto('/');
    // Wait for data to be loaded (overview cards appear)
    await expect(page.locator('#latest-guided-metric')).not.toContainText('-');
    
    await page.click('.tab-button[data-tab="explorer"]');
    
    await expect(page.locator('#explorer-tab')).toHaveClass(/active/);
    await expect(page.locator('.explorer-sidebar')).toBeVisible();
  });

  test('should load specific test dashboard', async ({ page }) => {
    await page.goto('/dashboard.html?testID=react');

    // Check title
    await expect(page.locator('h1')).toContainText('Eval Dashboard');

    // Check header info
    await expect(page.locator('#test-header')).toContainText('react');

    // Check grid exists and has content
    await expect(page.locator('#dashboard-grid')).toBeVisible();
    
    // Wait for actual cards to be rendered by JS
    const firstCard = page.locator('.test-card').first();
    await expect(firstCard).toBeVisible();
    
    const count = await page.locator('.test-card').count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show details and toggle diff view', async ({ page }) => {
    await page.goto('/dashboard.html?testID=react');

    // Wait for cards and click the first one
    const firstCard = page.locator('.test-card').first();
    await firstCard.click();

    // Verify modal is shown
    const modal = page.locator('#modal');
    await expect(modal).toBeVisible();

    // Verify "View Diff" button exists and click it
    const diffButton = page.locator('button:has-text("View Diff")').first();
    await expect(diffButton).toBeVisible();
    await diffButton.click();

    // Verify diff content is displayed
    // The title changes to "Diff: ..."
    await expect(page.locator('#modal-title')).toContainText('Diff:');
    
    // Check for diff-container and some expected diff classes
    const diffContainer = page.locator('.diff-container');
    await expect(diffContainer).toBeVisible();
    
    // Since we're using real data (react test), we should see some diff parts
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
    // Both 403 and 404 are acceptable as they block access to the host system
    expect([403, 404]).toContain(res.status);
  });
});