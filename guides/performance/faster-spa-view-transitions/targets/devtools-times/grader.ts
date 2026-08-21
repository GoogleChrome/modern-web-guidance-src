import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getJsProject,
} from '../../../../test-fixture.ts';
import fs from 'node:fs';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('faster-spa-view-transitions Target Grader', () => {

  test('Inactive view elements have content-visibility: hidden applied (CSS)', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasInactiveContentVisibility =
      /(?:\.inactive|\[aria-hidden[^\]]*\])[^{}]*\{[^}]*\bcontent-visibility\s*:\s*hidden\b/i.test(cleanCss) ||
      /\bcontent-visibility\s*:\s*hidden\b/i.test(cleanCss);
    expect(hasInactiveContentVisibility).toBe(true);
  });

  test('Active view element does not have content-visibility: hidden applied (CSS)', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasContentVisibility = /\bcontent-visibility\s*:\s*hidden\b/i.test(cleanCss);
    const isBareOrActiveViewHidden = /(?:\.spa-view(?!\s*(?:\.inactive|\[aria-hidden|:not\(\.active\)))|\.spa-view\.active|\.active)\s*\{[^}]*\bcontent-visibility\s*:\s*hidden\b/i.test(cleanCss);
    expect(hasContentVisibility && !isBareOrActiveViewHidden).toBe(true);
  });

  test('Implementation toggles view state when switching between views (ts-morph)', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasToggleLogic = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const text = call.getText();
        return (
          /classList\.(add|remove|toggle)\s*\(\s*['"`](?:inactive|active)['"`]/i.test(text) ||
          /setAttribute\s*\(\s*['"`]aria-hidden['"`]/i.test(text)
        );
      });
    });
    expect(hasToggleLogic).toBe(true);
  });

  test('Implementation uses aria-hidden on inactive view elements (Linkedom/ts-morph)', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasAriaHiddenInJs = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasCall = calls.some((call) => {
        const text = call.getText();
        return /setAttribute\s*\(\s*['"`]aria-hidden['"`]/i.test(text);
      });
      return hasCall || /\baria-hidden\b/i.test(sf.getFullText());
    });

    const hasAriaHiddenInTemplates = targetFiles.some((file) => {
      if (!fs.existsSync(file)) return false;
      const content = fs.readFileSync(file, 'utf8');
      return /aria-hidden\s*=\s*['"{]/i.test(content);
    });

    expect(hasAriaHiddenInJs || hasAriaHiddenInTemplates).toBe(true);
  });

  test('Implementation maintains focus management by focusing active view container upon transition (ts-morph)', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasFocusCall = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const exprText = call.getExpression().getText();
        return exprText.endsWith('.focus') || exprText === 'focus';
      });
    });
    expect(hasFocusCall).toBe(true);
  });

  test('Inactive view elements have display: none fallback when content-visibility is not supported (CSS)', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasSupportsFallback =
      /@supports\s+not\s*\([^)]*\bcontent-visibility\s*:\s*hidden\b[^)]*\)\s*\{[^{}]*\{[^{}]*\bdisplay\s*:\s*none\b/i.test(cleanCss) ||
      /@supports\s+not\s*\([^)]*\bcontent-visibility[^{]*\)\s*\{[\s\S]*?\bdisplay\s*:\s*none\b/i.test(cleanCss);
    expect(hasSupportsFallback).toBe(true);
  });

});
