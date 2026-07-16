import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';

// Setup target workspace details
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

const patchFile = process.env.PATCH_FILE;
if (!patchFile) {
  throw new Error('PATCH_FILE environment variable not set.');
}

const targetFiles = extractTargetFilesFromPatch(patchFile);
const absoluteTargetFiles = targetFiles.map(f => path.join(targetDir, f));

// CSS block parsing helpers
function extractMediaQueries(css: string): { query: string; content: string }[] {
  const results: { query: string; content: string }[] = [];
  const mediaRegex = /@media\s*([^{]+)\{/gi;
  let match;
  while ((match = mediaRegex.exec(css)) !== null) {
    const query = match[1].trim();
    const startIdx = mediaRegex.lastIndex;
    
    let braceCount = 1;
    let endIdx = startIdx;
    while (braceCount > 0 && endIdx < css.length) {
      const char = css[endIdx];
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      endIdx++;
    }
    if (braceCount === 0) {
      const content = css.substring(startIdx, endIdx - 1).trim();
      results.push({ query, content });
    }
  }
  return results;
}

function extractViewTransitions(css: string): string[] {
  const results: string[] = [];
  const regex = /@view-transition\s*\{/gi;
  while (regex.exec(css) !== null) {
    const startIdx = regex.lastIndex;
    let braceCount = 1;
    let endIdx = startIdx;
    while (braceCount > 0 && endIdx < css.length) {
      const char = css[endIdx];
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      endIdx++;
    }
    if (braceCount === 0) {
      results.push(css.substring(startIdx, endIdx - 1).trim());
    }
  }
  return results;
}

// Grader tests
test.describe('Cross-Document Transitions Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---
  
  test('CSS styles satisfy guide requirements for cross-document transitions', () => {
    let cssContent = '';
    for (const file of absoluteTargetFiles) {
      if (!fs.existsSync(file)) continue;
      if (file.endsWith('.css')) {
        cssContent += String.fromCharCode(10) + fs.readFileSync(file, 'utf8');
      } else if (file.endsWith('.html') || file.endsWith('.astro')) {
        const htmlStr = fs.readFileSync(file, 'utf8');
        const { document } = parseHTML(htmlStr);
        const styleTags = document.querySelectorAll('style');
        for (const style of styleTags) {
          cssContent += String.fromCharCode(10) + style.textContent;
        }
      }
    }

    expect(cssContent.trim()).not.toBe('');

    const cleanCss = cssContent.replace(/\s+/g, ' ');

    // 1. Extract and verify @view-transition in prefers-reduced-motion: no-preference
    const mediaQueries = extractMediaQueries(cleanCss);
    const noPreferenceMedia = mediaQueries.find(mq => 
      /\bprefers-reduced-motion\s*:\s*no-preference\b/i.test(mq.query)
    );
    expect(noPreferenceMedia).toBeDefined();

    if (noPreferenceMedia) {
      const viewTransitions = extractViewTransitions(noPreferenceMedia.content);
      expect(viewTransitions.length).toBeGreaterThan(0);
      const hasNavigationAuto = viewTransitions.some(vt => 
        /\bnavigation\s*:\s*auto\b/i.test(vt)
      );
      expect(hasNavigationAuto).toBe(true);
    }

    // 2. Custom animations are defined for transition types using active-view-transition-type
    const hasActiveViewTransitionTypeNext = /:active-view-transition-type\s*\(\s*next\s*\)/i.test(cleanCss);
    const hasActiveViewTransitionTypePrev = /:active-view-transition-type\s*\(\s*previous\s*\)/i.test(cleanCss);
    expect(hasActiveViewTransitionTypeNext).toBe(true);
    expect(hasActiveViewTransitionTypePrev).toBe(true);

    // 3. Page-level transition animations use ::view-transition-old(root) and ::view-transition-new(root)
    const hasOldRoot = /::view-transition-old\s*\(\s*root\s*\)/i.test(cleanCss);
    const hasNewRoot = /::view-transition-new\s*\(\s*root\s*\)/i.test(cleanCss);
    expect(hasOldRoot).toBe(true);
    expect(hasNewRoot).toBe(true);

    // 4. Ensure body is not targeted for old/new view transitions, and incorrect active-view-transition is not used
    const hasOldBody = /::view-transition-old\s*\(\s*body\s*\)/i.test(cleanCss);
    const hasNewBody = /::view-transition-new\s*\(\s*body\s*\)/i.test(cleanCss);
    const hasActiveViewTransitionWrong = /:active-view-transition\b(?!-type)/i.test(cleanCss);
    expect(hasOldBody).toBe(false);
    expect(hasNewBody).toBe(false);
    expect(hasActiveViewTransitionWrong).toBe(false);
  });

  test('JavaScript source satisfies requirements for pagereveal listener', () => {
    let jsScripts: string[] = [];
    for (const file of absoluteTargetFiles) {
      if (!fs.existsSync(file)) continue;
      if (file.endsWith('.js') || file.endsWith('.ts')) {
        jsScripts.push(fs.readFileSync(file, 'utf8'));
      } else if (file.endsWith('.html') || file.endsWith('.astro')) {
        const htmlStr = fs.readFileSync(file, 'utf8');
        const { document } = parseHTML(htmlStr);
        const scriptTags = document.querySelectorAll('script');
        for (const script of scriptTags) {
          if (script.textContent) {
            jsScripts.push(script.textContent);
          }
        }
      }
    }

    expect(jsScripts.length).toBeGreaterThan(0);

    let hasPageRevealListener = false;
    let hasTypesAdd = false;
    let hasTypeAssignment = false;

    const project = new Project({ useInMemoryFileSystem: true });

    for (const jsStr of jsScripts) {
      const sourceFile = project.createSourceFile('temp.ts', jsStr);
      const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

      for (const call of calls) {
        const expr = call.getExpression();
        if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
          const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
          const name = propAccess.getName();

          if (name === 'addEventListener') {
            const args = call.getArguments();
            if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
              const eventName = args[0].asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
              if (eventName === 'pagereveal') {
                hasPageRevealListener = true;
              }
            }
          }

          if (name === 'add') {
            const baseExpr = propAccess.getExpression();
            if (baseExpr.getKind() === SyntaxKind.PropertyAccessExpression) {
              const basePropAccess = baseExpr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
              if (basePropAccess.getName() === 'types') {
                hasTypesAdd = true;
              }
            }
          }
        }
      }

      if (/\btype\s*=/.test(jsStr)) {
        hasTypeAssignment = true;
      }
    }

    expect(hasPageRevealListener).toBe(true);
    expect(hasTypesAdd).toBe(true);
    expect(hasTypeAssignment).toBe(false);
  });

  // --- BROWSER ASSERTIONS (E2E) ---
  test.describe('Browser tests', () => {
    
    test.beforeEach(async ({ page, TARGET_URL }) => {
      if (TARGET_URL.startsWith('http://localhost/')) {
        await page.route('http://localhost/*', async (route: any) => {
          const requestPath = new URL(route.request().url()).pathname;
          const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

          if (fs.existsSync(localFilePath)) {
            await route.fulfill({ path: localFilePath });
          } else {
            await route.continue();
          }
        });
      }
      
      await page.goto(TARGET_URL);
    });

    test('pagereveal listener dynamically adds transition types on navigation', async ({ page }) => {
      // 1. Mock window.navigation and trigger pagereveal for "next" direction
      const typesAddedNext = await page.evaluate(() => {
        const types: string[] = [];
        
        // Setup mock transition
        const mockTransition = {
          types: {
            add: (type: string) => {
              types.push(type);
            }
          }
        };

        // Inject navigation mock
        Object.defineProperty(window, 'navigation', {
          value: {
            activation: {
              from: { index: 0, url: 'http://localhost/page1' },
              entry: { index: 1, url: 'http://localhost/page2' },
              navigationType: 'push'
            }
          },
          configurable: true,
          writable: true
        });

        // Create and dispatch pagereveal event
        const event = new Event('pagereveal') as any;
        event.viewTransition = mockTransition;
        window.dispatchEvent(event);

        return types;
      });

      expect(typesAddedNext).toContain('next');
      expect(typesAddedNext).not.toContain('previous');

      // 2. Mock window.navigation and trigger pagereveal for "previous" direction
      const typesAddedPrev = await page.evaluate(() => {
        const types: string[] = [];
        
        const mockTransition = {
          types: {
            add: (type: string) => {
              types.push(type);
            }
          }
        };

        Object.defineProperty(window, 'navigation', {
          value: {
            activation: {
              from: { index: 1, url: 'http://localhost/page2' },
              entry: { index: 0, url: 'http://localhost/page1' },
              navigationType: 'traverse'
            }
          },
          configurable: true,
          writable: true
        });

        const event = new Event('pagereveal') as any;
        event.viewTransition = mockTransition;
        window.dispatchEvent(event);

        return types;
      });

      expect(typesAddedPrev).toContain('previous');
      expect(typesAddedPrev).not.toContain('next');
    });
  });
});
