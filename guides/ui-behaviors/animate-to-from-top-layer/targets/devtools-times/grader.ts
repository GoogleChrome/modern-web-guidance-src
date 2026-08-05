import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';
import { Project } from 'ts-morph';

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
const rawTargetFiles = extractTargetFilesFromPatch(patchFile);
const patchTargetFiles = rawTargetFiles.map((f: string) => f.replace(/^b\//, ''));
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
        if (styleMatches) styleMatches.forEach((s: string) => cssBlocks.push(s));
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

// Grader test suite for top-layer animation requirements
test.describe('Animate To/From Top Layer Target Grader', () => {

  test('<dialog> element uses @starting-style at-rule for entry animation', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasDialogStartingStyle = /@starting-style/i.test(cleanCss) &&
      (/\bdialog\b[\s\S]{0,500}?@starting-style|@starting-style[\s\S]{0,500}?\bdialog\b/i.test(cleanCss));
    expect(hasDialogStartingStyle).toBe(true);
  });

  test('[popover] element uses @starting-style at-rule for entry animation', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasPopoverStartingStyle = /@starting-style/i.test(cleanCss) &&
      (/\bpopover\b[\s\S]{0,500}?@starting-style|@starting-style[\s\S]{0,500}?\bpopover\b/i.test(cleanCss));
    expect(hasPopoverStartingStyle).toBe(true);
  });

  test('discrete transition property specifies allow-discrete keyword', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasAllowDiscrete = /\ballow-discrete\b/i.test(cleanCss) &&
      (/\bdialog\b|\bpopover\b/i.test(cleanCss));
    expect(hasAllowDiscrete).toBe(true);
  });

  test('<dialog> and [popover] include display in transition property list or shorthand', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasDisplayTransition = /(transition|transition-property)[^{}]*\bdisplay\b/i.test(cleanCss);
    expect(hasDisplayTransition).toBe(true);
  });

  test('<dialog> and [popover] include overlay in transition property list or shorthand', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasOverlayTransition = /(transition|transition-property)[^{}]*\boverlay\b/i.test(cleanCss);
    expect(hasOverlayTransition).toBe(true);
  });

  test('<dialog> defines transition styles for its open state', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasDialogOpenState = /dialog[^{}]*\[open\]|dialog[^{}]*:open|&\[open\]/i.test(cleanCss);
    expect(hasDialogOpenState).toBe(true);
  });

  test('[popover] defines transition styles for its open state', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasPopoverOpenState = /:popover-open|popover[^{}]*\[open\]|&:popover-open/i.test(cleanCss);
    expect(hasPopoverOpenState).toBe(true);
  });

  test('<dialog> and [popover] define transition properties for base closed state', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasBaseTransition = /\bdialog\b[\s\S]{0,300}?(transition|transition-property)|\bpopover\b[\s\S]{0,300}?(transition|transition-property)/i.test(cleanCss);
    expect(hasBaseTransition).toBe(true);
  });

  test('::backdrop pseudo-element for <dialog> includes transition properties', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasBackdropTransition = /::backdrop[^{}]*\{[^{}]*(transition|transition-property)/i.test(cleanCss);
    expect(hasBackdropTransition).toBe(true);
  });

  test('implementation respects prefers-reduced-motion media query', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const hasReducedMotion = /@media[^{}]*prefers-reduced-motion/i.test(cleanCss);
    expect(hasReducedMotion).toBe(true);
  });

  test('components implement HTML <dialog> element for modal UI', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    populateJsProject(project, absoluteTargetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasDialogComponent = sourceFiles.some(sf =>
      /<dialog\b|\bshowModal\b|\bclose\(\)/i.test(sf.getText())
    );
    expect(hasDialogComponent).toBe(true);
  });

  test('components implement popover attribute for top-layer popover UI', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    populateJsProject(project, absoluteTargetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasPopoverComponent = sourceFiles.some(sf =>
      /\bpopover\b|\bshowPopover\b|\bhidePopover\b/i.test(sf.getText())
    );
    expect(hasPopoverComponent).toBe(true);
  });
});
