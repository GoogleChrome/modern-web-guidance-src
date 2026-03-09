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

test.describe(`Search Hidden Content Expectations: ${demoName}`, () => {
  
  // 1. Content intended to be visually hidden but searchable MUST use <details> or hidden="until-found"
  test('Searchable hidden content must use <details> or hidden="until-found"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Negative demo uses a class ".content" with "display: none" for most items.
    const usesLegacyHiddenClass = html.includes('.content {') && html.includes('display: none');
    expect(usesLegacyHiddenClass, 'Should not use legacy display: none for searchable content').toBe(false);
  });

  // 2. Elements utilizing hidden="until-found" MUST NOT have display: none or visibility: hidden
  test('Elements with hidden="until-found" must not have display: none or visibility: hidden', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Look for hidden="until-found" coupled with display: none or visibility: hidden in style attribute
    const hasInlineDisplayNone = /hidden=["']until-found["'][^>]*style=["'][^"']*(display:\s*none|visibility:\s*hidden)/.test(html);
    // Or in CSS (negative-demo has .content { display: none } and item 3 has class="content")
    const hasClassDisplayNone = html.includes('hidden="until-found"') && html.includes('class="content"') && html.includes('.content {') && html.includes('display: none');
    
    expect(hasInlineDisplayNone || hasClassDisplayNone, 'hidden="until-found" elements must not have display: none or visibility: hidden').toBe(false);
  });

  // 3. hidden="until-found" MUST NOT be used for sensitive info
  test('hidden="until-found" must not hide sensitive information', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasSensitiveInfo = /hidden=["']until-found["']/.test(html) && 
                            /(token|secret|confidential|AX-992)/i.test(html);
    
    expect(hasSensitiveInfo, 'Sensitive info found in hidden="until-found" content').toBe(false);
  });

  // 4. State MUST be synchronized using a beforematch event listener
  test('State must be synchronized using a beforematch event listener', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasBeforeMatchListener = html.includes('beforematch') || html.includes('onbeforematch');
    
    expect(hasBeforeMatchListener, 'Missing beforematch event listener for UI synchronization').toBe(true);
  });

  // 5. Fallback strategy MUST include explicit JS feature detection
  test('Implementation must include explicit fallback strategy with feature detection', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasFeatureDetection = html.includes('onbeforematch') && html.includes('in HTMLElement.prototype');
    
    expect(hasFeatureDetection, 'Missing fallback strategy or explicit feature detection').toBe(true);
  });

  // Setup browser testing
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

    await page.goto(demoUrl);
  });

  // 6. Browser check: ensure all hidden content uses the correct searchable mechanism
  test('All visually hidden content must use searchable attributes', async ({ page }) => {
    const hiddenIncorrectly = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.content, .accordion-pane'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        const isHidden = style.display === 'none' || style.visibility === 'hidden';
        const hasProperAttribute = (el.getAttribute('hidden') === 'until-found') || el.closest('details');
        
        // If it is hidden but doesn't have the proper attribute, it's a failure.
        // HOWEVER, even if it has hidden="until-found", if it ALSO has display: none in CSS, 
        // it breaks searchability.
        // UA style for hidden=until-found is display:none !important in some browsers, 
        // but it's searchable. 
        // If the developer ADDS display: none, it might override the searchable behavior.
        
        // In negative-demo, item 1 and 2 are hidden via CSS class .content { display: none }
        // and they don't have hidden="until-found".
        return isHidden && !hasProperAttribute;
      });
    });
    
    // Also check if ANY element has sensitive info and is hidden="until-found"
    // (This is a repeat of static test but in browser)
    const hasSensitiveInBrowser = await page.evaluate(() => {
       const el = document.querySelector('[hidden="until-found"]');
       return el && /(token|secret|confidential)/i.test(el.textContent || '');
    });

    expect(hiddenIncorrectly || hasSensitiveInBrowser, 'Hidden content must be searchable and not sensitive').toBe(false);
  });

});

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

