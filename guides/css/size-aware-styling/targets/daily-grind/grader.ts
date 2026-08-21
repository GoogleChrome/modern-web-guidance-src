import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { pathToFileURL } from 'url';

const currentFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(process.cwd() + '/grader.ts').href;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

function extractContainerBlocks(css: string): string[] {
  const blocks: string[] = [];
  const matches = [...css.matchAll(/@container\b/gi)];
  for (const m of matches) {
    const startIdx = m.index;
    if (startIdx === undefined) continue;
    const openBrace = css.indexOf('{', startIdx);
    if (openBrace === -1) continue;
    let depth = 1;
    let i = openBrace + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    blocks.push(css.slice(openBrace + 1, i - 1));
  }
  return blocks;
}

test.describe('Size-Aware Styling (Daily Grind) Target Grader', () => {

  // --- STATIC ASSERTIONS ---

  test('HTML markup defines container wrapper elements for components', () => {
    const docs = getHtmlDocuments(targetFiles);
    const containerElements = docs.flatMap(d =>
      Array.from(d.document.querySelectorAll('.card-container, [class*="card-container"], [class*="card-wrapper"], [class*="container-"], [class*="cta-container"]'))
    );
    expect(containerElements.length).toBeGreaterThan(0);
  });

  test('CSS declares container-type inline-size or size on component wrappers', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const hasContainerType = /(?:container-type\s*:\s*(?:inline-size|size)|container\s*:\s*[^;}]*\b(?:inline-size|size)\b)/i.test(cleanCss);
    expect(hasContainerType).toBe(true);
  });

  test('CSS uses @container queries conditioned on container width or inline-size', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const hasContainerQuery = /@container\s+[^\{]*(?:min-width|max-width|width|inline-size|min-inline-size|max-inline-size)\b/i.test(cleanCss);
    expect(hasContainerQuery).toBe(true);
  });

  test('CSS restructures component layout inside @container query blocks', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const containerBlocks = extractContainerBlocks(cleanCss);
    const hasLayoutChange = containerBlocks.some(block =>
      /(?:flex-direction\s*:\s*row|flex-flow\s*:\s*row|grid-template-columns|display\s*:\s*(?:flex|grid)|grid-auto-flow)/i.test(block)
    );
    expect(hasLayoutChange).toBe(true);
  });

  test('CSS provides a fallback strategy using media queries or progressive enhancement', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const hasFallback = (
      /@supports\s*(?:not\s*)?\(\s*(?:container-type|container)\s*:/i.test(cleanCss) ||
      (/@media\s*\([^)]*min-width/i.test(cleanCss) && /(?:flex-direction\s*:\s*(?:column|row)|\bgrid\b)/i.test(cleanCss))
    );
    expect(hasFallback).toBe(true);
  });

});
