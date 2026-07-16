import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';

// Resolve paths relative to the grader module directory using Node's import.meta.dirname
const targetFileEnv = process.env.TARGET_FILE;
if (!targetFileEnv) {
  throw new Error('TARGET_FILE environment variable not set.');
}
const filePath = path.isAbsolute(targetFileEnv)
  ? targetFileEnv
  : path.resolve(import.meta.dirname, targetFileEnv);
const targetDir = path.dirname(filePath);

const patchFileEnv = process.env.PATCH_FILE;
if (!patchFileEnv) {
  throw new Error('PATCH_FILE environment variable not set.');
}
const patchFile = path.isAbsolute(patchFileEnv)
  ? patchFileEnv
  : path.resolve(import.meta.dirname, patchFileEnv);

const targetFiles = extractTargetFilesFromPatch(patchFile);
const absoluteTargetFiles = targetFiles.map(f => path.join(targetDir, f));

// Helper to extract CSS from all modified CSS, HTML, and Astro files
function getCssContent(files: string[]): string {
  let cssContent = '';
  // CSS files
  const cssFiles = files.filter(f => f.endsWith('.css'));
  for (const file of cssFiles) {
    if (fs.existsSync(file)) {
      cssContent += fs.readFileSync(file, 'utf8') + String.fromCharCode(10);
    }
  }
  // Also look in HTML/Astro files for style tags
  const htmlFiles = files.filter(f => f.endsWith('.html') || f.endsWith('.astro'));
  for (const file of htmlFiles) {
    if (fs.existsSync(file)) {
      const htmlStr = fs.readFileSync(file, 'utf8');
      const { document } = parseHTML(htmlStr);
      const styles = document.querySelectorAll('style');
      for (const style of styles) {
        cssContent += style.textContent + String.fromCharCode(10);
      }
    }
  }
  return cssContent;
}

// Helper to extract nested media blocks from CSS
function getMediaBlocks(css: string): { query: string; content: string }[] {
  const blocks: { query: string; content: string }[] = [];
  let idx = 0;
  while (true) {
    idx = css.indexOf('@media', idx);
    if (idx === -1) break;
    const startIdx = idx;
    const braceStart = css.indexOf('{', startIdx);
    if (braceStart === -1) {
      idx += 6;
      continue;
    }
    const query = css.substring(startIdx, braceStart).trim();
    
    // Find matching closing brace for this media block
    let braceCount = 1;
    let pos = braceStart + 1;
    while (pos < css.length && braceCount > 0) {
      if (css[pos] === '{') braceCount++;
      else if (css[pos] === '}') braceCount--;
      pos++;
    }
    const content = css.substring(braceStart + 1, pos - 1);
    blocks.push({ query, content });
    idx = pos;
  }
  return blocks;
}

// Grader tests
test.describe('Cross-Document Transitions Grader', () => {

  // Test 1: @view-transition is defined with navigation: auto
  test('The @view-transition at-rule is defined with navigation: auto to enable cross-document transitions', () => {
    const css = getCssContent(absoluteTargetFiles);
    const cleanCss = css.replace(/\s+/g, ' ');
    const viewTransitionMatch = /@view-transition\s*\{([^}]*)\}/.exec(cleanCss);
    
    expect(viewTransitionMatch).not.toBeNull();
    const innerRules = viewTransitionMatch![1];
    expect(innerRules).toMatch(/\bnavigation\s*:\s*\bauto\b/);
  });

  // Test 2: @view-transition is wrapped in a prefers-reduced-motion: no-preference media query
  test('The @view-transition rule is wrapped in a prefers-reduced-motion: no-preference media query', () => {
    const css = getCssContent(absoluteTargetFiles);
    const mediaBlocks = getMediaBlocks(css);
    let hasNoPreferenceQuery = false;
    
    for (const block of mediaBlocks) {
      if (/\bprefers-reduced-motion\s*:\s*\bno-preference\b/.test(block.query)) {
        if (block.content.includes('@view-transition')) {
          hasNoPreferenceQuery = true;
        }
      }
    }
    expect(hasNoPreferenceQuery).toBe(true);
  });

  // Test 3: Custom animations defined using :active-view-transition-type()
  test('Custom animations are defined for different transition types using the :active-view-transition-type() pseudo-class', () => {
    const css = getCssContent(absoluteTargetFiles);
    const cleanCss = css.replace(/\s+/g, ' ');
    const hasActiveNext = /:active-view-transition-type\(\s*next\s*\)/.test(cleanCss);
    const hasActivePrev = /:active-view-transition-type\(\s*previous\s*\)/.test(cleanCss);
    
    expect(hasActiveNext).toBe(true);
    expect(hasActivePrev).toBe(true);
  });

  // Test 4: pagereveal event listener is added to the window to dynamically add transition types
  test('A pagereveal event listener is added to the window to dynamically add transition types to the viewTransition object', () => {
    const htmlFiles = absoluteTargetFiles.filter(f => f.endsWith('.html') || f.endsWith('.astro'));
    let inlineScripts = '';
    
    for (const file of htmlFiles) {
      if (!fs.existsSync(file)) continue;
      const htmlStr = fs.readFileSync(file, 'utf8');
      const { document } = parseHTML(htmlStr);
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        inlineScripts += (script.textContent || '') + String.fromCharCode(10);
      }
    }
    
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('temp.ts', inlineScripts);
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    let hasPageRevealListener = false;
    let hasTypesAddCall = false;
    
    for (const callExpr of callExpressions) {
      const expr = callExpr.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        const name = propAccess.getName();
        if (name === 'addEventListener') {
          const args = callExpr.getArguments();
          if (args.length > 0 && args[0].getText().replace(/['"`]/g, '') === 'pagereveal') {
            hasPageRevealListener = true;
          }
        } else if (name === 'add') {
          const expression = propAccess.getExpression();
          if (expression.getText().endsWith('.types')) {
            hasTypesAddCall = true;
          }
        }
      }
    }
    
    expect(hasPageRevealListener).toBe(true);
    expect(hasTypesAddCall).toBe(true);
  });

  // Test 5: Page-level transition animations use ::view-transition-old(root) and ::view-transition-new(root)
  test('The page-level transition animations use ::view-transition-old(root) and ::view-transition-new(root) to create slide or fade effects', () => {
    const css = getCssContent(absoluteTargetFiles);
    const cleanCss = css.replace(/\s+/g, ' ');
    const hasOldRoot = /::view-transition-old\(\s*root\s*\)/.test(cleanCss);
    const hasNewRoot = /::view-transition-new\(\s*root\s*\)/.test(cleanCss);
    
    expect(hasOldRoot).toBe(true);
    expect(hasNewRoot).toBe(true);
  });

});
