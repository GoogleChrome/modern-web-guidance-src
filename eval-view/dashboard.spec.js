import { test, expect } from '@playwright/test';

test.describe('Eval View Dashboard', () => {
  test('should load the dashboard and show expected content', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page.locator('.landing-title')).toContainText('Modern Web Guidance Evals');

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
  
  test('should show dumbbell chart tooltip on rate-cell hover', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForSelector('.uplift-cell');
    await page.locator('.uplift-cell').first().hover();
    
    const tooltip = page.locator('.tooltip-container');
    await expect(tooltip).toBeVisible();
    
    const svg = page.locator('#tooltip-chart svg');
    await expect(svg).toBeVisible();
  });


  test('should load specific test dashboard', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');

    // Check title
    await expect(page).toHaveTitle('Suite Results');

    // Check header info
    await expect(page.locator('#test-header')).toContainText('example-result');

    // Check grid exists and has content
    await expect(page.locator('#guide-grid')).toBeVisible();
    
    // Wait for actual accordions to be rendered by JS
    const firstAccordion = page.locator('.task-accordion-header').first();
    await expect(firstAccordion).toBeVisible();
    
    const count = await page.locator('.task-accordion-header').count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show details and toggle diff view', async ({ page }) => {
    await page.goto('/dashboard.html?testId=example-result');

    // Wait for accordions and click the first one
    const firstAccordion = page.locator('.task-accordion-header').first();
    await firstAccordion.click();

    // Verify Diff button exists and click it to open modal
    const diffButton = page.locator('.tfoot-action-btn', { hasText: 'Diff' }).first();
    await expect(diffButton).toBeVisible();
    await diffButton.click();

    // Verify modal is shown
    const modal = page.locator('#modal');
    await expect(modal).toBeVisible();

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