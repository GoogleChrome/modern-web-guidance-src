import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('interactive-content-in-3d-scenes Target Grader', () => {
  const project = getJsProject(targetFiles);
  const htmlDocs = getHtmlDocuments(targetFiles);

  test('Feature detection for HTML-in-Canvas is conducted before using the API', () => {
    const hasFeatureDetection = project.getSourceFiles().some((sf) => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasInCheck = binaryExprs.some(
        (expr) =>
          expr.getOperatorToken().getKind() === SyntaxKind.InKeyword &&
          expr.getLeft().getText().includes('requestPaint'),
      );
      const typeOfExprs = sf.getDescendantsOfKind(SyntaxKind.TypeOfExpression);
      const hasTypeOfCheck = typeOfExprs.some((expr) =>
        expr.getExpression().getText().includes('requestPaint'),
      );
      return hasInCheck || hasTypeOfCheck;
    });

    expect(hasFeatureDetection).toBe(true);
  });

  test('Canvas element includes the layoutsubtree attribute for descendant HTML exposure', () => {
    const hasHtmlLayoutsubtree = htmlDocs.some((d) =>
      Boolean(d.document.querySelector('canvas[layoutsubtree], canvas[layout-subtree]')),
    );

    const hasJsxLayoutsubtree = project.getSourceFiles().some((sf) => {
      const jsxElements = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
      return jsxElements.some((el) => {
        if (el.getTagNameNode().getText() !== 'canvas') return false;
        return el.getAttributes().some((attr) => {
          if (attr.getKind() === SyntaxKind.JsxAttribute) {
            return attr.getText().toLowerCase().includes('layoutsubtree');
          }
          return false;
        });
      });
    });

    const hasSetAttributeLayoutsubtree = project.getSourceFiles().some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const text = call.getText();
        return text.includes('setAttribute') && text.includes('layoutsubtree');
      });
    });

    const hasLayoutsubtree = hasHtmlLayoutsubtree || hasJsxLayoutsubtree || hasSetAttributeLayoutsubtree;
    expect(hasLayoutsubtree).toBe(true);
  });

  test('Canvas rendering is executed inside an onpaint event handler attached to the canvas', () => {
    const hasOnpaintHandler = project.getSourceFiles().some((sf) => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasOnpaintAssignment = binaryExprs.some(
        (expr) =>
          expr.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
          expr.getLeft().getText().endsWith('.onpaint'),
      );
      if (hasOnpaintAssignment) return true;

      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const text = call.getText();
        return text.includes('addEventListener') && (text.includes("'paint'") || text.includes('"paint"'));
      });
    });

    expect(hasOnpaintHandler).toBe(true);
  });

  test('Rendering logic uses texElementImage2D or copyElementImageToTexture to draw HTML onto canvas', () => {
    const hasElementImageDraw = project.getSourceFiles().some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const exprText = call.getExpression().getText();
        return exprText.includes('texElementImage2D') || exprText.includes('copyElementImageToTexture');
      });
    });

    expect(hasElementImageDraw).toBe(true);
  });

  test('CSS transform property of descendant HTML element is updated based on transform matrix', () => {
    const hasTransformUpdate = project.getSourceFiles().some((sf) => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasStyleTransform = binaryExprs.some(
        (expr) =>
          expr.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
          expr.getLeft().getText().endsWith('.style.transform'),
      );
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasSetProperty = callExprs.some((call) => {
        const text = call.getText();
        return text.includes('setProperty') && text.includes('transform');
      });
      return hasStyleTransform || hasSetProperty;
    });

    expect(hasTransformUpdate).toBe(true);
  });

  test('Screen size changes are observed to update canvas size to match device pixels', () => {
    const observesScreenSizeForDevicePixels = project.getSourceFiles().some((sf) => {
      const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
      const createsResizeObserver = newExprs.some((n) => n.getExpression().getText() === 'ResizeObserver');
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasResizeListener = callExprs.some((c) => {
        const text = c.getText();
        return text.includes('addEventListener') && text.includes('resize');
      });
      const sourceText = sf.getText();
      const accountsForDevicePixels =
        sourceText.includes('devicePixelContentBoxSize') || sourceText.includes('devicePixelRatio');
      return (createsResizeObserver || hasResizeListener) && accountsForDevicePixels;
    });

    expect(observesScreenSizeForDevicePixels).toBe(true);
  });

  test('Fallback UI strategy is implemented for browsers without HTML-in-Canvas support', () => {
    const hasDomFallback = htmlDocs.some((d) =>
      Boolean(d.document.querySelector('[class*="fallback"], [id*="fallback"], canvas[hidden]')),
    );

    const hasCodeFallback = project.getSourceFiles().some((sf) => {
      const conditionals = sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
      const hasJsxTernaryFallback = conditionals.some((cond) => {
        const condText = cond.getCondition().getText();
        return (
          (condText.includes('Supported') || condText.includes('requestPaint')) &&
          (cond.getWhenFalse().getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
            cond.getWhenFalse().getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
            cond.getWhenFalse().getText().includes('canvas'))
        );
      });
      if (hasJsxTernaryFallback) return true;

      const sourceText = sf.getText();
      if (
        /\bfallback\b/i.test(sourceText) &&
        (sourceText.includes('requestPaint') || sourceText.includes('Supported'))
      ) {
        return true;
      }

      const ifStatements = sf.getDescendantsOfKind(SyntaxKind.IfStatement);
      return ifStatements.some((stmt) => {
        const exprText = stmt.getExpression().getText();
        return (
          (exprText.startsWith('!') || exprText.includes('=== false')) &&
          (exprText.includes('requestPaint') ||
            exprText.includes('Supported') ||
            exprText.includes('isHtmlInCanvasSupported'))
        );
      });
    });

    const hasFallbackUIStrategy = hasDomFallback || hasCodeFallback;
    expect(hasFallbackUIStrategy).toBe(true);
  });
});
