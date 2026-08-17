import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
} from '../../../../test-fixture.ts';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function extractContainerBlocks(css: string): string[] {
  const blocks: string[] = [];
  const regex = /@container\b[^{]*\{/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    let depth = 1;
    let index = regex.lastIndex;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth++;
      else if (css[index] === '}') depth--;
      index++;
    }
    blocks.push(css.slice(match.index, index));
  }
  return blocks;
}

test.describe('size-aware-styling Target Grader', () => {
  test('Component wrapper defines container-type (inline-size or size) for container queries', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const hasContainerType = /(?:container-type\s*:\s*|container\s*:[^;}]*\b)(?:inline-size|size)\b/i.test(cleanCss);
    expect(hasContainerType).toBe(true);
  });

  test('Component uses @container queries to apply styles based on container width', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const hasContainerQuery = /@container\b[^{]*\b(?:min-width|max-width|width|min-inline-size|max-inline-size|inline-size)\b/i.test(cleanCss);
    expect(hasContainerQuery).toBe(true);
  });

  test('Component adapts layout (e.g. side-by-side or multi-column) when container width reaches threshold', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const containerBlocks = extractContainerBlocks(cleanCss);
    const hasResponsiveLayout = containerBlocks.some((block) =>
      /(?:flex-direction\s*:\s*row(?:-reverse)?|grid-template-columns|flex-flow\s*:\s*row|display\s*:\s*(?:flex|grid))/i.test(block)
    );
    expect(hasResponsiveLayout).toBe(true);
  });

  test('Component defines a safe default stacked layout for narrow containers', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const hasSafeDefaultLayout = /(?:flex-direction\s*:\s*column|flex-flow\s*:\s*column)/i.test(cleanCss);
    expect(hasSafeDefaultLayout).toBe(true);
  });

  test('Component provides a fallback strategy using media queries or @supports feature queries', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const hasFallbackStrategy = /(?:@supports\s*\([^)]*container(?:-type)?|@media\s*\([^)]*(?:min-width|width))/i.test(cleanCss);
    expect(hasFallbackStrategy).toBe(true);
  });
});
