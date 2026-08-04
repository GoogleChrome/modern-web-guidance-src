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

/**
 * Extracts all CSS code across standalone stylesheets (.css),
 * HTML/Astro <style> tags, and inline style="..." attributes.
 */
export function extractAllCss(files: string[]): string[] {
  const cssBlocks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (/\.css$/i.test(file)) {
      cssBlocks.push(content);
    } else if (/\.(html|htm|astro)$/i.test(file)) {
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

    if (/\.(js|ts|tsx|jsx)$/i.test(file) && !/\.(html|htm|astro)$/i.test(file)) {
      project.createSourceFile(file, content, { overwrite: true });
    } else if (/\.(html|htm|astro)$/i.test(file)) {
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
    if (/\.(html|htm|astro)$/i.test(file)) {
      const content = fs.readFileSync(file, 'utf8');
      docs.push({ file, document: parseHTML(content).document });
    }
  }
  return docs;
}

test.describe('Animate To/From Top Layer Target Grader', () => {

  test('HTML contains a <dialog> element', () => {
    const docs = getHtmlDocuments(absoluteTargetFiles);
    const hasDialog = docs.some(d => d.document.querySelector('dialog') !== null);
    expect(hasDialog).toBe(true);
  });

  test('HTML contains a [popover] element', () => {
    const docs = getHtmlDocuments(absoluteTargetFiles);
    const hasPopover = docs.some(d => d.document.querySelector('[popover]') !== null);
    expect(hasPopover).toBe(true);
  });

  test('<dialog> uses @starting-style for entry animation', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasDialogStartingStyle =
      /@starting-style\s*\{[^}]*\bdialog\b/i.test(cleanCss) ||
      /(?:^|[\s{},])dialog\b[^{]*\{[^{}]*@starting-style/i.test(cleanCss);
    expect(hasDialogStartingStyle).toBe(true);
  });

  test('[popover] uses @starting-style for entry animation', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasPopoverStartingStyle =
      /@starting-style\s*\{[^}]*popover/i.test(cleanCss) ||
      /(?:^|[\s{},])(?:\[?popover\]?|:popover-open)[^{]*\{[^{}]*@starting-style/i.test(cleanCss);
    expect(hasPopoverStartingStyle).toBe(true);
  });

  test('<dialog> and [popover] transition display property with allow-discrete', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasDisplayAllowDiscrete =
      /\bdisplay\b[^;}]*\ballow-discrete\b/i.test(cleanCss) ||
      (/\bdisplay\b/i.test(cleanCss) && /\ballow-discrete\b/i.test(cleanCss));
    expect(hasDisplayAllowDiscrete).toBe(true);
  });

  test('<dialog> and [popover] transition overlay property with allow-discrete', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasOverlayAllowDiscrete =
      /\boverlay\b[^;}]*\ballow-discrete\b/i.test(cleanCss) ||
      (/\boverlay\b/i.test(cleanCss) && /\ballow-discrete\b/i.test(cleanCss));
    expect(hasOverlayAllowDiscrete).toBe(true);
  });

  test('Open state defines visible styles for top-layer elements', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasOpenStateSelector =
      /\bdialog\[open\]|\bdialog:open|\[popover\]:popover-open/i.test(cleanCss);
    expect(hasOpenStateSelector).toBe(true);
  });

  test('Base state defines exit transitions for dialog and popover', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasBaseTransition =
      /(?:dialog|\[popover\])[^{]*\{[^}]*\btransition/i.test(cleanCss);
    expect(hasBaseTransition).toBe(true);
  });

  test('::backdrop pseudo-element is animated with transitions', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasBackdropAnimation =
      /::backdrop\s*\{[^}]*\btransition/i.test(cleanCss);
    expect(hasBackdropAnimation).toBe(true);
  });

  test('prefers-reduced-motion media query simplifies or disables transitions', () => {
    const cssBlocks = extractAllCss(absoluteTargetFiles);
    const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    const hasReducedMotion =
      /@media\s*\([^)]*prefers-reduced-motion[^)]*\)/i.test(cleanCss);
    expect(hasReducedMotion).toBe(true);
  });

});
