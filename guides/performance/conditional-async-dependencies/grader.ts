import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function getModuleScriptContents(targetFilePath: string): string[] {
  if (!fs.existsSync(targetFilePath)) {
    return [];
  }
  const htmlContent = fs.readFileSync(targetFilePath, 'utf-8');
  const visited = new Set<string>();
  const rawScripts: string[] = [];

  function resolveScriptPath(baseDir: string, src: string): string {
    const cleanSrc = src.replace(/^\//, '');
    return path.resolve(baseDir, cleanSrc);
  }

  function collectImports(code: string, baseDir: string) {
    const importRegex = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|import\s*\()\s*['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = importRegex.exec(code)) !== null) {
      const absPath = path.resolve(baseDir, m[1]);
      if (!visited.has(absPath) && fs.existsSync(absPath)) {
        visited.add(absPath);
        const importedCode = fs.readFileSync(absPath, 'utf-8');
        rawScripts.push(importedCode);
        collectImports(importedCode, path.dirname(absPath));
      }
    }
  }

  const scriptTagRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
    const attrs = match[1];
    const body = match[2];

    if (body.trim()) {
      rawScripts.push(body);
      collectImports(body, path.dirname(targetFilePath));
    }

    const srcMatch = /src\s*=\s*['"]([^'"]+)['"]/i.exec(attrs);
    if (srcMatch) {
      const srcPath = resolveScriptPath(path.dirname(targetFilePath), srcMatch[1]);
      if (!visited.has(srcPath) && fs.existsSync(srcPath)) {
        visited.add(srcPath);
        const code = fs.readFileSync(srcPath, 'utf-8');
        rawScripts.push(code);
        collectImports(code, path.dirname(srcPath));
      }
    }
  }

  return rawScripts;
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

    await expect.poll(async () => {
      return await popover.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' || el.matches(':popover-open') || el.classList.contains(':popover-open');
      });
    }, { timeout: 2000 }).toBe(true);
  });

  test('The script checks if popover is in HTMLElement.prototype to determine if a polyfill is needed', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }

    const rawScripts = getModuleScriptContents(path.resolve(targetFile));
    const popoverProtoCheck = rawScripts.some(code =>
      /['"]popover['"]\s+in\s+HTMLElement\.prototype/.test(code) ||
      /(?:Object\.(?:prototype\.)?(?:hasOwnProperty\.call|hasOwn)\s*\(\s*HTMLElement\.prototype\s*,\s*['"]popover['"]\))/.test(code)
    );
    expect(popoverProtoCheck).toBe(true);
  });

  test('If the feature is missing, a dynamic import is executed', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }

    const rawScripts = getModuleScriptContents(path.resolve(targetFile));
    const hasDynamicImport = rawScripts.some(code => /\bimport\s*\(/.test(code));
    expect(hasDynamicImport).toBe(true);
  });

  test('The dynamic import is executed using top-level await', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }

    const rawScripts = getModuleScriptContents(path.resolve(targetFile));
    const hasTopLevelAwait = rawScripts.some(code => /\bawait\s+import\s*\(/.test(code));
    expect(hasTopLevelAwait).toBe(true);
  });

  test('The conditionally loaded logic is implemented within a single module entry point, preventing simultaneous imports from multiple sibling modules', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }

    const rawScripts = getModuleScriptContents(path.resolve(targetFile));
    expect(rawScripts.length).toBeGreaterThan(0);

    // Exactly one module in the graph may own the conditional dynamic import
    const scriptsWithDynamicImport = rawScripts.filter((code) =>
      /\bimport\s*\(/.test(code.replace(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"][^'"]+['"]\s*;?/gm, ''))
    );
    expect(scriptsWithDynamicImport.length).toBe(1);

    // Ensure no module is simultaneously imported multiple times across the module graph
    const allStaticImports: string[] = [];
    for (const code of rawScripts) {
      const staticImports = Array.from(
        code.matchAll(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm),
        m => m[1]
      );
      allStaticImports.push(...staticImports);
    }
    const uniqueStaticImports = new Set(allStaticImports);
    expect(uniqueStaticImports.size).toBe(allStaticImports.length);
  });

});
