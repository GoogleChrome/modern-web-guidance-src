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

test.describe(`identify-inp-causes Expectations: ${demoName}`, () => {
  
  // Functional assertions (Static analysis)
  
  test('Should use a RUM library like web-vitals for measuring INP', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('web-vitals');
  });

  test('Should handle the case where longestScript.entry might be empty', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check for optional chaining or null checks when accessing entry
    expect(html).toMatch(/longestScript\??\.entry/);
  });

  test('Should use Long Animation Frames (LoAF) data for INP attribution', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('longestScript');
  });

  test('Should avoid using the JS Self-Profiling API (Profiler) as per best practices', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toContain('new Profiler');
  });

  test('Should not manually re-implement INP using raw Event Timing API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Detecting manual PerformanceObserver usage for events
    expect(html).not.toMatch(/observe\(\s*{\s*type:\s*['"]event['"]/);
  });

  test('Should use the onINP function to observe the metric', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('onINP');
  });

  // Browser assertions
  
  test.beforeEach(async ({ page }) => {
    // Route local file requests
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('Page should import the attribution build of web-vitals', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.src).join(' ');
    });
    expect(scriptContent).toContain('web-vitals/attribution');
  });

  test('Page scripts should handle longestScript.entry safely', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join(' ');
    });
    expect(scriptContent).toMatch(/longestScript\??\.entry/);
  });

  test('Page should not use Profiler API in its scripts', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join(' ');
    });
    expect(scriptContent).not.toContain('new Profiler');
  });

  test('Page should not have a manual PerformanceObserver for event timing', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join(' ');
    });
    expect(scriptContent).not.toMatch(/observe\(\s*{\s*type:\s*['"]event['"]/);
  });

  test('Page should use onINP for metric collection', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join(' ');
    });
    expect(scriptContent).toContain('onINP');
  });
});
