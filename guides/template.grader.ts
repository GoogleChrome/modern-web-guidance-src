import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

// NOTE: Add imports from ts-morph or linkedom as needed:
// e.g. import { SyntaxKind, type Project } from 'ts-morph';
// e.g. import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('<guide-name> Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---
  // Use static assertions to query DOM structure, attributes, and JavaScript syntax on the host.
  // These run instantly and are far more robust for structural verification than starting a browser.
  
  test('HTML structure satisfies guide requirements (linkedom)', () => {
    // EXAMPLE: DOM parsing using linkedom across HTML & component templates:
    // const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    // const targetEl = docs.map(d => d.document.querySelector('.target-element')).find(Boolean);
    // expect(targetEl).not.toBeUndefined();
  });

  // TODO: Future CSSOMNom OSPO integration - update this CSS test example to use CSSOMNom AST parsing when cssomnom is enabled.
  test('CSS styles satisfy guide requirements (Regex)', () => {
    // EXAMPLE: Static CSS checks across stylesheets, <style> tags, and inline styles:
    // const cleanCss: string = extractAllCss(targetFiles);
    // expect(cleanCss).toMatch(/your-css-pattern/i);
  });

  test('JavaScript source satisfies guide requirements (ts-morph)', () => {
    // EXAMPLE: JavaScript AST parsing using ts-morph across JS/TS files and <script> tags:
    // const project: Project = getJsProject(targetFiles);
    // const functionDecls = project.getSourceFiles().flatMap(sf =>
    //   sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
    // );
    // const hasTargetFunction = functionDecls.some(fn => fn.getName() === 'yourFunctionName');
    // expect(hasTargetFunction).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---
  // Use browser assertions ONLY for requirements that cannot be verified statically, such as runtime click events or dynamic state updates.
  // If browser assertions are not needed, this entire `test.describe('Browser tests', ...)` section should be omitted.
  
  test.describe('Browser tests', () => {
    
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    // EXAMPLE 1: Checking computed styles
    // test('target element has correct computed color', async ({ page }) => {
    //   const color = await page.$eval('.target', el => window.getComputedStyle(el).color);
    //   expect(color).toBe('rgb(255, 0, 0)');
    // });

    // EXAMPLE 2: Layout / Position checks using getBoundingClientRect
    // test('element B is positioned below element A', async ({ page }) => {
    //   const pos = await page.evaluate(() => {
    //     const a = document.getElementById('a')!.getBoundingClientRect();
    //     const b = document.getElementById('b')!.getBoundingClientRect();
    //     return { aBottom: a.bottom, bTop: b.top };
    //   });
    //   expect(pos.bTop).toBeGreaterThanOrEqual(pos.aBottom);
    // });
  });
});
