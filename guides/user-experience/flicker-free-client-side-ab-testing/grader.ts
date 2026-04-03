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

// Helper to identify non-visual scripts
const isNonVisualScript = (scriptTag: string) => {
  return /analytics|tracking|gtm|pixel|ads|facebook|google-tag-manager/i.test(scriptTag);
};

// Tests
test.describe(`Flicker-Free Client-Side A/B Testing: ${demoName}`, () => {

  test(`The experiment script is placed in the document <head>`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';
    const scriptsInHead = headContent.match(/<script[^>]*>/gi) || [];
    const hasExperimentScriptInHead = scriptsInHead.some(s => 
      /blocking=["']render["']/i.test(s) && !isNonVisualScript(s)
    );
    expect(hasExperimentScriptInHead).toBe(true);
  });

  test(`The experiment script has the blocking="render" attribute`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const scripts = html.match(/<script[^>]*>/gi) || [];
    const hasExperimentScriptWithBlocking = scripts.some(s => 
      /blocking=["']render["']/i.test(s) && !isNonVisualScript(s)
    );
    expect(hasExperimentScriptWithBlocking).toBe(true);
  });

  test(`The experiment script has either async or type="module" set`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const scriptsWithBlocking = html.match(/<script[^>]*blocking=["']render["'][^>]*>/gi) || [];
    const experimentScripts = scriptsWithBlocking.filter(s => !isNonVisualScript(s));
    const allHaveProperAttributes = experimentScripts.length > 0 && experimentScripts.every(s => 
      /async/i.test(s) || /type=["']module["']/i.test(s)
    );
    expect(allHaveProperAttributes).toBe(true);
  });

  test(`A fallback anti-flicker mechanism is included using feature detection`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasFeatureDetection = /Object\.hasOwn\(HTMLScriptElement\.prototype,\s*['"]blocking['"]\)/.test(html) ||
                                /['"]blocking['"]\s+in\s+HTMLScriptElement\.prototype/.test(html);
    expect(hasFeatureDetection).toBe(true);
  });

  test(`No anti-flicker snippet (unconditional opacity: 0 hack) is used`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasUnconditionalOpacity = /(body|html)\s*\{\s*opacity:\s*0/i.test(html);
    expect(hasUnconditionalOpacity).toBe(false);
  });

  test(`The fallback includes a safety timeout to prevent an indefinitely blank page`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check for setTimeout in a script that also mentions blocking or prototype (to ensure it's part of the fallback)
    const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
    const hasProperTimeout = scripts.some(s => 
      /(blocking|prototype)/i.test(s) && /setTimeout/i.test(s)
    );
    expect(hasProperTimeout).toBe(true);
  });

  test(`The blocking="render" attribute is NOT applied to non-visual scripts`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const scriptsWithBlocking = html.match(/<script[^>]*blocking=["']render["'][^>]*>/gi) || [];
    const hasNonVisualWithBlocking = scriptsWithBlocking.length > 0 && scriptsWithBlocking.some(s => isNonVisualScript(s));
    expect(hasNonVisualWithBlocking).toBe(false);
  });

  test(`Only scripts in the <head> use blocking="render"`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const scriptsWithBlocking = html.match(/<script[^>]*blocking=["']render["'][^>]*>/gi) || [];
    const experimentScripts = scriptsWithBlocking.filter(s => !isNonVisualScript(s));
    const headEndIndex = html.toLowerCase().indexOf('</head>');
    const bodyContent = headEndIndex !== -1 ? html.substring(headEndIndex) : '';
    const hasBlockingInBody = /<script[^>]*blocking=["']render["']/i.test(bodyContent);
    expect(experimentScripts.length > 0 && !hasBlockingInBody).toBe(true);
  });

  // Browser testing setup
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  });

  test(`The variant styling is applied correctly and quickly`, async ({ page }) => {
    await page.goto(demoUrl, { waitUntil: 'domcontentloaded' });
    const isVariantApplied = await page.evaluate(() => {
      const hasDataVariant = !!document.documentElement.dataset.variant;
      const hasVariantClass = Array.from(document.querySelectorAll('*')).some(el => 
        Array.from(el.classList).some(cls => cls.toLowerCase().includes('variant'))
      );
      return hasDataVariant || hasVariantClass;
    });
    expect(isVariantApplied).toBe(true);
  });

  test(`The page does not remain hidden by anti-flicker hacks after load`, async ({ page }) => {
    await page.goto(demoUrl);
    const opacity = await page.evaluate(() => window.getComputedStyle(document.body).opacity);
    expect(opacity).toBe('1');
  });

});
