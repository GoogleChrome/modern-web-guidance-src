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

function getCombinedSource(): { fullText: string; jsText: string } {
  const html = fs.readFileSync(filePath, 'utf-8');
  let fullText = html;
  const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
  let jsText = inlineScripts;
  try {
    for (const entry of fs.readdirSync(targetDir)) {
      if (/\.(?:m?js|ts)$/i.test(entry) && entry !== 'grader.ts') {
        const extContent = fs.readFileSync(path.join(targetDir, entry), 'utf-8');
        fullText += '\n' + extContent;
        jsText += '\n' + extContent;
      }
    }
  } catch {}
  const stripComments = (str: string) =>
    str
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
  return {
    fullText: stripComments(fullText),
    jsText: stripComments(jsText || fullText),
  };
}

const { fullText: fileContent, jsText: cleanJsContent } = getCombinedSource();

test.describe(`Temporal API Expectations: ${demoName}`, () => {

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

  test('MUST feature-detect the Temporal API before usage', async () => {
    const hasFeatureDetection = /(typeof\s+Temporal|'Temporal'\s+in|globalThis\.Temporal)/i.test(fileContent);
    expect(hasFeatureDetection, "Expected to find some form of feature detection for Temporal").toBe(true);
  });

  test('MUST conditionally load a Temporal polyfill only if native support is absent', async () => {
    const hasUnconditionalImport = /import\s+[^('"`]*['"`][^'"`]*polyfill[^'"`]*['"`]/i.test(fileContent);
    const hasDynamicImport = /import\s*\(\s*['"`][^'"`]*polyfill[^'"`]*['"`]\s*\)/i.test(fileContent);
    
    expect(hasUnconditionalImport, "Expected NOT to find top-level static import of polyfill").toBe(false);
    expect(hasDynamicImport, "Expected to find dynamic import() of polyfill").toBe(true);
  });

  test('MUST ensure the Temporal API is available globally', async () => {
    const assignsToGlobal = /(globalThis|window)?\.?Temporal\s*=/.test(fileContent);
    expect(assignsToGlobal, "Expected polyfill to be assigned to global scope or Temporal object initialized").toBe(true);
  });

  test('MUST use Temporal.PlainDate for capturing calendar dates', async () => {
    // negative-demo uses Temporal.PlainDate for a log timestamp, not a calendar date (birthdate).
    // demo.html uses Temporal.PlainDate for the birthdate.
    const usesPlainDateForCalendar = /Temporal\.PlainDate/i.test(fileContent);
    expect(usesPlainDateForCalendar, "Expected to find Temporal.PlainDate usage for calendar dates (e.g. date/birth)").toBe(true);
  });

  test('MUST use Temporal.PlainTime for capturing wall-clock times', async () => {
    const usesPlainTime = /Temporal\.PlainTime/i.test(fileContent);
    expect(usesPlainTime, "Expected to find Temporal.PlainTime usage or mention").toBe(true);
  });

  test('MUST NOT use Temporal.PlainDate or Temporal.PlainTime for data that represents a specific moment in physical time', async () => {
    const usesTemporalPlain = /Temporal\.(PlainDate|PlainTime)/i.test(cleanJsContent);
    const badUsage = /(?:const|let|var)\s+[a-zA-Z0-9_]*(log|instant|timestamp)[a-zA-Z0-9_]*\s*=\s*Temporal\.(PlainDate|PlainTime)/i.test(cleanJsContent);
    expect(usesTemporalPlain, "Expected Temporal.PlainDate or Temporal.PlainTime to be used").toBe(true);
    expect(badUsage, "Expected Temporal.PlainDate/Time NOT to be used for server logs or physical moments").toBe(false);
  });

  test('MUST NOT attempt to modify Temporal instances directly', async () => {
    const usesTemporalPlain = /Temporal\.(PlainDate|PlainTime)/i.test(cleanJsContent);
    const modifiesDirectly = /\.\s*(year|month|day|hour|minute|second|microsecond|nanosecond)\s*=[^=]/i.test(cleanJsContent);
    expect(usesTemporalPlain, "Expected Temporal.PlainDate or Temporal.PlainTime to be used").toBe(true);
    expect(modifiesDirectly, "Expected NO direct modification of Temporal instances (they are immutable)").toBe(false);
  });


});
