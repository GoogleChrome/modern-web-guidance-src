import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

// NOTE: Add imports from ts-morph, linkedom, or cssomnom as needed:
// e.g. import { SyntaxKind, type Project } from 'ts-morph';
// e.g. import type { Document } from 'linkedom';
// e.g. import { getCascadedStyle, CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('<guide-name> Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---
  // Use static assertions to query DOM structure, attributes, CSS rules, and JavaScript syntax on the host.
  // These run instantly and are far more robust for structural verification than starting a browser.
  
  test('Example test containing HTML checks (linkedom)', () => {
    // EXAMPLE: DOM parsing using linkedom across HTML & component templates:
    // const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    // const targetEl = docs.map(d => d.document.querySelector('.target-element')).find(Boolean);
    // expect(targetEl).not.toBeUndefined();
  });

  test('Example test containing CSS checks (cssomnom)', () => {
    // EXAMPLE 1: Static CSS AST parsing across stylesheets, <style> tags, and inline styles:
    // const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    // const rules = Array.from(stylesheet.cssRules);
    // const targetRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.target-element');
    //
    // For utility-first apps (Tailwind), accept either CSS rules or template utility classes:
    // const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    // const hasDisplay = targetRule?.style.getPropertyValue('display') === 'flex'
    //   || docs.some(d => Boolean(d.document.querySelector('.flex, [class*="flex"]')));
    // expect(hasDisplay).toBe(true);
    //
    // EXAMPLE 2: Resolving cascaded styles against a Linkedom element without a browser:
    // const targetEl = docs.map(d => d.document.querySelector('.target-element')).find(Boolean);
    // if (targetEl) {
    //   const cascaded = getCascadedStyle(targetEl, rules);
    //   expect(cascaded.getPropertyValue('display')).toBe('flex');
    // }
  });

  test('Example test containing JS checks (ts-morph)', () => {
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
    // test('Example browser test containing computed style check', async ({ page }) => {
    //   const color = await page.$eval('.target', el => window.getComputedStyle(el).color);
    //   expect(color).toBe('rgb(255, 0, 0)');
    // });

    // EXAMPLE 2: Layout / Position checks using getBoundingClientRect
    // test('Example browser test containing layout check', async ({ page }) => {
    //   const pos = await page.evaluate(() => {
    //     const a = document.getElementById('a')!.getBoundingClientRect();
    //     const b = document.getElementById('b')!.getBoundingClientRect();
    //     return { aBottom: a.bottom, bTop: b.top };
    //   });
    //   expect(pos.bTop).toBeGreaterThanOrEqual(pos.aBottom);
    // });
  });
});
