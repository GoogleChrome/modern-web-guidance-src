import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Interactive Content in 3D Scenes Target Grader', () => {
  // Requirement 1: Feature detection for HTML-in-Canvas MUST be conducted before using the HTML-in-Canvas API.
  test('Feature detection for HTML-in-Canvas is conducted before using the HTML-in-Canvas API', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasCanvas = docs.some(d => Boolean(d.document.querySelector('canvas, [layoutsubtree]')));

    const hasFeatureDetectionInJs = project.getSourceFiles().some(sf => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasInExpr = binaryExprs.some(b => {
        const op = b.getOperatorToken().getText();
        const left = b.getLeft().getText();
        const right = b.getRight().getText();
        return op === 'in' && (right.includes('HTMLCanvasElement') || left.includes('requestPaint'));
      });
      const hasRequestPaintCheck = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some(pa => {
        return pa.getName() === 'requestPaint';
      });
      return hasInExpr || hasRequestPaintCheck;
    });

    const hasFallbackNotice = docs.some(d => {
      const el = d.document.querySelector('#canvas-fallback-notice, .fallback-notice, [id*="fallback"], [class*="fallback"]');
      return Boolean(el && el.textContent && /HTML-in-Canvas|not\s+supported|support/i.test(el.textContent));
    });

    const passed = hasCanvas && (hasFeatureDetectionInJs || hasFallbackNotice);
    expect(passed).toBe(true);
  });

  // Requirement 2: When using WebGL or WebGPU, the <canvas> element MUST include the layoutsubtree attribute to allow descendant HTML elements to be exposed to browser features.
  test('Canvas element includes the layoutsubtree attribute for descendant HTML exposure', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasLayoutSubtreeInHtml = docs.some(d => {
      return Boolean(d.document.querySelector('canvas[layoutsubtree], [layoutsubtree]'));
    });

    const hasLayoutSubtreeInJs = project.getSourceFiles().some(sf => {
      return sf.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => {
        const exprText = call.getExpression().getText();
        const args = call.getArguments();
        return (exprText === 'setAttribute' || exprText.endsWith('.setAttribute')) &&
          args.length > 0 &&
          args[0].getText().includes('layoutsubtree');
      });
    });

    const passed = hasLayoutSubtreeInHtml || hasLayoutSubtreeInJs;
    expect(passed).toBe(true);
  });

  // Requirement 3: When using WebGL or WebGPU, canvas rendering MUST be executed inside an onpaint event handler attached to the canvas element to trigger re-rendering when descendant HTML elements change.
  test('Canvas rendering is executed inside an onpaint event handler when using WebGL or WebGPU', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasCanvas = docs.some(d => Boolean(d.document.querySelector('canvas, [layoutsubtree]')));

    const usesWebGLOrWebGPU = project.getSourceFiles().some(sf => {
      return sf.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => {
        const exprText = call.getExpression().getText();
        if (exprText === 'getContext' || exprText.endsWith('.getContext')) {
          const args = call.getArguments();
          if (args.length > 0) {
            return /\b(webgl|webgl2|webgpu)\b/i.test(args[0].getText());
          }
        }
        return false;
      });
    });

    const hasOnPaintHandler = project.getSourceFiles().some(sf => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasAssign = binaryExprs.some(b => {
        const left = b.getLeft().getText();
        return left === 'onpaint' || left.endsWith('.onpaint');
      });
      const propAccess = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const hasProp = propAccess.some(pa => pa.getName() === 'onpaint');
      return hasAssign || hasProp;
    });

    const passed = hasCanvas && (!usesWebGLOrWebGPU || hasOnPaintHandler);
    expect(passed).toBe(true);
  });

  // Requirement 4: When using WebGL or WebGPU, the rendering logic MUST use texElementImage2D for WebGL or copyElementImageToTexture for WebGPU to draw HTML elements onto the canvas.
  test('Rendering logic uses texElementImage2D or copyElementImageToTexture when using WebGL or WebGPU', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasCanvas = docs.some(d => Boolean(d.document.querySelector('canvas, [layoutsubtree]')));

    const usesWebGLOrWebGPU = project.getSourceFiles().some(sf => {
      return sf.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => {
        const exprText = call.getExpression().getText();
        if (exprText === 'getContext' || exprText.endsWith('.getContext')) {
          const args = call.getArguments();
          if (args.length > 0) {
            return /\b(webgl|webgl2|webgpu)\b/i.test(args[0].getText());
          }
        }
        return false;
      });
    });

    const hasTextureCopyMethod = project.getSourceFiles().some(sf => {
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      return identifiers.some(id => {
        const name = id.getText();
        return name === 'texElementImage2D' || name === 'copyElementImageToTexture';
      });
    });

    const passed = hasCanvas && (!usesWebGLOrWebGPU || hasTextureCopyMethod);
    expect(passed).toBe(true);
  });

  // Requirement 5: When using WebGL or WebGPU, the CSS transform property of the descendant HTML element MUST be updated based on the transform matrix calculated during rendering.
  test('CSS transform property of descendant HTML element is updated or configured', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    const hasCanvas = docs.some(d => Boolean(d.document.querySelector('canvas, [layoutsubtree]')));

    const usesWebGLOrWebGPU = project.getSourceFiles().some(sf => {
      return sf.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => {
        const exprText = call.getExpression().getText();
        if (exprText === 'getContext' || exprText.endsWith('.getContext')) {
          const args = call.getArguments();
          if (args.length > 0) {
            return /\b(webgl|webgl2|webgpu)\b/i.test(args[0].getText());
          }
        }
        return false;
      });
    });

    const updatesTransformInJs = project.getSourceFiles().some(sf => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasStyleTransform = binaryExprs.some(b => b.getLeft().getText().includes('style.transform'));
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      const hasTransformIdent = identifiers.some(id => {
        const name = id.getText();
        return name === 'getElementTransform' || name === 'DOMMatrix' || name === 'style';
      });
      return hasStyleTransform || hasTransformIdent;
    });

    const hasTransformInCss = Array.from(stylesheet.cssRules).some(r => {
      if (r instanceof CSSStyleRule) {
        return Boolean(r.style.getPropertyValue('transform'));
      }
      return false;
    });

    const passed = hasCanvas && (!usesWebGLOrWebGPU ? hasTransformInCss : (updatesTransformInJs || hasTransformInCss));
    expect(passed).toBe(true);
  });

  // Requirement 6: Screen size changes MUST be observed to update the canvas size to match device pixels to prevent blurriness.
  test('Screen size changes are observed to update canvas size to match device pixels', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    const hasCanvas = docs.some(d => Boolean(d.document.querySelector('canvas, [layoutsubtree]')));

    const observesSizeInJs = project.getSourceFiles().some(sf => {
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      const hasResizeObserver = identifiers.some(id => id.getText() === 'ResizeObserver');
      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const hasResizeEvent = stringLiterals.some(s => s.getLiteralValue() === 'resize');
      return hasResizeObserver || hasResizeEvent;
    });

    const hasResponsiveCanvasCss = Array.from(stylesheet.cssRules).some(r => {
      if (r instanceof CSSStyleRule && r.selectorText.includes('canvas')) {
        const width = r.style.getPropertyValue('width');
        return Boolean(width && width.includes('%'));
      }
      return false;
    }) || docs.some(d => {
      const canvasEl = d.document.querySelector('canvas');
      const styleAttr = canvasEl?.getAttribute('style') || '';
      return styleAttr.includes('width') && styleAttr.includes('%');
    });

    const passed = hasCanvas && (observesSizeInJs || hasResponsiveCanvasCss);
    expect(passed).toBe(true);
  });

  // Requirement 7: A fallback UI strategy MUST be implemented for browsers that do not support HTML-in-Canvas.
  test('Fallback UI strategy is implemented for browsers that do not support HTML-in-Canvas', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    const hasFallbackInHtml = docs.some(d => {
      return Boolean(d.document.querySelector('[id*="fallback"], [class*="fallback"], [class*="overlay"]'));
    });

    const hasFallbackInCss = Array.from(stylesheet.cssRules).some(r => {
      if (r instanceof CSSStyleRule) {
        return /\b(fallback|overlay)\b/i.test(r.selectorText) ||
          (r.selectorText.includes('hidden') && r.style.getPropertyValue('display') === 'none');
      }
      return false;
    });

    const hasFallbackInJs = project.getSourceFiles().some(sf => {
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      const hasFallbackIdent = identifiers.some(id => {
        const name = id.getText().toLowerCase();
        return name.includes('fallback');
      });
      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const hasFallbackString = stringLiterals.some(s => {
        return /\b(fallback|overlay)\b/i.test(s.getLiteralValue());
      });
      return hasFallbackIdent || hasFallbackString;
    });

    const passed = hasFallbackInHtml || hasFallbackInCss || hasFallbackInJs;
    expect(passed).toBe(true);
  });
});
