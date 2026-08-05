import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';

// Setup target workspace details
const patchFile = process.env.PATCH_FILE;
if (!patchFile) {
  throw new Error('PATCH_FILE environment variable not set.');
}

const rootDir = process.cwd();
const BASE_APP_DEFAULT_FILES: Record<string, string[]> = {
  'daily-grind': ['index.html'],
  'devtools-times': [
    'src/components/ArticleTeaser.astro',
    'src/layouts/Layout.astro',
    'src/styles/global.css',
    'src/components/SearchFlyout.tsx',
    'src/components/ReadingListFlyout.tsx',
  ],
};

const graderDir = path.dirname(fileURLToPath(import.meta.url));
const baseAppName = path.basename(graderDir);
const patchTargetFiles = extractTargetFilesFromPatch(patchFile);
const defaultFiles = BASE_APP_DEFAULT_FILES[baseAppName] || [];
const targetFiles = Array.from(new Set([...patchTargetFiles, ...defaultFiles]));
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
    } else if (JS_EXTS.test(file)) {
      const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) {
        for (const match of styleMatches) {
          cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
        }
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
test.describe('Daily Grind Size-Aware Styling Target Grader', () => {
  test('CSS applies container-type inline-size or size to a container element', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    expect(/container(-type)?\s*:[^;]*\b(inline-size|size)\b/i.test(cleanCss)).toBe(true);
  });

  test('CSS uses @container queries conditioned on width', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    expect(/@container\s+[^{]*\((min-|max-)?width\s*:/i.test(cleanCss)).toBe(true);
  });

  test('CSS modifies layout properties within @container query rules', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    expect(/@container\s+[^{]*\([^)]*width[^)]*\)\s*\{[^}]*\b(flex-direction|grid-template|display)\b/i.test(cleanCss)).toBe(true);
  });

  test('CSS provides media query or @supports fallbacks for browser compatibility', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    expect(/(@media\s*\([^)]*width|@supports\s*\([^)]*container)/i.test(cleanCss)).toBe(true);
  });

  test('CSS defines a default flex or grid layout structure on card components', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    expect(/\.card\s*\{[^}]*\bdisplay\s*:\s*(flex|grid)\b/i.test(cleanCss)).toBe(true);
  });
});
