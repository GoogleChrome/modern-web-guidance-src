import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

const targetFiles = getTargetFiles(import.meta.url);

test.describe('size-aware-styling Target Grader', () => {

  test('component wrapper defines container-type (inline-size or size)', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(/container-type\s*:\s*(inline-size|size)\b/i.test(cleanCss)).toBe(true);
  });

  test('component defines @container query with width-based conditions', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(/@container\s+([a-zA-Z0-9_-]+\s+)?\([^)]*width[^)]*\)/i.test(cleanCss)).toBe(true);
  });

  test('layout changes (e.g. flex-direction or grid columns) inside @container query', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(/@container\b[^{]+\{[^}]*\{[^}]*\b(flex-direction\s*:\s*row|grid-template-columns)\b/i.test(cleanCss)).toBe(true);
  });

  test('provides media query layout fallback for browsers without container query support', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(/@media\b[^{]+\{[^}]*\{[^}]*\b(flex-direction\s*:\s*row|grid-template-columns)\b/i.test(cleanCss)).toBe(true);
  });

  test('uses @supports feature detection for container-type progressive enhancement', () => {
    const cleanCss = extractAllCss(targetFiles);
    expect(/@supports\s*\(\s*container-type\s*:/i.test(cleanCss)).toBe(true);
  });

});
