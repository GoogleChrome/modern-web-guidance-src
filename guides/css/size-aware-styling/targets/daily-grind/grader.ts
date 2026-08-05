import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

// @ts-ignore
const targetFiles = getTargetFiles(import.meta.url);

function getContainerQueryBlocks(css: string): string[] {
  const blocks: string[] = [];
  const regex = /@container\b[^{]*\{/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    const startIdx = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = startIdx; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          blocks.push(css.substring(match.index, i + 1));
          break;
        }
      }
    }
  }
  return blocks;
}

test.describe('size-aware-styling Target Grader', () => {
  test('CSS defines container-type property with inline-size or size', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasContainerType = /\bcontainer(-type)?\s*:\s*([^;]*\b)?(inline-size|size)\b/i.test(cleanCss);
    expect(hasContainerType).toBe(true);
  });

  test('HTML contains elements matching the CSS container-type selector', () => {
    const cleanCss = extractAllCss(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const selectorMatches = [...cleanCss.matchAll(/([.#][\w-]+)\s*\{[^}]*\bcontainer(-type)?\s*:\s*([^;]*\b)?(inline-size|size)\b/gi)];
    const selectors = selectorMatches.map(m => m[1]);
    const hasMatchingElement = selectors.some(sel =>
      docs.some(d => d.document.querySelector(sel) !== null)
    );
    expect(hasMatchingElement).toBe(true);
  });

  test('CSS uses @container queries with width-based conditions', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasContainerQuery = /@container\b[^{]*\b(min-width|max-width|width)\b/i.test(cleanCss);
    expect(hasContainerQuery).toBe(true);
  });

  test('CSS container query uses a numeric width threshold', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasNumericThreshold = /@container\b[^{]*\b(min-width|max-width|width)\s*:\s*\d+(px|em|rem|cqi|cqw)\b/i.test(cleanCss);
    expect(hasNumericThreshold).toBe(true);
  });

  test('CSS defines layout structure change inside @container width query block', () => {
    const cleanCss = extractAllCss(targetFiles);
    const containerBlocks = getContainerQueryBlocks(cleanCss);
    const widthContainerBlocks = containerBlocks.filter(b => /@container\b[^{]*\b(min-width|max-width|width)\b/i.test(b));
    const hasLayoutChange = widthContainerBlocks.some(b =>
      /\b(flex-direction\s*:\s*row|grid-template-columns|display\s*:\s*(flex|grid)|align-items\s*:)/i.test(b)
    );
    expect(hasLayoutChange).toBe(true);
  });

  test('CSS provides a default stacked flex layout as a safe fallback', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasStackedCardFallback = /\.[\w-]*card[\w-]*\s*\{[^}]*\bdisplay\s*:\s*flex\b[^}]*\bflex-direction\s*:\s*column\b/i.test(cleanCss) ||
      /\.[\w-]*card[\w-]*\s*\{[^}]*\bflex-direction\s*:\s*column\b[^}]*\bdisplay\s*:\s*flex\b/i.test(cleanCss);
    expect(hasStackedCardFallback).toBe(true);
  });

  test('CSS includes a viewport media query fallback for non-supporting browsers', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasMediaQueryFallback = /@media\s*\([^)]*\bmin-width\b/i.test(cleanCss);
    expect(hasMediaQueryFallback).toBe(true);
  });

  test('CSS uses @supports to progressively enhance container query rules', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasSupportsRule = /@supports\s*\([^)]*\bcontainer-type\b/i.test(cleanCss);
    expect(hasSupportsRule).toBe(true);
  });
});
