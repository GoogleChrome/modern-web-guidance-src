import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';

// Setup target workspace details
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);

const patchFile = process.env.PATCH_FILE;
if (!patchFile) {
  throw new Error('PATCH_FILE environment variable not set.');
}

const targetFiles = extractTargetFilesFromPatch(patchFile);
const absoluteTargetFiles = targetFiles.map(f => path.join(targetDir, f));

// CSS Rule Parser Interfaces
interface CssRule {
  selector: string;
  body: string;
  parents: string[];
}

// Simple CSS parser to extract selectors, bodies and query wrappers
function parseCssRules(css: string, parents: string[] = []): CssRule[] {
  // Remove comments
  let cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
  cleanCss = cleanCss.replace(/\s+/g, ' ');
  
  const rules: CssRule[] = [];
  let depth = 0;
  let currentSelector = '';
  let currentBody = '';
  let inBody = false;
  
  for (let i = 0; i < cleanCss.length; i++) {
    const char = cleanCss[i];
    if (char === '{') {
      if (depth === 0) {
        inBody = true;
      } else {
        currentBody += char;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        inBody = false;
        const selector = currentSelector.trim();
        const body = currentBody.trim();
        rules.push({ selector, body, parents });
        
        if (body.includes('{')) {
          rules.push(...parseCssRules(body, [...parents, selector]));
        }
        
        currentSelector = '';
        currentBody = '';
      } else {
        currentBody += char;
      }
    } else {
      if (inBody) {
        currentBody += char;
      } else {
        currentSelector += char;
      }
    }
  }
  return rules;
}

// Helper to gather all CSS content from target files
function getAllCssContent(files: string[]): string {
  let cssContent = '';
  // First, check modified files
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    if (!fs.statSync(file).isFile()) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.css')) {
      cssContent += '\n' + content;
    } else if (file.endsWith('.html') || file.endsWith('.astro')) {
      const { document } = parseHTML(content);
      const styles = document.querySelectorAll('style');
      for (const style of styles) {
        cssContent += '\n' + style.textContent;
      }
    }
  }
  return cssContent;
}

