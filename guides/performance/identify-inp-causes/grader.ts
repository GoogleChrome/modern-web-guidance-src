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

test.describe('Identify causes of poor INP Expectations', () => {

  // Static Analysis Tests
  test('Uses web-vitals or similar RUM library', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // The guide specifically recommends web-vitals
    expect(html).toContain('web-vitals');
  });

  test('Uses onINP function to measure Interaction to Next Paint', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('onINP');
  });

  test('Uses the attribution module to get long animation frame data', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Using the attribution build is necessary for longestScript data
    expect(html).toContain('attribution');
  });

  test('Handles potentially empty longestScript.entry object', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Expect safe access to .entry (e.g. optional chaining or existence check)
    // specifically for the longestScript object.
    const hasSafeAccess = /longestScript\?\.(entry\?\.)/.test(html) ||
                          /longestScript\.entry\?\./.test(html) ||
                          /if\s*\([^)]*longestScript\.entry[^)]*\)/.test(html) ||
                          /longestScript\.entry\s*&&/.test(html) ||
                          /\.longestScript\s*&&.*\.entry\s*&&/.test(html);
    expect(hasSafeAccess).toBe(true);
  });

  test('Does not use the heavyweight JS Self-Profiling API (performance.profile)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // performance.profile is discouraged in the guide
    expect(html).not.toContain('performance.profile');
  });

  test('Does not re-implement INP logic manually using PerformanceObserver', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Manual implementation using 'event' or 'first-input' is discouraged
    const manualInp = /observe\(\{\s*type:\s*['"](event|first-input)['"]/;
    expect(html).not.toMatch(manualInp);
  });

  test('Collects script attribution data fields', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check if the code refers to script attribution fields from LoAF
    const attributionFields = ['invokerType', 'sourceURL', 'sourceFunctionName', 'subpart', 'intersectingDuration'];
    const hasField = attributionFields.some(field => html.includes(field));
    expect(hasField).toBe(true);
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const url = new URL(route.request().url());
      const requestPath = url.pathname;
      
      // Handle root path or specific file path
      let localFileName = (requestPath === '/' || requestPath === '') ? demoName : path.basename(requestPath);
      
      // If the path is exactly /demoName, use it
      if (requestPath === `/${demoName}`) {
        localFileName = demoName;
      }
      
      const localFilePath = path.join(targetDir, localFileName);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  // Browser assertions
  test('Reports INP data on user interaction', async ({ page }) => {
    let reportDetected = false;
    
    // Listen for console logs (used in demo.html)
    page.on('console', msg => {
      const text = msg.text().toUpperCase();
      if (text.includes('INP')) {
        reportDetected = true;
      }
    });

    // Listen for beacons/requests (recommended in guide)
    page.on('request', request => {
      const postData = request.postData() || '';
      if (postData.toUpperCase().includes('INP') || request.url().includes('analytics')) {
        reportDetected = true;
      }
    });

    // Trigger an interaction
    const button = page.locator('button, input[type="button"], #interact-button, #btn');
    await button.first().click();

    // Interaction to Next Paint might take a moment.
    // Wait for a bit for the library to process and report.
    for (let i = 0; i < 20; i++) {
        if (reportDetected) break;
        await page.waitForTimeout(100);
    }

    expect(reportDetected).toBe(true);
  });
});
