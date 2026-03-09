import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

// Tests
test.describe(`Optimize Script Priority Expectations: ${demoName}`, () => {
  
  // Functional/Static assertions
  test('The script at /js/app.js has both the async and fetchpriority="high" attributes', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Using regex to check for the script tag and its attributes
    // This allows for different attribute orders and whitespace
    // We check for the presence of both attributes in the same script tag
    const appScriptWithAttributesRegex = /<script\b[^>]*src=["']\/js\/app\.js["'][^>]*\basync\b[^>]*\bfetchpriority=["']high["'][^>]*>|<script\b[^>]*src=["']\/js\/app\.js["'][^>]*\bfetchpriority=["']high["'][^>]*\basync\b[^>]*>/i;
    
    expect(html).toMatch(appScriptWithAttributesRegex);
  });

  test('The script at /js/legacy-widgets.js has the fetchpriority="low" attribute', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const legacyScriptWithLowPriorityRegex = /<script\b[^>]*src=["']\/js\/legacy-widgets\.js["'][^>]*\bfetchpriority=["']low["'][^>]*>/i;
    
    expect(html).toMatch(legacyScriptWithLowPriorityRegex);
  });

  test('No <script> elements have the deprecated importance attribute', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check for "importance" attribute within any <script> tag
    const importanceRegex = /<script\b[^>]*\bimportance\b/i;
    expect(html).not.toMatch(importanceRegex);
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestPath = requestUrl.pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' || requestPath === `/${demoName}` ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        // Fallback for missing resources (like the js files which don't actually exist)
        await route.fulfill({ status: 200, contentType: 'text/javascript', body: '// dummy script' });
      }
    });

    await page.goto(demoUrl);
  });

  // Browser assertions
  test('No more than two <script> elements total on the page have the fetchpriority="high" attribute', async ({ page }) => {
    const highPriorityScripts = page.locator('script[fetchpriority="high"]');
    const count = await highPriorityScripts.count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test('The script at /js/tracker.js does NOT have the fetchpriority="high" attribute', async ({ page }) => {
    const trackerScript = page.locator('script[src*="/js/tracker.js"][fetchpriority="high"]');
    await expect(trackerScript).toHaveCount(0);
  });
});