// Grader tests
test.describe('Daily Grind Size-Aware Styling Grader', () => {
  let cssRules: CssRule[] = [];
  let htmlDocuments: { path: string; document: any }[] = [];

  test.beforeAll(() => {
    // Gather CSS content from modified files.
    // If no CSS files are modified, gather from the workspace CSS/HTML files.
    let cssContent = getAllCssContent(absoluteTargetFiles);
    if (!cssContent.trim()) {
      const allWorkspaceFiles = fs.readdirSync(targetDir).map(f => path.join(targetDir, f));
      cssContent = getAllCssContent(allWorkspaceFiles);
    }
    cssRules = parseCssRules(cssContent);

    // Gather HTML documents
    let htmlFiles = absoluteTargetFiles.filter(f => f.endsWith('.html') || f.endsWith('.astro'));
    if (htmlFiles.length === 0) {
      htmlFiles = fs.readdirSync(targetDir)
        .filter(f => f.endsWith('.html') || f.endsWith('.astro'))
        .map(f => path.join(targetDir, f));
    }

    for (const file of htmlFiles) {
      if (!fs.existsSync(file)) continue;
      const htmlStr = fs.readFileSync(file, 'utf8');
      const { document } = parseHTML(htmlStr);
      htmlDocuments.push({ path: file, document });
    }
  });

  test('Expectation 1: The component wrapper has container-type: inline-size (or size) applied', () => {
    // 1. Identify container selectors in CSS
    const containerRules = cssRules.filter(r => 
      /\bcontainer-type\s*:\s*(inline-size|size)\b/.test(r.body) ||
      /\bcontainer\s*:\s*[^;}]*\/\s*(inline-size|size)\b/.test(r.body)
    );
    expect(containerRules.length).toBeGreaterThan(0);

    // 2. Verify that card components in the HTML are descendants of one of these container selectors
    let matchedCardWithContainer = false;
    for (const { document } of htmlDocuments) {
      const cards = document.querySelectorAll('.card');
      if (cards.length === 0) continue;

      for (const card of cards) {
        let current = card.parentElement;
        while (current) {
          for (const rule of containerRules) {
            try {
              if (current.matches(rule.selector)) {
                matchedCardWithContainer = true;
                break;
              }
            } catch (e) {
              // Fallback for simple class selectors if matches() fails/throws on complex selectors
              if (rule.selector.startsWith('.') && current.classList.contains(rule.selector.slice(1))) {
                matchedCardWithContainer = true;
                break;
              }
            }
          }
          if (matchedCardWithContainer) break;
          current = current.parentElement;
        }
        if (matchedCardWithContainer) break;
      }
    }

    expect(matchedCardWithContainer).toBe(true);
  });

  test('Expectation 2: The component uses @container queries to apply different styles based on the container\'s width', () => {
    // Check if there are @container query rules targeting the card component (or its descendants)
    const cardClassRegex = /\.card\b(?!-)/;
    const containerQueryRules = cssRules.filter(r => 
      r.parents.some(p => p.startsWith('@container')) &&
      cardClassRegex.test(r.selector)
    );

    expect(containerQueryRules.length).toBeGreaterThan(0);
  });

  test('Expectation 3: The component changes layout when the container width crosses a specific threshold', () => {
    const cardClassRegex = /\.card\b(?!-)/;
    const containerQueryRules = cssRules.filter(r => 
      r.parents.some(p => p.startsWith('@container')) &&
      cardClassRegex.test(r.selector)
    );

    expect(containerQueryRules.length).toBeGreaterThan(0);

    // Verify at least one of these container query rules targets width and changes layout
    let changesLayout = false;
    const layoutProperties = /\b(flex-direction|display|grid-template|grid-column|flex|float|align-items|justify-content)\b/;

    for (const r of containerQueryRules) {
      // Find the parent @container selector
      const containerParent = r.parents.find(p => p.startsWith('@container'));
      if (!containerParent) continue;

      // Check if the container query checks width (e.g. min-width or max-width or width)
      const checksWidth = /\b(min-width|max-width|width)\b/.test(containerParent);
      const modifiesLayout = layoutProperties.test(r.body);

      if (checksWidth && modifiesLayout) {
        changesLayout = true;
        break;
      }
    }

    expect(changesLayout).toBe(true);
  });

  test('Expectation 4: A fallback strategy using media queries or a default safe layout is provided for browsers that do not support container queries', () => {
    const cardClassRegex = /\.card\b(?!-)/;
    
    // We must have implemented container queries first
    const containerRules = cssRules.filter(r => 
      /\bcontainer-type\s*:\s*(inline-size|size)\b/.test(r.body) ||
      /\bcontainer\s*:\s*[^;}]*\/\s*(inline-size|size)\b/.test(r.body)
    );
    expect(containerRules.length).toBeGreaterThan(0);

    // 1. Check if they use media query fallback
    const mediaRulesForCard = cssRules.filter(r => 
      cardClassRegex.test(r.selector) &&
      r.parents.some(p => p.startsWith('@media')) &&
      !r.parents.some(p => p.startsWith('@supports') && p.includes('container-type'))
    );

    if (mediaRulesForCard.length > 0) {
      // If media queries are used as fallback, they must be overridden under @supports (container-type...)
      // so container queries take control on supporting browsers.
      const hasMediaOverride = cssRules.some(r => 
        cardClassRegex.test(r.selector) &&
        r.parents.some(p => p.startsWith('@supports') && p.includes('container-type')) &&
        r.parents.some(p => p.startsWith('@media'))
      );
      expect(hasMediaOverride).toBe(true);
    } else {
      // 2. If no media query fallback, they must rely on default safe layout (stacked)
      const defaultCardRules = cssRules.filter(r => 
        cardClassRegex.test(r.selector) &&
        r.parents.length === 0
      );

      let isDefaultLayoutSafe = true;
      for (const r of defaultCardRules) {
        if (/\bdisplay\s*:\s*flex\b/.test(r.body)) {
          if (!/\bflex-direction\s*:\s*column\b/.test(r.body)) {
            isDefaultLayoutSafe = false;
          }
        }
        if (/\bdisplay\s*:\s*grid\b/.test(r.body)) {
          if (/\bgrid-template-columns\s*:\s*[^;}]*\b[2-9]\b/.test(r.body) || /\bgrid-template-columns\s*:\s*repeat\(\s*[2-9]/.test(r.body)) {
            isDefaultLayoutSafe = false;
          }
        }
      }
      expect(isDefaultLayoutSafe).toBe(true);
    }
  });
});
