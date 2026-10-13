import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { Project, SyntaxKind, Node } from 'ts-morph';

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

function getAllModuleScripts(targetFilePath: string): string[] {
  const visited = new Set<string>();
  const initialScripts = getModuleScriptContents(targetFilePath);
  const rawScripts = [...initialScripts];

  function collectImportedModules(code: string, baseDir: string) {
    const importRegex = /\bimport\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = importRegex.exec(code)) !== null) {
      const absPath = path.resolve(baseDir, m[1]);
      if (!visited.has(absPath) && fs.existsSync(absPath)) {
        visited.add(absPath);
        const importedCode = fs.readFileSync(absPath, 'utf-8');
        rawScripts.push(importedCode);
        collectImportedModules(importedCode, path.dirname(absPath));
      }
    }
  }

  for (const script of initialScripts) {
    collectImportedModules(script, path.dirname(path.resolve(targetFilePath)));
  }

  return rawScripts;
}

async function gotoTargetOverLocalhost(page: Page, targetFile: string): Promise<void> {
  const absFile = path.resolve(targetFile);
  const targetDir = path.dirname(absFile);
  const fileName = path.basename(absFile);

  await page.route('http://localhost/**', async (route) => {
    const reqPath = new URL(route.request().url()).pathname;
    const localPath = path.join(targetDir, reqPath === '/' ? fileName : reqPath);
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      const ext = path.extname(localPath).toLowerCase();
      const contentType =
        ext === '.js' || ext === '.mjs'
          ? 'application/javascript'
          : ext === '.css'
            ? 'text/css'
            : 'text/html';
      await route.fulfill({ path: localPath, contentType });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export default {};' });
    }
  });

  await page.goto(`http://localhost/${fileName}`);
}

test.describe('Conditional Async Dependencies Grader', () => {

  test('A button with a popovertarget or commandfor attribute is present in the document', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await gotoTargetOverLocalhost(page, targetFile);
    
    const button = page.locator('button[popovertarget], button[commandfor], [popovertarget], [commandfor]').first();
    await expect(button).toBeVisible();
  });

  test('A popover element whose ID matches the button popovertarget or commandfor is present', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    await gotoTargetOverLocalhost(page, targetFile);
    
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
    await gotoTargetOverLocalhost(page, targetFile);
    
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
    await gotoTargetOverLocalhost(page, targetFile);

    const checked = await page.evaluate(() => (window as any).__popoverCheckedHTMLElement);
    if (checked) {
      expect(checked).toBe(true);
      return;
    }

    const rawScripts = getAllModuleScripts(targetFile);
    const hasCheck = rawScripts.some((code) =>
      /['"]popover['"]\s+in\s+HTMLElement\.prototype|HTMLElement\.prototype\.hasOwnProperty\(\s*['"]popover['"]\s*\)|Object\.hasOwn\(\s*HTMLElement\.prototype\s*,\s*['"]popover['"]\s*\)|typeof\s+HTMLElement\.prototype\.popover/.test(
        code
      )
    );
    expect(hasCheck).toBe(true);
  });

  test('If the feature is missing, a dynamic import is executed', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    
    const rawScripts = getAllModuleScripts(targetFile);
    const hasConditionalImport = rawScripts.some((code) => {
      const withoutStaticImports = code.replace(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"][^'"]+['"]\s*;?/gm, '');
      return /\bimport\s*\(/.test(withoutStaticImports) && /popover/.test(withoutStaticImports) && /\bif\s*\(/.test(withoutStaticImports);
    });
    expect(hasConditionalImport).toBe(true);
  });

  test('The dynamic import is executed using top-level await', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    const rawScripts = getAllModuleScripts(targetFile);
    const project = new Project({ useInMemoryFileSystem: true });
    const hasTopLevelAwait = rawScripts.some((code, idx) => {
      const sf = project.createSourceFile(`module_${idx}.ts`, code, { overwrite: true });
      const awaits = sf.getDescendantsOfKind(SyntaxKind.AwaitExpression);
      return awaits.some((awaitExpr) => {
        const exprText = awaitExpr.getExpression().getText();
        if (!/\bimport\s*\(/.test(exprText)) return false;
        const enclosingFn = awaitExpr.getFirstAncestor((a) => Node.isFunctionLikeDeclaration(a));
        return !enclosingFn;
      });
    });
    expect(hasTopLevelAwait).toBe(true);
  });

  test('The conditionally loaded logic is implemented within a single module entry point, preventing simultaneous imports from multiple sibling modules', async () => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    const rawScripts = getAllModuleScripts(targetFile);

    expect(rawScripts.length).toBeGreaterThan(0);

    // Strip static import lines before checking for dynamic import() calls
    const scriptsWithDynamicImport = rawScripts.filter(code => {
      const withoutStaticImports = code.replace(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"][^'"]+['"]\s*;?/gm, '');
      return /\bimport\s*\(/.test(withoutStaticImports);
    });
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
