import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not set');
}
const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const targetFileName = path.basename(filePath);
const targetUrl = `http://localhost/${targetFileName}`;

test.describe('Visibility State Detection Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = requestPath === '/' ? targetFileName : requestPath.replace(/^\/+/, '');
      const localFilePath = path.resolve(targetDir, relPath);
      if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  });

  test('provides a boolean indicating if the page was initially loaded in the background', async ({ page }) => {
    const consoleObjects: any[] = [];
    page.on('console', async (msg) => {
      for (const arg of msg.args()) {
        try {
          const val = await arg.jsonValue();
          if (val && typeof val === 'object') {
            consoleObjects.push(val);
          }
        } catch (e) {
          // ignore parsing errors
        }
      }
    });

    await page.addInitScript(() => {
      (window as any).VisibilityStateEntry = class VisibilityStateEntry {};
      const originalGetEntriesByType = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = function(type: string) {
        if (type === 'visibility-state') {
          return [
            {
              name: 'hidden',
              entryType: 'visibility-state',
              startTime: 0,
              duration: 0,
              toJSON() { return this; }
            } as any
          ];
        }
        return originalGetEntriesByType(type);
      };
    });

    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.innerText('body');
    const reportedBackgrounded = await page.evaluate((logs) => {
      for (const obj of logs) {
        for (const key of Object.keys(obj)) {
          if (/background/i.test(key)) {
            if (typeof obj[key] === 'boolean') {
              return obj[key];
            }
          }
        }
      }
      return null;
    }, consoleObjects);

    let finalResult = reportedBackgrounded;
    if (finalResult === null) {
      const matches = bodyText.match(/(?:backgrounded|background|loaded in background)[^\w]*(true|false)/i);
      if (matches) {
        finalResult = matches[1].toLowerCase() === 'true';
      }
    }

    expect(finalResult).toBe(true);
  });

  test('provides the precise time (in milliseconds) that the page was backgrounded', async ({ page }) => {
    const consoleObjects: any[] = [];
    page.on('console', async (msg) => {
      for (const arg of msg.args()) {
        try {
          const val = await arg.jsonValue();
          if (val && typeof val === 'object') {
            consoleObjects.push(val);
          }
        } catch (e) {
          // ignore
        }
      }
    });

    const expectedStartTime = 45.5;

    await page.addInitScript((time) => {
      (window as any).VisibilityStateEntry = class VisibilityStateEntry {};
      const originalGetEntriesByType = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = function(type: string) {
        if (type === 'visibility-state') {
          return [
            {
              name: 'visible',
              entryType: 'visibility-state',
              startTime: 0,
              duration: 0,
              toJSON() { return this; }
            } as any,
            {
              name: 'hidden',
              entryType: 'visibility-state',
              startTime: time,
              duration: 0,
              toJSON() { return this; }
            } as any
          ];
        }
        return originalGetEntriesByType(type);
      };
    }, expectedStartTime);

    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.innerText('body');
    const reportedTime = await page.evaluate((logs) => {
      for (const obj of logs) {
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'number') {
            return obj[key];
          }
        }
      }
      return null;
    }, consoleObjects);

    let finalTime = reportedTime;
    if (finalTime === null) {
      const matches = bodyText.match(/(?:backgrounded time|background time|time backgrounded)[^\w]*([\d.]+)/i);
      if (matches) {
        finalTime = parseFloat(matches[1]);
      }
    }

    expect(finalTime).toBe(expectedStartTime);
  });

  test('prefers the VisibilityStateEntry API over document.visibilityState', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__performanceCalled = false;
      (window as any).VisibilityStateEntry = class VisibilityStateEntry {};
      const originalGetEntriesByType = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = function(type: string) {
        if (type === 'visibility-state') {
          (window as any).__performanceCalled = true;
          return [
            {
              name: 'hidden',
              entryType: 'visibility-state',
              startTime: 0,
              duration: 0,
              toJSON() { return this; }
            } as any
          ];
        }
        return originalGetEntriesByType(type);
      };
    });

    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    const called = await page.evaluate(() => (window as any).__performanceCalled);
    expect(called).toBe(true);
  });

  // Helper to extract all script contents from the HTML target file and sibling JS files
  function getScriptContents(targetFilePath: string): string[] {
    if (!fs.existsSync(targetFilePath)) {
      return [];
    }
    const htmlContent = fs.readFileSync(targetFilePath, 'utf-8');
    const contents: string[] = [];
    const dir = path.dirname(path.resolve(targetFilePath));

    const scriptTagRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
      const attrs = match[1];
      const body = match[2];

      if (body.trim()) {
        contents.push(body);
      }

      const srcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(attrs);
      if (srcMatch) {
        const srcPath = path.resolve(dir, srcMatch[1].replace(/^\/+/, ''));
        if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
          contents.push(fs.readFileSync(srcPath, 'utf-8'));
        }
      }
    }
    try {
      for (const f of fs.readdirSync(dir)) {
        if ((f.endsWith('.js') || f.endsWith('.mjs')) && !f.includes('.test.') && f !== 'grade.mjs' && f !== 'run.mjs') {
          contents.push(fs.readFileSync(path.join(dir, f), 'utf-8'));
        }
      }
    } catch {}
    return contents;
  }

  test('includes a fallback to document.visibilityState for unsupported browsers', async ({ page }) => {
    const consoleObjects: any[] = [];
    page.on('console', async (msg) => {
      for (const arg of msg.args()) {
        try {
          const val = await arg.jsonValue();
          if (val && typeof val === 'object') {
            consoleObjects.push(val);
          }
        } catch (e) {
          // ignore
        }
      }
    });

    await page.addInitScript(() => {
      delete (window as any).VisibilityStateEntry;
      const originalGetEntriesByType = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = function(type: string) {
        if (type === 'visibility-state') {
          return [];
        }
        return originalGetEntriesByType(type);
      };
    });

    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.innerText('body');
    const hasFallbackMethod = await page.evaluate((logs) => {
      for (const obj of logs) {
        if (obj && typeof obj === 'object') {
          for (const val of Object.values(obj)) {
            if (typeof val === 'string' && val.includes('document.visibilityState')) {
              return true;
            }
          }
        }
      }
      return false;
    }, consoleObjects);

    const scripts = getScriptContents(targetFile);
    const hasStaticFallback = scripts.some(code => 
      code.includes('document.visibilityState') && 
      code.includes('VisibilityStateEntry')
    );

    const fallbackDetected = hasFallbackMethod || hasStaticFallback || bodyText.includes('document.visibilityState');
    expect(fallbackDetected).toBe(true);
  });

  test('correctly identifies that document.visibilityState is unreliable for asynchronous scripts', async ({ page }) => {
    const consoleObjects: any[] = [];
    page.on('console', async (msg) => {
      for (const arg of msg.args()) {
        try {
          const val = await arg.jsonValue();
          if (val && typeof val === 'object') {
            consoleObjects.push(val);
          }
        } catch (e) {
          // ignore
        }
      }
    });

    await page.addInitScript(() => {
      delete (window as any).VisibilityStateEntry;
      const originalGetEntriesByType = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = function(type: string) {
        if (type === 'visibility-state') {
          return [];
        }
        return originalGetEntriesByType(type);
      };
    });

    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.innerText('body');
    const hasUnreliableFlag = await page.evaluate((logs) => {
      for (const obj of logs) {
        if (obj && typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            if ((key === 'isReliable' && obj[key] === false) || (key === 'fallbackActive' && obj[key] === true)) {
              return true;
            }
            if (typeof obj[key] === 'string' && /unreliable|inaccurate|warning|less accurate/i.test(obj[key])) {
              return true;
            }
          }
        }
      }
      return false;
    }, consoleObjects);

    const scripts = getScriptContents(targetFile);
    const hasStaticUnreliabilityMention = scripts.some(code => 
      /unreliable|inaccurate|less accurate|race condition|not fully reliable|not reliable|warning/i.test(code)
    );

    const unreliableDetected = hasUnreliableFlag || hasStaticUnreliabilityMention || /unreliable|inaccurate|warning/i.test(bodyText);
    expect(unreliableDetected).toBe(true);
  });

});
