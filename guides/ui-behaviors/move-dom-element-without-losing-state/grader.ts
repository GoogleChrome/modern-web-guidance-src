import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

function getCombinedScriptContent(inlineScripts: string[]): string {
  const parts = [...inlineScripts];
  const isDemoTarget = demoName === 'demo.html' || demoName === 'negative-demo.html';
  const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const files: string[] = [];
  if (isDemoTarget) {
    const srcMatches = html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi);
    for (const match of srcMatches) {
      const src = match[1];
      if (!/^https?:\/\//i.test(src) && !src.startsWith('//')) {
        const resolved = path.resolve(targetDir, src.replace(/^\/+/, ''));
        if (resolved.startsWith(targetDir + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          files.push(resolved);
        }
      }
    }
  } else {
    const excludedDirs = new Set(['node_modules', 'vendor', 'test', 'tests', 'grade-report', 'test-results', 'dist', '.git']);
    const walk = (dir: string) => {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!excludedDirs.has(entry.name)) walk(fullPath);
          } else if (
            entry.isFile() &&
            (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
            !entry.name.includes('.test.') &&
            !entry.name.includes('.spec.') &&
            !entry.name.includes('.config.') &&
            entry.name !== 'grade.mjs' &&
            entry.name !== 'run.mjs'
          ) {
            files.push(fullPath);
          }
        }
      } catch {}
    };
    walk(targetDir);
  }
  for (const f of new Set(files)) {
    if (fs.existsSync(f)) {
      parts.push(fs.readFileSync(f, 'utf-8'));
    }
  }
  return parts.join('\n');
}

test.describe(`move-before Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = requestPath === '/' ? demoName : requestPath.replace(/^\/+/, '');
      const localFilePath = path.resolve(targetDir, relPath);

      if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('Document contains a stateful element (iframe, input, video, or audio)', async ({ page }) => {
    const statefulElements = await page.locator('iframe, input, video, audio').count();
    expect(statefulElements).toBeGreaterThan(0);
  });

  test('Script contains a feature detection check for moveBefore', async ({ page }) => {
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.innerText);
    });
    const content = getCombinedScriptContent(scripts);
    
    const hasFeatureDetection = /['"`]moveBefore['"`]\s*in\s+(?:Element\.prototype|document|window|[\w.]+)/.test(content) ||
                                /typeof\s+[\w.?]+\.moveBefore\s*===?\s*['"`]function['"`]/.test(content) ||
                                /if\s*\(\s*[\w.?]+\.moveBefore\s*\)/.test(content);
                                
    expect(hasFeatureDetection).toBeTruthy();
  });

  test('Script uses moveBefore to move an element', async ({ page }) => {
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.innerText);
    });
    const content = getCombinedScriptContent(scripts);
    
    const usesMoveBefore = /\.moveBefore\s*\(/.test(content);
    expect(usesMoveBefore).toBeTruthy();
  });

  test('Script falls back to using insertBefore or appendChild', async ({ page }) => {
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.innerText);
    });
    const content = getCombinedScriptContent(scripts);
    
    const hasFeatureDetection = /['"`]moveBefore['"`]\s*in\s+(?:Element\.prototype|document|window|[\w.]+)/.test(content) ||
                                /typeof\s+[\w.?]+\.moveBefore\s*===?\s*['"`]function['"`]/.test(content) ||
                                /if\s*\(\s*[\w.?]+\.moveBefore\s*\)/.test(content);
    const usesDomFallback = /\.insertBefore\s*\(|\.appendChild\s*\(|\.append\s*\(|\.prepend\s*\(|\.replaceChildren\s*\(/.test(content);
    const hasExplicitFallbackBranch = hasFeatureDetection && (/else\b/.test(content) || /fallback/i.test(content));
    expect(usesDomFallback || hasExplicitFallbackBranch).toBeTruthy();
  });

});
