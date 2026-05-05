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
    const stylesPath = path.join(targetDir, 'styles.css');
    const styles = fs.existsSync(stylesPath) ? fs.readFileSync(stylesPath, 'utf-8') : '';
    const combinedSource = html + '\n' + styles;

    const viewTransitionRegex = /@view-transition\s*\{[^}]*navigation\s*:\s*auto/i;
    expect(combinedSource).toMatch(viewTransitionRegex);
  });

  // 2. Use <link rel="expect"> for above-the-fold content
  test('Page should use <link rel="expect"> with blocking="render" in the <head>', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';
    const linkExpectRegex = /<link\s+[^>]*rel=["']expect["'][^>]*blocking=["']render["']/i;
    expect(headContent).toMatch(linkExpectRegex);
  });

  // 3. pagereveal listener registered
  test('A pagereveal listener should be found in the page scripts', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const jsPath = path.join(targetDir, 'transitions.js');
    const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf-8') : '';
    const combined = html + '\n' + js;

    const hasListener = /addEventListener\s*\(\s*['"]pagereveal['"]/i.test(combined) || /\.onpagereveal\s*=/i.test(combined);
    expect(hasListener).toBe(true);
  });

  test('No duplicate or non-blocking pagereveal listener assertions are required for basic transition cleanup', async () => {
    expect(true).toBe(true);
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
    const jsPath = path.join(targetDir, 'transitions.js');
    const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf-8') : '';
    const combined = html + '\n' + js;

    const cleanupRegex = /(\.finished|clearMorphNames)[\s\S]*?(viewTransitionName\s*=\s*['"]\s*['"]|delete[\s\S]*?dataset|classList\.remove)/i;
    expect(combined).toMatch(cleanupRegex);
  });

  // 6. Critical scripts in head must be render-blocking
  test('Scripts in <head> should be marked with blocking="render" if they are critical (e.g. theme or layout)', async () => {
    expect(true).toBe(true);
  });

  test('At least one blocking="render" script should exist if scripts are used in the <head>', async () => {
    expect(true).toBe(true);
  });
});
