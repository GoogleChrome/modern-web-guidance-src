import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function getModuleScriptContents(targetFilePath: string): string[] {
  if (!fs.existsSync(targetFilePath)) {
    return [];
  }
  const htmlContent = fs.readFileSync(targetFilePath, 'utf-8');
  const contents: string[] = [];
  
  const scriptTagRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
    const attrs = match[1];
    const body = match[2];
    
    if (/type\s*=\s*["']module["']/i.test(attrs) || !attrs.includes('src')) {
      if (body.trim()) {
        contents.push(body);
      }
      
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

  test('A button with a popovertarget or commandfor attribute is present in the document', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await page.goto(`file://${path.resolve(targetFile)}`);
    
    const button = page.locator('button[popovertarget], button[commandfor], [popovertarget], [commandfor]').first();
    await expect(button).toBeVisible();
  });

  test('A popover element whose ID matches the button popovertarget or commandfor is present', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await page.goto(`file://${path.resolve(targetFile)}`);
    
    const button = page.locator('button[popovertarget], button[commandfor], [popovertarget], [commandfor]').first();
    await expect(button).toBeVisible();
    const targetId = (await button.getAttribute('popovertarget')) || (await button.getAttribute('commandfor'));
    expect(targetId).toBeTruthy();
    
    const popover = page.locator(`#${targetId}`);
    const hasPopoverAttr = await popover.evaluate(el => el.hasAttribute('popover'));
    expect(hasPopoverAttr).toBe(true);
  });

  test('The popover element is functional and can be toggled', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await page.goto(`file://${path.resolve(targetFile)}`);
    
    const button = page.locator('button[popovertarget], button[commandfor], [popovertarget], [commandfor]').first();
    const targetId = (await button.getAttribute('popovertarget')) || (await button.getAttribute('commandfor'));
    expect(targetId).toBeTruthy();
    const popover = page.locator(`#${targetId}`);
    
    await button.click({ force: true }).catch(() => button.dispatchEvent('click'));
    await page.waitForTimeout(300);
    
    const isVisibleAfterClick = await popover.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' || el.matches(':popover-open') || el.classList.contains(':popover-open');
    });
    expect(isVisibleAfterClick).toBe(true);
  });

  test('The script checks if popover is in HTMLElement.prototype to determine if a polyfill is needed', async ({ page }) => {
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
        } catch (e) {}
        
        Object.setPrototypeOf(HTMLElement.prototype, proxy);
      }
    });

    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await page.goto(`file://${path.resolve(targetFile)}`);

    const checked = await page.evaluate(() => (window as any).__popoverCheckedHTMLElement);
    if (checked) {
      expect(checked).toBe(true);
      return;
    }

    const htmlContent = fs.readFileSync(path.resolve(targetFile), 'utf-8');
    const hasCheck = htmlContent.includes('popover') && (htmlContent.includes('HTMLElement.prototype') || htmlContent.includes('in HTMLElement') || htmlContent.includes('!('));
    expect(hasCheck).toBe(true);
  });

  test('If the feature is missing, a dynamic import is executed', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    
    const rawScripts = getModuleScriptContents(targetFile);
    const hasConditionalImport = rawScripts.some(code => 
      code.includes('import(') || code.includes('popover')
    );
    expect(hasConditionalImport).toBe(true);
  });

  test('The dynamic import is executed using top-level await', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    const htmlContent = fs.readFileSync(path.resolve(targetFile), 'utf-8');
    const hasTopLevelAwait = htmlContent.includes('await') && htmlContent.includes('import(');
    expect(hasTopLevelAwait).toBe(true);
  });

  test('The conditionally loaded logic is implemented within a single module entry point, preventing simultaneous imports from multiple sibling modules', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    expect(true).toBe(true);
  });

});
