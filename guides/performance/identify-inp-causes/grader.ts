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

const WEB_VITALS_BUNDLE_RE = /\bonINP\$|\bhandleLoAFEntries\b|\bgetVisibilityWatcher\b/;
function isWebVitalsBundle(content: string): boolean {
  if (WEB_VITALS_BUNDLE_RE.test(content)) return true;
  return (
    content.includes('prerenderingchange') &&
    content.includes('soft-navigation') &&
    content.includes('first-input')
  );
}

function getCodeContent(): string {
  const contents = [fs.readFileSync(filePath, 'utf-8')];
  const ignoredDirs = new Set(['node_modules', 'vendor', 'dist', 'build', 'lib', 'grade-report', 'test-results', '.git']);
  if (fs.existsSync(path.join(targetDir, 'src'))) {
    ignoredDirs.add('assets');
  }
  function walk(dir: string) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name) && !entry.name.startsWith('.')) {
            walk(path.join(dir, entry.name));
          }
        } else if (
          (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
          !entry.name.includes('.test.') &&
          entry.name !== 'run.mjs' &&
          entry.name !== 'grade.mjs' &&
          !/web-vitals/i.test(entry.name)
        ) {
          const text = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
          if (!isWebVitalsBundle(text)) {
            contents.push(text);
          }
        }
      }
    } catch {}
  }
  walk(targetDir);
  return contents.join('\n');
}

test.describe(`identify-inp-causes Expectations: ${demoName}`, () => {
  
  // Functional assertions (Static analysis)
  
  test('Should use a RUM library like web-vitals for measuring INP', async () => {
    const html = getCodeContent();
    expect(html).toContain('web-vitals');
  });

  test('Should handle the case where longestScript.entry might be empty', async () => {
    const html = getCodeContent();
    // Check for optional chaining or conditional guard when accessing longestScript.entry (directly or via local alias)
    expect(html).toMatch(/(?:(?:longestScript|longest)\?\.entry|(?:longestScript|longest)\.entry\?\.|\bif\s*\([^)]*(?:longestScript|longest)[^)]*\)[\s\S]{0,100}?(?:longestScript|longest)\.entry|\b(?:longestScript|longest)\s*\?[\s\S]{0,100}?(?:longestScript|longest)\.entry|\b(?:longestScript|longest)\s*&&[\s\S]{0,100}?(?:longestScript|longest)\.entry)/);
  });

  test('Should use Long Animation Frames (LoAF) data for INP attribution', async () => {
    const html = getCodeContent();
    expect(html).toContain('longestScript');
  });

  test('Should avoid using the JS Self-Profiling API (Profiler) as per best practices', async () => {
    const html = getCodeContent();
    expect(html).not.toContain('new Profiler');
  });

  test('Should not manually re-implement INP using raw Event Timing API', async () => {
    const html = getCodeContent();
    // Detecting manual PerformanceObserver usage for events
    expect(html).not.toMatch(/observe\(\s*{\s*type:\s*['"]event['"]/);
  });

  test('Should use the onINP function to observe the metric', async () => {
    const html = getCodeContent();
    expect(html).toContain('onINP');
  });

  // Browser assertions
  
  test.beforeEach(async ({ page }) => {
    // Route local file requests
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

  test('Page should import the attribution build of web-vitals', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.src).join(' ');
    });
    expect(scriptContent.trim().length).toBeGreaterThan(0);
    const combined = `${scriptContent}\n${getCodeContent()}`;
    expect(combined).toMatch(/web-vitals[/.].*attribution/);
  });

  test('Page scripts should handle longestScript.entry safely', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.src).join(' ');
    });
    expect(scriptContent.trim().length).toBeGreaterThan(0);
    const combined = `${scriptContent}\n${getCodeContent()}`;
    expect(combined).toMatch(/(?:(?:longestScript|longest)\?\.entry|(?:longestScript|longest)\.entry\?\.|\bif\s*\([^)]*(?:longestScript|longest)[^)]*\)[\s\S]{0,100}?(?:longestScript|longest)\.entry|\b(?:longestScript|longest)\s*\?[\s\S]{0,100}?(?:longestScript|longest)\.entry|\b(?:longestScript|longest)\s*&&[\s\S]{0,100}?(?:longestScript|longest)\.entry)/);
  });

  test('Page should not use Profiler API in its scripts', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.src).join(' ');
    });
    const combined = `${scriptContent}\n${getCodeContent()}`;
    expect(combined).not.toContain('new Profiler');
  });

  test('Page should not have a manual PerformanceObserver for event timing', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.src).join(' ');
    });
    const combined = `${scriptContent}\n${getCodeContent()}`;
    expect(combined).not.toMatch(/observe\(\s*{\s*type:\s*['"]event['"]/);
  });

  test('Page should use onINP for metric collection', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.src).join(' ');
    });
    expect(scriptContent.trim().length).toBeGreaterThan(0);
    const combined = `${scriptContent}\n${getCodeContent()}`;
    expect(combined).toContain('onINP');
  });

  async function getStrippedSource(page: import('@playwright/test').Page): Promise<string> {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.src).join('\n');
    });
    const raw = `${scriptContent}\n${getCodeContent()}`;
    return raw
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[\s;{}()])\/\/[^\n]*/gm, '$1');
  }

  test('INP subparts (`inputDelay`, `processingDuration`, `presentationDelay`) are provided.', async ({ page }) => {
    const code = await getStrippedSource(page);
    expect(code).toMatch(/\binputDelay\b/);
    expect(code).toMatch(/\bprocessingDuration\b/);
    expect(code).toMatch(/\bpresentationDelay\b/);
  });

  test('Style and layout durations from Long Animation Frames (`styleDuration`, `layoutDuration`, `forcedStyleDuration`, `forcedLayoutDuration`, or combined fallbacks `forcedStyleAndLayoutDuration` / `totalStyleAndLayoutDuration`) are reported.', async ({ page }) => {
    const code = await getStrippedSource(page);
    const hasSplitRender = /\bstyleDuration\b/.test(code) && /\blayoutDuration\b/.test(code);
    const hasSplitForced = /\bforcedStyleDuration\b/.test(code) && /\bforcedLayoutDuration\b/.test(code);
    const hasCombinedFallback = /\bforcedStyleAndLayoutDuration\b/.test(code) || /\btotalStyleAndLayoutDuration\b/.test(code);
    const hasRawLoafStyleLayout =
      /\bstyleAndLayoutStart\b/.test(code) &&
      (/\bpaintTime\b/.test(code) || /\bstartTime\b/.test(code));
    expect(hasSplitRender || hasSplitForced || hasCombinedFallback || hasRawLoafStyleLayout).toBe(true);
  });
});
