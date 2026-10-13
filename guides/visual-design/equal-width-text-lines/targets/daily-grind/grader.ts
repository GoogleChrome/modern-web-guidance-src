import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, CSSSupportsRule, getCascadedStyle, type CSSRule } from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const r of rules) {
    if (r instanceof CSSStyleRule) {
      result.push(r);
    } else if ('cssRules' in r && r.cssRules) {
      result.push(...getStyleRules(r.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

function getSupportsRules(rules: Iterable<CSSRule>): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const r of rules) {
    if (r instanceof CSSSupportsRule) {
      result.push(r);
    } else if ('cssRules' in r && r.cssRules) {
      result.push(...getSupportsRules(r.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

test.describe('Equal-Width Text Lines Target Grader', () => {

  // --- REQUIREMENT 1: text-fit declaration & base font-size ---

  test('Stylesheets declare text-fit on the lockup heading', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const textFitRule = styleRules.find(r => r.style.getPropertyValue('text-fit') !== '');
    expect(Boolean(textFitRule)).toBe(true);
  });

  test('text-fit property uses per-line-all rather than per-line', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const textFitRule = styleRules.find(r => r.style.getPropertyValue('text-fit') !== '');
    const textFit = textFitRule?.style.getPropertyValue('text-fit') || '';
    expect(textFit.includes('per-line-all') && !/\bper-line\b(?!-all)/.test(textFit)).toBe(true);
  });

  test('text-fit property specifies either grow or shrink exclusively', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const textFitRule = styleRules.find(r => r.style.getPropertyValue('text-fit') !== '');
    const textFit = textFitRule?.style.getPropertyValue('text-fit') || '';
    const hasGrow = /\bgrow\b/.test(textFit);
    const hasShrink = /\bshrink\b/.test(textFit);
    expect((hasGrow || hasShrink) && !(hasGrow && hasShrink)).toBe(true);
  });

  test('text-fit property specifies an explicit percentage guardrail limit', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const textFitRule = styleRules.find(r => r.style.getPropertyValue('text-fit') !== '');
    const textFit = textFitRule?.style.getPropertyValue('text-fit') || '';
    expect(/\b\d+%/.test(textFit)).toBe(true);
  });

  test('Lockup heading declares a base font-size alongside text-fit', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const textFitRule = styleRules.find(r => r.style.getPropertyValue('text-fit') !== '');
    expect(Boolean(textFitRule?.style.getPropertyValue('font-size'))).toBe(true);
  });

  // --- REQUIREMENT 2: Lockup definite inline size & tight line-height ---

  test('Lockup container specifies a definite inline size rather than fit-content or max-content', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const lockupRule = styleRules.find(r =>
      /(?:^|[\s,>+~])\.lockup\b/.test(r.selectorText) ||
      (r.selectorText.includes('h1') && r.style.getPropertyValue('text-fit') !== '')
    );
    const inlineSize = lockupRule?.style.getPropertyValue('inline-size')
      || lockupRule?.style.getPropertyValue('width')
      || lockupRule?.style.getPropertyValue('max-width');
    const docs = getHtmlDocuments(targetFiles);
    const headingEl = docs.map(d => d.document.querySelector('.lockup, h1')).find(Boolean);
    const headingClass = headingEl?.getAttribute('class') || '';
    const hasUtilityWidth = /\b(?:w-|max-w-|inline-size)\S+/.test(headingClass);
    const hasDefiniteInlineSize = Boolean(
      (inlineSize &&
        !inlineSize.includes('fit-content') &&
        !inlineSize.includes('max-content') &&
        inlineSize !== 'auto') ||
      hasUtilityWidth
    );
    expect(hasDefiniteInlineSize).toBe(true);
  });

  test('Lockup heading sets a tight line-height of 1 or less', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const lockupRule = styleRules.find(r =>
      /(?:^|[\s,>+~])\.lockup\b/.test(r.selectorText) ||
      (r.selectorText.includes('h1') && r.style.getPropertyValue('text-fit') !== '')
    );
    const lh = lockupRule?.style.getPropertyValue('line-height') || '';
    const num = parseFloat(lh);
    const hasTightLineHeight = Boolean(lh !== '' && !isNaN(num) && num <= 1 && num > 0);
    expect(hasTightLineHeight).toBe(true);
  });

  // --- REQUIREMENT 3: Forced line spans display: block & white-space: nowrap ---

  test('Lockup heading markup wraps forced text lines in span elements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const heading = docs.map(d => d.document.querySelector('.lockup, h1:has(span)')).find(Boolean);
    const spans = heading ? Array.from(heading.querySelectorAll('span')) : [];
    expect(spans.length).toBeGreaterThanOrEqual(2);
  });

  test('Forced line span elements are styled with display: block', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const lineRule = styleRules.find(r => /(?:\.lockup|h1)\s*(?:>\s*)?span\b/.test(r.selectorText) && !r.parentRule);
    const docs = getHtmlDocuments(targetFiles);
    const spans = docs.flatMap(d => Array.from(d.document.querySelectorAll('.lockup > span, .lockup span, h1:has(span) > span')));
    const hasDisplayBlock = lineRule?.style.getPropertyValue('display') === 'block'
      || spans.some(s => getCascadedStyle(s, styleRules).getPropertyValue('display') === 'block');
    expect(Boolean(hasDisplayBlock)).toBe(true);
  });

  test('Forced line span elements are styled with white-space: nowrap', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const lineRule = styleRules.find(r => /(?:\.lockup|h1)\s*(?:>\s*)?span\b/.test(r.selectorText) && !r.parentRule);
    const docs = getHtmlDocuments(targetFiles);
    const spans = docs.flatMap(d => Array.from(d.document.querySelectorAll('.lockup > span, .lockup span, h1:has(span) > span')));
    const hasNowrap = lineRule?.style.getPropertyValue('white-space') === 'nowrap'
      || spans.some(s => getCascadedStyle(s, styleRules).getPropertyValue('white-space') === 'nowrap');
    expect(Boolean(hasNowrap)).toBe(true);
  });

  // --- REQUIREMENT 4: Spacing (flex/grid gap) & text trimming (text-box or text-wrap) ---

  test('Lockup heading spaces line blocks using flex or grid layout with gap', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const lockupRule = styleRules.find(r =>
      /(?:^|[\s,>+~])\.lockup\b/.test(r.selectorText) ||
      (r.selectorText.includes('h1') && r.style.getPropertyValue('text-fit') !== '')
    );
    const disp = lockupRule?.style.getPropertyValue('display') || '';
    const gap = lockupRule?.style.getPropertyValue('gap') || '';
    const wrap = lockupRule?.style.getPropertyValue('text-wrap') || '';
    const docs = getHtmlDocuments(targetFiles);
    const headingEl = docs.map(d => d.document.querySelector('.lockup, h1')).find(Boolean);
    const headingClass = headingEl?.getAttribute('class') || '';
    const hasUtilityFlexGrid = /\b(?:flex|grid)\b/.test(headingClass) && /\bgap-/.test(headingClass);
    const hasProperSpacing = ((disp === 'flex' || disp === 'grid') && Boolean(gap)) || hasUtilityFlexGrid || /balance|pretty/.test(wrap);
    expect(hasProperSpacing).toBe(true);
  });

  test('Forced line blocks declare text-box trimming or free lines declare text-wrap', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getStyleRules(Array.from(stylesheet.cssRules));
    const lineRule = styleRules.find(r => /(?:\.lockup|h1)\s*(?:>\s*)?span\b/.test(r.selectorText) && !r.parentRule);
    const lockupRule = styleRules.find(r =>
      /(?:^|[\s,>+~])\.lockup\b/.test(r.selectorText) ||
      (r.selectorText.includes('h1') && r.style.getPropertyValue('text-fit') !== '')
    );
    const tb = lineRule?.style.getPropertyValue('text-box') || lineRule?.style.getPropertyValue('text-box-trim') || '';
    const wrap = lockupRule?.style.getPropertyValue('text-wrap') || '';
    const hasTrimmingOrWrapping = tb.includes('trim-both') || /balance|pretty/.test(wrap);
    expect(hasTrimmingOrWrapping).toBe(true);
  });

  // --- REQUIREMENT 5: @supports not (text-fit: ...) fallback rule ---

  test('Stylesheet declares an @supports not fallback rule for text-fit support', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const supportsRules = getSupportsRules(Array.from(stylesheet.cssRules));
    const r = supportsRules.find(s => /\bnot\b/.test(s.conditionText) && s.conditionText.includes('text-fit'));
    expect(Boolean(r)).toBe(true);
  });

  test('@supports fallback sets width: fit-content on forced line elements', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const supportsRules = getSupportsRules(Array.from(stylesheet.cssRules));
    const r = supportsRules.find(s => /\bnot\b/.test(s.conditionText) && s.conditionText.includes('text-fit'));
    const innerRules = Array.from(r?.cssRules || []);
    const lineRule = innerRules.find(
      (ir): ir is CSSStyleRule => ir instanceof CSSStyleRule && /(?:\.lockup|h1)?\s*(?:>\s*)?span\b/.test(ir.selectorText)
    );
    expect(lineRule?.style.getPropertyValue('width')).toBe('fit-content');
  });

  test('@supports fallback scales font-size using min() with custom property and percentage limit', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const supportsRules = getSupportsRules(Array.from(stylesheet.cssRules));
    const r = supportsRules.find(s => /\bnot\b/.test(s.conditionText) && s.conditionText.includes('text-fit'));
    const innerRules = Array.from(r?.cssRules || []);
    const lineRule = innerRules.find(
      (ir): ir is CSSStyleRule => ir instanceof CSSStyleRule && /(?:\.lockup|h1)?\s*(?:>\s*)?span\b/.test(ir.selectorText)
    );
    const fsVal = lineRule?.style.getPropertyValue('font-size') || '';
    const hasValidMinScale = fsVal.includes('min(') && fsVal.includes('var(--') && /\b\d+%/.test(fsVal);
    expect(hasValidMinScale).toBe(true);
  });

  // --- REQUIREMENT 6: ResizeObserver fallback script ---

  test('Fallback script verifies text-fit feature support using CSS.supports', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasTextFitSupportCheck = callExpressions.some(call => {
      const exprText = call.getExpression().getText();
      const isCssSupports = exprText === 'CSS.supports' || exprText.endsWith('.CSS.supports') || exprText.endsWith('.supports');
      const args = call.getArguments().map(a => a.getText());
      return isCssSupports && args.some(arg => arg.includes('text-fit'));
    });
    expect(hasTextFitSupportCheck).toBe(true);
  });

  test('Fallback script instantiates a ResizeObserver to observe lockup elements', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const newExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.NewExpression));
    const hasResizeObserver = newExpressions.some(n => n.getExpression().getText() === 'ResizeObserver');
    expect(hasResizeObserver).toBe(true);
  });

  test('Fallback script resets the custom property scale factor on forced lines before measuring', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasScaleReset = callExpressions.some(call => {
      const exprText = call.getExpression().getText();
      const args = call.getArguments().map(a => a.getText());
      const isRemove = exprText.endsWith('.removeProperty') && args.some(a => a.includes('--'));
      const isSetEmpty = exprText.endsWith('.setProperty') && args[0]?.includes('--') && (args[1] === "''" || args[1] === '""');
      return isRemove || isSetEmpty;
    });
    expect(hasScaleReset).toBe(true);
  });

  test('Fallback script batch-reads container or line width dimensions before writing property values', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const propAccesses = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression));
    const readIndex = propAccesses.find(pa => ['clientWidth', 'offsetWidth', 'scrollWidth', 'width'].includes(pa.getName()))?.getStart()
      ?? callExpressions.find(c => c.getExpression().getText().endsWith('.getBoundingClientRect'))?.getStart()
      ?? -1;
    const writeIndex = callExpressions.find(c => c.getExpression().getText().endsWith('.setProperty') && c.getArguments()[0]?.getText().includes('--'))?.getStart() ?? -1;
    expect(readIndex !== -1 && writeIndex !== -1 && readIndex < writeIndex).toBe(true);
  });

  test('Fallback script updates each line scale factor custom property', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const callExpressions = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasSetProperty = callExpressions.some(call => {
      const exprText = call.getExpression().getText();
      const args = call.getArguments().map(a => a.getText());
      return exprText.endsWith('.setProperty') && args[0]?.includes('--') && args.length >= 2;
    });
    expect(hasSetProperty).toBe(true);
  });
});
