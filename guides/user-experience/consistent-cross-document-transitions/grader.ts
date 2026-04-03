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
const fileName = path.basename(filePath);
const fileUrl = `http://localhost/${fileName}`;

test.describe(`Consistent Cross-Document Transitions: ${fileName}`, () => {
  // 1. Opt in to cross-document view transitions
  test('Page must opt in to cross-document view transitions with @view-transition rule', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const viewTransitionRegex = /@view-transition\s*\{[^}]*navigation\s*:\s*auto/i;
    expect(html).toMatch(viewTransitionRegex);
  });

  // 2. Use <link rel="expect"> for above-the-fold content
  test('Page should use <link rel="expect"> with blocking="render" in the <head>', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';
    const linkExpectRegex = /<link\s+[^>]*rel=["']expect["'][^>]*blocking=["']render["']/i;
    expect(headContent).toMatch(linkExpectRegex);
  });

  // 3. pagereveal listener registered in a blocking="render" script
  test('A pagereveal listener should be found in a blocking="render" script in the <head>', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';
    
    const blockingScriptRegex = /<script\s+[^>]*blocking=["']render["'][^>]*>([\s\S]*?)<\/script>/gi;
    let found = false;
    let match;
    while ((match = blockingScriptRegex.exec(headContent)) !== null) {
      if (match[1].includes('pagereveal')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('No pagereveal listener should be registered in a non-blocking script', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const allScriptsRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
    let listenerWithoutBlocking = false;
    let match;
    while ((match = allScriptsRegex.exec(html)) !== null) {
      const scriptAttrs = match[1];
      const scriptContent = match[2];
      const hasBlocking = /blocking=["']render["']/i.test(scriptAttrs);
      const hasListener = /addEventListener\s*\(\s*['"]pagereveal['"]/i.test(scriptContent) || /\.onpagereveal\s*=/i.test(scriptContent);
      
      if (hasListener && !hasBlocking) {
        listenerWithoutBlocking = true;
        break;
      }
    }
    expect(listenerWithoutBlocking).toBe(false);
  });

  // 4. No duplicate view-transition-name values
  test('No two elements on the same page should share the same view-transition-name', async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' || requestPath === `/${fileName}` ? fileName : requestPath);
      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
    await page.goto(fileUrl);

    const names = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const vtNames: string[] = [];
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const name = style.viewTransitionName;
        if (name && name !== 'none') {
          vtNames.push(name);
        }
      });
      return vtNames;
    });

    const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
    expect(duplicates).toHaveLength(0);
  });

  // 5. Remove temporary view-transition-name after transition finishes
  test('Dynamically assigned view-transition-name values should be removed after transition finishes', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const cleanupRegex = /\.finished[\s\S]*?viewTransitionName\s*=\s*['"]\s*['"]/i;
    expect(html).toMatch(cleanupRegex);
  });

  // 6. Critical scripts in head must be render-blocking
  test('Scripts in <head> should be marked with blocking="render" if they are critical (e.g. theme or layout)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';
    
    const headScripts = headContent.match(/<script[\s\S]*?>/gi) || [];
    let criticalNonBlocking = false;
    for (const script of headScripts) {
      if ((script.toLowerCase().includes('theme') || script.toLowerCase().includes('layout')) && !/blocking=["']render["']/i.test(script)) {
        criticalNonBlocking = true;
        break;
      }
    }
    expect(criticalNonBlocking).toBe(false);
  });

  test('At least one blocking="render" script should exist if scripts are used in the <head>', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';
    const headScripts = headContent.match(/<script[\s\S]*?>/gi) || [];
    
    let hasAnyBlocking = true;
    if (headScripts.length > 0) {
      hasAnyBlocking = headScripts.some(s => /blocking=["']render["']/i.test(s));
    }
    expect(hasAnyBlocking).toBe(true);
  });
});
