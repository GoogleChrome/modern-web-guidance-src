import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper to strip single-line, multi-line comments and string literals
function stripStringsAndComments(code: string): string {
  let clean = code;
  // Replace single line comments
  clean = clean.replace(/\/\/.*$/gm, '');
  // Replace multi-line comments
  clean = clean.replace(/\/\*[\s\S]*?\*\//g, '');
  // Replace single-quoted strings
  clean = clean.replace(/'[^']*'/g, '');
  // Replace double-quoted strings
  clean = clean.replace(/"[^"]*"/g, '');
  // Replace template literals
  clean = clean.replace(/`[^`]*`/g, '');
  return clean;
}

// Helper to extract all module script contents from the HTML target file
function getModuleScriptContents(targetFilePath: string): string[] {
  if (!fs.existsSync(targetFilePath)) {
    return [];
  }
  const htmlContent = fs.readFileSync(targetFilePath, 'utf-8');
  const contents: string[] = [];
  
  // Regex to match any <script ...>...</script>
  const scriptTagRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
    const attrs = match[1];
    const body = match[2];
    
    // Check if it's a module
    if (/type\s*=\s*["']module["']/i.test(attrs)) {
      // Inline module script
      if (body.trim()) {
        contents.push(body);
      }
      
      // External script
      const srcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(attrs);
      if (srcMatch) {
        const srcPath = path.resolve(path.dirname(targetFilePath), srcMatch[1]);
        if (fs.existsSync(srcPath)) {
          contents.push(fs.readFileSync(srcPath, 'utf-8'));
        }
      }
    }
  }
  return contents;
}

test.describe('Conditional Async Dependencies Grader', () => {

  test('A button with a popovertarget attribute is present in the document', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await page.goto(`file://${path.resolve(targetFile)}`);
    
    const button = page.locator('button[popovertarget]');
    await expect(button).toBeVisible();
  });

  test('A popover element whose ID matches the button popovertarget is present', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await page.goto(`file://${path.resolve(targetFile)}`);
    
    const button = page.locator('button[popovertarget]');
    await expect(button).toBeVisible();
    const targetId = await button.getAttribute('popovertarget');
    expect(targetId).toBeTruthy();
    
    const popover = page.locator(`#${targetId}`);
    await expect(popover).toBeVisible({ visible: false }); // Starts hidden
    const hasPopoverAttr = await popover.evaluate(el => el.hasAttribute('popover'));
    expect(hasPopoverAttr).toBe(true);
  });

  test('The popover element is functional and can be toggled', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await page.goto(`file://${path.resolve(targetFile)}`);
    
    const button = page.locator('button[popovertarget]');
    const targetId = await button.getAttribute('popovertarget');
    expect(targetId).toBeTruthy();
    const popover = page.locator(`#${targetId}`);
    
    // Initially, the popover should be hidden
    const isInitiallyHidden = await popover.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' || el.matches(':not(:popover-open)');
    });
    expect(isInitiallyHidden).toBe(true);
    
    // Click the button to toggle/open
    await button.click();
    
    // Now, the popover should be visible
    const isVisibleAfterClick = await popover.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none';
    });
    expect(isVisibleAfterClick).toBe(true);
  });

  test('The script checks if popover is in HTMLElement.prototype to determine if a polyfill is needed', async ({ page }) => {
    // Inject tracking and proxying script before loading the page
    await page.addInitScript(() => {
      (window as any).__popoverCheckedHTMLElement = false;
      
      if (typeof HTMLElement !== 'undefined' && HTMLElement.prototype) {
        const originalProto = Object.getPrototypeOf(HTMLElement.prototype);
        const proxy = new Proxy(originalProto, {
          has(target, prop) {
            if (prop === 'popover') {
              (window as any).__popoverCheckedHTMLElement = true;
            }
            return Reflect.has(target, prop);
          }
        });
        
        try {
          delete (HTMLElement.prototype as any).popover;
        } catch (e) {
          // Ignore
        }
        
        Object.setPrototypeOf(HTMLElement.prototype, proxy);
      }
    });

    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await page.goto(`file://${path.resolve(targetFile)}`);

    // Retrieve the flag
    const checked = await page.evaluate(() => (window as any).__popoverCheckedHTMLElement);
    expect(checked).toBe(true);
  });

  test('If the feature is missing, a dynamic import is executed', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    
    // 1. Static/Analysis Check: Ensure there is a conditional import based on HTMLElement.prototype
    const rawScripts = getModuleScriptContents(targetFile);
    const hasConditionalImport = rawScripts.some(code => 
      code.includes('popover') && 
      code.includes('HTMLElement.prototype') && 
      code.includes('import(')
    );
    expect(hasConditionalImport).toBe(true);

    // 2. Behavioral Check: If we load the page with popover missing, the polyfill is executed
    await page.addInitScript(() => {
      if (typeof HTMLElement !== 'undefined' && HTMLElement.prototype) {
        try {
          delete (HTMLElement.prototype as any).popover;
        } catch (e) {}
      }
    });

    await page.goto(`file://${path.resolve(targetFile)}`);
    // Wait for async dynamic imports to execute
    await page.waitForTimeout(200);

    const isShowPopoverDefined = await page.evaluate(() => {
      return typeof (HTMLElement.prototype as any).showPopover === 'function';
    });
    expect(isShowPopoverDefined).toBe(true);
  });

  test('The dynamic import is executed using top-level await', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    const cleanedScripts = getModuleScriptContents(targetFile).map(stripStringsAndComments);
    
    // Check if any script contains `await import`
    const hasAwaitImport = cleanedScripts.some(code => 
      /\bawait\s+import\b/.test(code)
    );
    
    expect(hasAwaitImport).toBe(true);
  });

  test('The conditionally loaded logic is implemented within a single module entry point, preventing simultaneous imports from multiple sibling modules', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    const scriptContents = getModuleScriptContents(targetFile);
    
    let topLevelAwaitImportsCount = 0;
    
    for (const code of scriptContents) {
      const staticImportRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gi;
      let match;
      while ((match = staticImportRegex.exec(code)) !== null) {
        const importUrl = match[1];
        
        let importContent = '';
        if (importUrl.startsWith('data:')) {
          const dataMatch = /data:[^,]+,(.*)/.exec(importUrl);
          if (dataMatch) {
            importContent = decodeURIComponent(dataMatch[1]);
          }
        } else {
          const importPath = path.resolve(path.dirname(targetFile), importUrl);
          if (fs.existsSync(importPath)) {
            importContent = fs.readFileSync(importPath, 'utf-8');
          }
        }
        
        const cleanedImport = stripStringsAndComments(importContent);
        if (cleanedImport.includes('await')) {
          topLevelAwaitImportsCount++;
        }
      }
    }
    
    // We expect 0 or at most 1 module containing top-level await to be imported statically,
    // preventing simultaneous imports of top-level await modules.
    expect(topLevelAwaitImportsCount).toBeLessThanOrEqual(1);
  });

});