test.describe(`search-hidden-content Expectations: ${demoName}`, () => {

  // 1. Any content intended to be visually hidden but remain searchable MUST use <details> or the hidden="until-found" attribute.
  test('Searchable content should not use legacy display: none for hiding main content', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // In negative-demo, .content { display: none; } is used. 
    // We check if "display: none" is used in CSS without any use of <details> or hidden="until-found" for the main sections.
    // Specifically, negative-demo hides ".content".
    const usesLegacyHiding = /display:\s*none/.test(html) && !/<details/i.test(html) && !/hidden="until-found"/i.test(html);
    // In demo.html, it uses hidden="until-found", so usesLegacyHiding will be false (it has the attribute).
    // In negative-demo.html, it uses display: none and HAS one instance of hidden="until-found" (the token).
    // Wait, the token has hidden="until-found" in negative-demo. 
    // Let's be more specific: does it use display: none for elements that SHOULD be searchable?
    // In negative-demo, the .content class is used for documentation.
    const hasLegacyContentClass = /\.content\s*\{[^}]*display:\s*none/.test(html);
    expect(hasLegacyContentClass).toBe(false);
  });

  // 2. Elements utilizing the hidden="until-found" attribute MUST NOT have display: none, visibility: hidden, etc.
  test('Elements with hidden="until-found" must not have display: none applied directly', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const illegalStyle = /hidden="until-found"[^>]*style="[^"]*display:\s*none/i.test(html) || 
                         /style="[^"]*display:\s*none"[^>]*hidden="until-found"/i.test(html);
    expect(illegalStyle).toBe(false);
  });

  // 3. The hidden="until-found" attribute MUST NOT be used to hide sensitive information.
  test('hidden="until-found" must not contain sensitive keywords like TOKEN or SECRET', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hiddenUntilFoundBlocks = html.match(/<[^>]*hidden="until-found"[^>]*>([\s\S]*?)<\/[^>]+>/g) || [];
    const containsSensitiveInfo = hiddenUntilFoundBlocks.some(block => 
      /TOKEN|SECRET|PASSWORD|KEY/i.test(block)
    );
    expect(containsSensitiveInfo).toBe(false);
  });

  // 4. If the hidden content has related UI state, that state MUST be synchronized using a beforematch event listener.
  test('Scripts should register a beforematch event listener', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasBeforeMatchListener = /beforematch/i.test(html);
    expect(hasBeforeMatchListener).toBe(true);
  });

  // 5. Implementation MUST include an explicit JavaScript feature detection check for native support.
  test('Scripts should include the mandatory feature detection check for onbeforematch', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasFeatureDetection = /if\s*\(!\s*\(\s*['"]onbeforematch['"]\s+in\s+HTMLElement\.prototype\s*\)\s*\)/i.test(html);
    expect(hasFeatureDetection).toBe(true);
  });

  // Setup browser testing
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

    await page.goto(demoUrl);
  });

  // 6. UI state MUST be synchronized using a beforematch event listener.
  test('UI state should synchronize correctly when content is revealed (beforematch)', async ({ page }) => {
    const supportsUntilFound = await page.evaluate(() => 'onbeforematch' in HTMLElement.prototype);
    
    if (supportsUntilFound) {
      const isSynced = await page.evaluate(() => {
        // Find a pane that is currently hidden
        const pane = document.querySelector('[hidden="until-found"]');
        if (!pane) return false;
        
        const id = pane.id;
        const button = document.querySelector(`[aria-controls="${id}"]`);
        if (!button || button.getAttribute('aria-expanded') === 'true') return false;
        
        // Trigger event
        pane.dispatchEvent(new Event('beforematch', { bubbles: true }));
        
        // Check if button updated
        return button.getAttribute('aria-expanded') === 'true';
      });
      expect(isSynced).toBe(true);
    } else {
      // Fallback: no elements should have hidden="until-found" if not supported
      const hiddenCount = await page.locator('[hidden="until-found"]').count();
      expect(hiddenCount).toBe(0);
    }
  });

});
