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

// Sandbox Patch Resolution
const absolutePatchPath = path.isAbsolute(patchFile)
  ? patchFile
  : path.resolve(import.meta.dirname, patchFile);

const targetFiles = extractTargetFilesFromPatch(absolutePatchPath);
const absoluteTargetFiles = targetFiles.map(f => path.join(targetDir, f));

function extractAllRules(css: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  const normalized = css
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove comments
    .replace(/@[a-zA-Z-]+\s+[^;{]+;/g, '') // remove at-rules without bodies
    .replace(/\s+/g, ' '); // collapse whitespace
  
  let i = 0;
  while (i < normalized.length) {
    const openBrace = normalized.indexOf('{', i);
    if (openBrace === -1) break;
    
    const selectorText = normalized.substring(i, openBrace).trim();
    
    let braceCount = 1;
    let j = openBrace + 1;
    for (; j < normalized.length; j++) {
      if (normalized[j] === '{') braceCount++;
      else if (normalized[j] === '}') {
        braceCount--;
        if (braceCount === 0) {
          break;
        }
      }
    }
    
    if (braceCount === 0) {
      const body = normalized.substring(openBrace + 1, j).trim();
      
      if (selectorText.startsWith('@')) {
        rules.push(...extractAllRules(body));
      } else {
        rules.push({ selector: selectorText, body });
      }
      i = j + 1;
    } else {
      break;
    }
  }
  return rules;
}

function extractBlocks(css: string, keyword: string): string[] {
  const blocks: string[] = [];
  const normalized = css.replace(/\/\*[\s\S]*?\*\//g, ''); // remove comments
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9_-])${keyword}\\b`, 'g');
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const startIndex = match.index;
    const openBrace = normalized.indexOf('{', startIndex);
    if (openBrace === -1) continue;
    
    let braceCount = 1;
    let i = openBrace + 1;
    for (; i < normalized.length; i++) {
      if (normalized[i] === '{') braceCount++;
      else if (normalized[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          break;
        }
      }
    }
    
    if (braceCount === 0) {
      blocks.push(normalized.substring(startIndex, i + 1));
      regex.lastIndex = i + 1;
    }
  }
  return blocks;
}

function getAllCssContent(files: string[]): string {
  let cssCombined = '';
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.css')) {
      cssCombined += '\n' + content;
    } else if (file.endsWith('.astro') || file.endsWith('.html')) {
      const { document } = parseHTML(content);
      const styleTags = document.querySelectorAll('style');
      for (const styleTag of styleTags) {
        cssCombined += '\n' + styleTag.textContent;
      }
    }
  }
  return cssCombined;
}

// Grader tests
test.describe('Size-Aware Styling Grader', () => {

  test('Component wrapper has container-type: inline-size or size applied', () => {
    let hasWrapper = false;
    const cssContent = getAllCssContent(absoluteTargetFiles);
    
    for (const file of absoluteTargetFiles) {
      if (!fs.existsSync(file)) continue;
      if (!file.endsWith('.astro') && !file.endsWith('.html')) continue;
      
      const htmlStr = fs.readFileSync(file, 'utf8');
      const { document } = parseHTML(htmlStr);
      
      // 1. Tailwind class check
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const classes = el.getAttribute('class') || '';
        if (/(?:^|\s)@container\b/.test(classes)) {
          hasWrapper = true;
          break;
        }
        
        // 2. Inline style check
        const style = el.getAttribute('style') || '';
        if (/\bcontainer(-type)?\s*:\s*([^/]*\/)?\s*(inline-size|size)\b/.test(style)) {
          hasWrapper = true;
          break;
        }
      }
      
      if (hasWrapper) break;
      
      // 3. CSS stylesheet / style block rule check
      const rules = extractAllRules(cssContent);
      for (const rule of rules) {
        if (/\bcontainer(-type)?\s*:\s*([^/]*\/)?\s*(inline-size|size)\b/.test(rule.body)) {
          const selector = rule.selector
            .replace(/:[a-zA-Z-]+(\([^)]*\))?/g, '')
            .replace(/::[a-zA-Z-]+/g, '')
            .trim();
          if (selector) {
            try {
              if (document.querySelector(selector)) {
                hasWrapper = true;
                break;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }
      if (hasWrapper) break;
    }
    
    expect(hasWrapper).toBe(true);
  });

  test('Component uses @container queries or container-query classes', () => {
    let hasQuery = false;
    
    for (const file of absoluteTargetFiles) {
      if (!fs.existsSync(file)) continue;
      if (!file.endsWith('.astro') && !file.endsWith('.html')) continue;
      
      const htmlStr = fs.readFileSync(file, 'utf8');
      const { document } = parseHTML(htmlStr);
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const classes = el.getAttribute('class') || '';
        if (/(?:^|\s)@(?:[a-z0-9]+|\[[^\]]+\]):[a-zA-Z0-9-]+/.test(classes)) {
          hasQuery = true;
          break;
        }
      }
      if (hasQuery) break;
    }
    
    if (!hasQuery) {
      const cssContent = getAllCssContent(absoluteTargetFiles);
      const blocks = extractBlocks(cssContent, '@container');
      for (const block of blocks) {
        const openBrace = block.indexOf('{');
        if (openBrace === -1) continue;
        const header = block.substring(0, openBrace);
        if (/\b(width|inline-size)\b/.test(header)) {
          hasQuery = true;
          break;
        }
      }
    }
    
    expect(hasQuery).toBe(true);
  });

  test('Component changes layout inside the container query', () => {
    let hasLayoutChange = false;
    
    for (const file of absoluteTargetFiles) {
      if (!fs.existsSync(file)) continue;
      if (!file.endsWith('.astro') && !file.endsWith('.html')) continue;
      
      const htmlStr = fs.readFileSync(file, 'utf8');
      const { document } = parseHTML(htmlStr);
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const classes = el.getAttribute('class') || '';
        if (/(?:^|\s)@(?:[a-z0-9]+|\[[^\]]+\]):(flex-row|flex-col|flex|grid|block|inline-flex|inline-grid|grid-cols-[a-zA-Z0-9-]+|grid-rows-[a-zA-Z0-9-]+|float-[a-z]+|hidden)\b/.test(classes)) {
          hasLayoutChange = true;
          break;
        }
      }
      if (hasLayoutChange) break;
    }
    
    if (!hasLayoutChange) {
      const cssContent = getAllCssContent(absoluteTargetFiles);
      const blocks = extractBlocks(cssContent, '@container');
      for (const block of blocks) {
        const openBrace = block.indexOf('{');
        if (openBrace === -1) continue;
        const header = block.substring(0, openBrace);
        if (!/\b(width|inline-size)\b/.test(header)) continue;
        
        const body = block.substring(openBrace + 1, block.length - 1);
        const innerRules = extractAllRules(body);
        for (const rule of innerRules) {
          if (
            /\bflex-direction\s*:\s*(row|row-reverse|column|column-reverse)\b/.test(rule.body) ||
            /\bflex-flow\s*:\s*(row|row-reverse|column|column-reverse)\b/.test(rule.body) ||
            /\bgrid-template(-columns|-areas|-rows)?\s*:/.test(rule.body) ||
            /\bgrid-auto-flow\s*:\s*(column|row)\b/.test(rule.body) ||
            /\bdisplay\s*:\s*(grid|flex|inline-grid|inline-flex|block|hidden|none)\b/.test(rule.body) ||
            /\bfloat\s*:\s*(left|right)\b/.test(rule.body)
          ) {
            hasLayoutChange = true;
            break;
          }
        }
        if (hasLayoutChange) break;
      }
    }
    
    expect(hasLayoutChange).toBe(true);
  });

  test('Fallback strategy or default safe layout is provided', () => {
    let hasFallback = false;
    const cssContent = getAllCssContent(absoluteTargetFiles);
    
    const supportsBlocks = extractBlocks(cssContent, '@supports');
    for (const block of supportsBlocks) {
      const openBrace = block.indexOf('{');
      if (openBrace === -1) continue;
      const header = block.substring(0, openBrace);
      if (/\b(container-type|container)\b/.test(header)) {
        hasFallback = true;
        break;
      }
    }
    
    if (!hasFallback) {
      const mediaBlocks = extractBlocks(cssContent, '@media');
      for (const block of mediaBlocks) {
        const openBrace = block.indexOf('{');
        if (openBrace === -1) continue;
        const body = block.substring(openBrace + 1, block.length - 1);
        const innerRules = extractAllRules(body);
        for (const rule of innerRules) {
          if (
            /\bflex-direction\s*:\s*(row|row-reverse)\b/.test(rule.body) ||
            /\bgrid-template(-columns|-areas|-rows)?\s*:/.test(rule.body) ||
            /\bdisplay\s*:\s*(grid|flex)\b/.test(rule.body)
          ) {
            hasFallback = true;
            break;
          }
        }
        if (hasFallback) break;
      }
    }
    
    if (!hasFallback) {
      for (const file of absoluteTargetFiles) {
        if (!fs.existsSync(file)) continue;
        if (!file.endsWith('.astro') && !file.endsWith('.html')) continue;
        
        const htmlStr = fs.readFileSync(file, 'utf8');
        const { document } = parseHTML(htmlStr);
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const classes = el.getAttribute('class') || '';
          if (/(?:^|\s)@container\b/.test(classes)) {
            hasFallback = true;
            break;
          }
        }
        if (hasFallback) break;
      }
    }
    
    if (!hasFallback) {
      const rules = extractAllRules(cssContent);
      for (const rule of rules) {
        if (/\bflex-direction\s*:\s*(column|column-reverse)\b/.test(rule.body)) {
          hasFallback = true;
          break;
        }
      }
    }
    
    expect(hasFallback).toBe(true);
  });
});
