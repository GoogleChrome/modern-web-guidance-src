import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { pathToFileURL } from 'node:url';
import { SyntaxKind } from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(
  typeof __filename !== 'undefined'
    ? pathToFileURL(__filename).toString()
    : pathToFileURL(process.cwd() + '/grader.ts').toString()
);

test.describe('prevent-page-scroll-under-modal-dialog Target Grader', () => {

  test('The <dialog> element exists in the markup and is opened as a modal using showModal()', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasDialog = docs.some(d => Boolean(d.document.querySelector('dialog')));

    const project = getJsProject(targetFiles);
    const callsShowModal = project.getSourceFiles().some(sf => {
      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExpressions.some(call => {
        const text = call.getExpression().getText();
        return text.endsWith('.showModal') || text === 'showModal';
      });
    });

    expect(hasDialog && callsShowModal).toBe(true);
  });

  test('When open as a modal, the <dialog> element has overscroll-behavior: contain or none', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const dialogRules = styleRules.filter(r =>
      (r.selectorText.includes('dialog') || r.selectorText.includes(':modal')) &&
      !r.selectorText.includes('backdrop')
    );

    const hasOverscrollContain = dialogRules.some(r => {
      const ob = r.style.getPropertyValue('overscroll-behavior') ||
                 r.style.getPropertyValue('overscroll-behavior-y') ||
                 r.style.getPropertyValue('overscroll-behavior-x');
      return ob === 'contain' || ob === 'none';
    });

    expect(hasOverscrollContain).toBe(true);
  });

  test('When open as a modal, the <dialog> element is a scroll container without visible or clip overflow', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasDialog = docs.some(d => Boolean(d.document.querySelector('dialog')));

    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const dialogRules = styleRules.filter(r =>
      (r.selectorText.includes('dialog') || r.selectorText.includes(':modal')) &&
      !r.selectorText.includes('backdrop')
    );

    const hasInvalidOverflow = dialogRules.some(r => {
      const ov = r.style.getPropertyValue('overflow');
      const ovX = r.style.getPropertyValue('overflow-x');
      const ovY = r.style.getPropertyValue('overflow-y');
      return ['visible', 'clip'].includes(ov) || ['visible', 'clip'].includes(ovX) || ['visible', 'clip'].includes(ovY);
    });

    expect(hasDialog && !hasInvalidOverflow).toBe(true);
  });

  test('The dialog::backdrop pseudo-element establishes a scroll container with overflow: hidden or auto', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const backdropRules = styleRules.filter(r => r.selectorText.includes('backdrop'));

    const hasValidBackdropOverflow = backdropRules.some(r => {
      const ov = r.style.getPropertyValue('overflow') ||
                 r.style.getPropertyValue('overflow-y') ||
                 r.style.getPropertyValue('overflow-x');
      return ['hidden', 'auto', 'scroll'].includes(ov);
    }) && !backdropRules.some(r => {
      const ov = r.style.getPropertyValue('overflow');
      const ovX = r.style.getPropertyValue('overflow-x');
      const ovY = r.style.getPropertyValue('overflow-y');
      return ['visible', 'clip'].includes(ov) || ['visible', 'clip'].includes(ovX) || ['visible', 'clip'].includes(ovY);
    });

    expect(hasValidBackdropOverflow).toBe(true);
  });

  test('The dialog::backdrop pseudo-element has overscroll-behavior: contain or none', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const backdropRules = styleRules.filter(r => r.selectorText.includes('backdrop'));

    const hasBackdropOverscroll = backdropRules.some(r => {
      const ob = r.style.getPropertyValue('overscroll-behavior') ||
                 r.style.getPropertyValue('overscroll-behavior-y') ||
                 r.style.getPropertyValue('overscroll-behavior-x');
      return ob === 'contain' || ob === 'none';
    });

    expect(hasBackdropOverscroll).toBe(true);
  });

  test('While modal dialog is open, html and body are not scroll-locked via overflow: hidden or position: fixed', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasDialog = docs.some(d => Boolean(d.document.querySelector('dialog')));

    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = Array.from(stylesheet.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const rootRules = styleRules.filter(r => /\b(html|body)\b/i.test(r.selectorText));
    const hasCssScrollLock = rootRules.some(r => {
      const ov = r.style.getPropertyValue('overflow') || r.style.getPropertyValue('overflow-y');
      const pos = r.style.getPropertyValue('position');
      return ['hidden', 'clip'].includes(ov) || pos === 'fixed';
    });

    const project = getJsProject(targetFiles);
    const hasJsScrollLock = project.getSourceFiles().some(sf => {
      const binaryExpressions = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      return binaryExpressions.some(expr => {
        const left = expr.getLeft().getText();
        const right = expr.getRight().getText().replace(/['"]/g, '');
        return (left.includes('style.overflow') && (right === 'hidden' || right === 'clip')) ||
               (left.includes('style.position') && right === 'fixed');
      });
    });

    expect(hasDialog && !hasCssScrollLock && !hasJsScrollLock).toBe(true);
  });

});
