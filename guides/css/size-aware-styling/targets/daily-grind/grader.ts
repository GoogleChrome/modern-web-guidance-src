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
let absoluteTargetFiles = targetFiles.map((f: string) => path.resolve(rootDir, f));

// If patch touches no files (e.g. zero-passrate patch), fall back to inspecting workspace files
if (absoluteTargetFiles.length === 0) {
  const defaultFiles = ['index.html', 'styles.css', 'style.css'];
  absoluteTargetFiles = defaultFiles
    .map((f) => path.resolve(rootDir, f))
    .filter((f) => fs.existsSync(f));
}

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

/**
 * Extracts block contents for @container rules by tracking matching braces.
 */
function extractContainerBlocks(css: string): string[] {
  const blocks: string[] = [];
  const regex = /@container\b/gi;
  let match;
  while ((match = regex.exec(css)) !== null) {
    const startIndex = match.index;
    let braceCount = 0;
    let started = false;
    let endIndex = css.length;
    for (let i = startIndex; i < css.length; i++) {
      if (css[i] === '{') {
        braceCount++;
        started = true;
      } else if (css[i] === '}') {
        braceCount--;
      }
      if (started && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
    if (started) {
      blocks.push(css.slice(startIndex, endIndex));
    }
  }
  return blocks;
}

// Grader tests for size-aware-styling
test.describe('size-aware-styling Target Grader', () => {

  test('Component wrapper defines container-type as inline-size or size', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasContainerType = /\bcontainer-type\s*:\s*(inline-size|size)\b|\bcontainer\s*:\s*[^;}]*\b(inline-size|size)\b/i.test(cleanCss);
    expect(hasContainerType).toBe(true);
  });

  test('CSS defines @container queries for container-width based styles', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasContainerQuery = /@container\s+[^{]*\([^)]*\b(min-width|max-width|width|inline-size)\b/i.test(cleanCss);
    expect(hasContainerQuery).toBe(true);
  });

  test('Component changes layout properties within @container query at width threshold', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const containerBlocks = extractContainerBlocks(cleanCss);
    const hasLayoutChange = containerBlocks.some((block) =>
      /\([^)]*\b(min-width|max-width|width|inline-size)\b[^)]*\)/i.test(block) &&
      /\b(flex-direction|grid-template|grid-auto|display|justify-content|align-items|flex|columns)\b/i.test(block)
    );
    expect(hasLayoutChange).toBe(true);
  });

  test('Provides media query or @supports fallback strategy for browsers without container queries', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasFallbackStrategy =
      /@media\s*\([^)]*\b(min-width|max-width|width)\b[^)]*\)/i.test(cleanCss) ||
      /@supports\s*\([^)]*container/i.test(cleanCss);
    expect(hasFallbackStrategy).toBe(true);
  });

});
