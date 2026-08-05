import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getJsProject,
} from '../../../../test-fixture.ts';

const targetFiles = getTargetFiles(import.meta.url);

test.describe('Animate to/from Top Layer Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('HTML/JSX components declare native <dialog> elements for modal flyouts', () => {
    const project = getJsProject(targetFiles);
    const hasDialog = project.getSourceFiles().some(sf => sf.getText().includes('<dialog'));
    expect(hasDialog).toBe(true);
  });

  test('HTML/JSX components declare popover attribute for top-layer flyout menu', () => {
    const project = getJsProject(targetFiles);
    const hasPopover = project.getSourceFiles().some(sf => /\bpopover\s*=/i.test(sf.getText()));
    expect(hasPopover).toBe(true);
  });

  test('CSS defines @starting-style entry property values for <dialog> elements', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasDialogStartingStyle = /\bdialog\b[^{}]*\{[^{}]*@starting-style/i.test(cleanCss) || /@starting-style\s*\{[^{}]*\bdialog\b/i.test(cleanCss);
    expect(hasDialogStartingStyle).toBe(true);
  });

  test('CSS defines @starting-style entry property values for [popover] elements', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasPopoverStartingStyle = /\[popover\][^{}]*\{[^{}]*@starting-style/i.test(cleanCss) || /@starting-style\s*\{[^{}]*\[popover\]/i.test(cleanCss);
    expect(hasPopoverStartingStyle).toBe(true);
  });

  test('CSS transition for <dialog> includes display and overlay properties', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasDialogDisplayOverlay = /\bdialog\b[^{}]*\{[^{}]*\btransition(-property)?\b[^{}]*\b(display.*overlay|overlay.*display)\b/i.test(cleanCss);
    expect(hasDialogDisplayOverlay).toBe(true);
  });

  test('CSS transition for <dialog> enables allow-discrete keyword', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasDialogAllowDiscrete = /\bdialog\b[^{}]*\{[^{}]*\ballow-discrete\b/i.test(cleanCss);
    expect(hasDialogAllowDiscrete).toBe(true);
  });

  test('CSS transition for [popover] includes display and overlay properties', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasPopoverDisplayOverlay = /\[popover\][^{}]*\{[^{}]*\btransition(-property)?\b[^{}]*\b(display.*overlay|overlay.*display)\b/i.test(cleanCss);
    expect(hasPopoverDisplayOverlay).toBe(true);
  });

  test('CSS transition for [popover] enables allow-discrete keyword', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasPopoverAllowDiscrete = /\[popover\][^{}]*\{[^{}]*\ballow-discrete\b/i.test(cleanCss);
    expect(hasPopoverAllowDiscrete).toBe(true);
  });

  test('CSS defines visible open styles for dialog[open] and [popover]:popover-open', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasOpenVisibleStyles = /dialog\[open\][^{}]*\{[^{}]*\bopacity\s*:\s*1\b/i.test(cleanCss) && /:popover-open[^{}]*\{[^{}]*\bopacity\s*:\s*1\b/i.test(cleanCss);
    expect(hasOpenVisibleStyles).toBe(true);
  });

  test('CSS defines base closed state styles for exit transitions on dialog and popover', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasBaseClosedStyles = /\bdialog\b[^{}]*\{[^{}]*\bopacity\s*:\s*0\b/i.test(cleanCss) && /\[popover\][^{}]*\{[^{}]*\bopacity\s*:\s*0\b/i.test(cleanCss);
    expect(hasBaseClosedStyles).toBe(true);
  });

  test('CSS animates dialog ::backdrop pseudo-element with transition and open styles', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasBackdropAnimation = /dialog(::|:)backdrop\b[^{}]*\{[^{}]*\btransition\b[^{}]*\bbackground-color\b/i.test(cleanCss);
    expect(hasBackdropAnimation).toBe(true);
  });

  test('CSS respects prefers-reduced-motion media query by simplifying or disabling transitions', () => {
    const cleanCss = extractAllCss(targetFiles);
    const hasReducedMotion = /@media\s*\([^)]*prefers-reduced-motion[^)]*\)\s*\{[^{}]*\b(dialog|\[popover\])\b/i.test(cleanCss);
    expect(hasReducedMotion).toBe(true);
  });
});
