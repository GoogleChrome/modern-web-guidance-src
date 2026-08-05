import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { Project } from 'ts-morph';

// Setup target workspace details
const patchFile = process.env.PATCH_FILE;
if (!patchFile) {
  throw new Error('PATCH_FILE environment variable not set.');
}

const rootDir = process.cwd();
const targetFiles = extractTargetFilesFromPatch(patchFile);
const absoluteTargetFiles = targetFiles.map((f: string) => path.resolve(rootDir, f));

// --- HELPER UTILITIES FOR EMBEDDED & STANDALONE CODE ---
const HTML_EXTS = /\.(html|htm|astro)$/i;
const CSS_EXTS = /\.css$/i;
const JS_EXTS = /\.(js|ts|tsx|jsx)$/i;

/**
 * Extracts all CSS code across standalone stylesheets (.css),
 * HTML/Astro <style> tags, and inline style="..." attributes.
 */
export function extractAllCss(files: string[]): string[] {
  const cssBlocks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (CSS_EXTS.test(file)) {
      cssBlocks.push(content);
    } else if (HTML_EXTS.test(file)) {
      try {
        const { document } = parseHTML(content);
        document.querySelectorAll('style').forEach((style: any) => {
          if (style.textContent) cssBlocks.push(style.textContent);
        });
        document.querySelectorAll('[style]').forEach((el: any) => {
          const inlineStyle = el.getAttribute('style');
          if (inlineStyle) cssBlocks.push(inlineStyle);
        });
      } catch {
        const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatches) cssBlocks.push(...styleMatches);
      }
    }
  }
  return cssBlocks;
}

/**
 * Adds JavaScript/TypeScript code to a ts-morph Project from standalone JS/TS/TSX files,
 * Astro frontmatter (---), and HTML/Astro <script> tags.
 */
export function populateJsProject(project: Project, files: string[]): void {
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (JS_EXTS.test(file) && !HTML_EXTS.test(file)) {
      project.createSourceFile(file, content, { overwrite: true });
    } else if (HTML_EXTS.test(file)) {
      try {
        if (file.endsWith('.astro')) {
          const frontmatter = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
          if (frontmatter && frontmatter[1]) {
            project.createSourceFile(`${file}_frontmatter.ts`, frontmatter[1], { overwrite: true });
          }
        }
        const { document } = parseHTML(content);
        document.querySelectorAll('script').forEach((script: any, idx: number) => {
          if (script.textContent) {
            project.createSourceFile(`${file}_script_${idx}.ts`, script.textContent, { overwrite: true });
          }
        });
      } catch {
        // Fallback for non-standard HTML fragments
      }
    }
  }
}

/**
 * Parses HTML and Astro template files into Linkedom DOM document objects.
 */
export function getHtmlDocuments(files: string[]): Array<{ file: string; document: any }> {
  const docs: Array<{ file: string; document: any }> = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    if (HTML_EXTS.test(file)) {
      const content = fs.readFileSync(file, 'utf8');
      docs.push({ file, document: parseHTML(content).document });
    }
  }
  return docs;
}

// Grader tests
test.describe('size-aware-styling Target Grader', () => {

  test('HTML component template contains container or wrapper element', () => {
    const docs = getHtmlDocuments(absoluteTargetFiles);
    const hasWrapper = docs.some(d => d.document.querySelector('.card-container, [class*="container"], article, div') !== null);
    expect(hasWrapper).toBe(true);
  });

  test('CSS defines container-type property as inline-size or size', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasContainerType = /\bcontainer(-type)?\s*:[^;}]*\b(inline-size|size)\b/i.test(cleanCss);
    expect(hasContainerType).toBe(true);
  });

  test('CSS contains @container query rule for size-aware styling', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasContainerQuery = /@container\b/i.test(cleanCss);
    expect(hasContainerQuery).toBe(true);
  });

  test('CSS @container query specifies a width threshold condition', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasWidthThreshold = /@container\b[^{]*\b(min-width|max-width|width|inline-size)\b/i.test(cleanCss);
    expect(hasWidthThreshold).toBe(true);
  });

  test('CSS @container query defines layout properties for responsive changes', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasLayoutChanges = /@container[^{]+\{[^}]*\b(flex-direction|grid-template|display|width|columns|flex-flow)\b/i.test(cleanCss);
    expect(hasLayoutChanges).toBe(true);
  });

  test('CSS provides a default layout before container query overrides', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasDefaultLayout = /\b(display\s*:\s*(flex|grid|block)|flex-direction\s*:\s*(column|row))\b/i.test(cleanCss);
    expect(hasDefaultLayout).toBe(true);
  });

  test('CSS includes @media queries or @supports rules for browser fallback', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasFallback = /(@media|@supports)\b/i.test(cleanCss);
    expect(hasFallback).toBe(true);
  });

});
