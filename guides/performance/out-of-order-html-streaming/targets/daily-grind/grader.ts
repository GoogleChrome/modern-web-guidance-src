import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SyntaxKind, type CallExpression, type Node, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import { getCascadedStyle, CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(pathToFileURL(path.join(process.cwd(), 'grader.ts')).href);

interface ProcessingInstructionRange {
  name: string;
  container: any;
  fallbackElements: any[];
  startComment: any;
  endComment: any;
}

/**
 * Finds all `<?start name="...">...<?end>` processing instruction ranges
 * (rewritten as `<!--?start ...-->` and `<!--?end-->` comments by getHtmlDocuments)
 * outside of inert `<template>` elements.
 */
function findProcessingRanges(docs: Array<{ file: string; document: Document }>): ProcessingInstructionRange[] {
  const ranges: ProcessingInstructionRange[] = [];

  for (const { document } of docs) {
    const allElements = [
      document.body,
      ...Array.from(document.querySelectorAll('body *')),
    ].filter((el: any) => Boolean(el) && el.tagName !== 'TEMPLATE' && !el.closest('template'));

    for (const container of allElements) {
      const childNodes = Array.from(container.childNodes || []) as any[];
      let i = 0;
      while (i < childNodes.length) {
        const node = childNodes[i];
        const rawText = String(node?.nodeValue ?? node?.data ?? '').trim();
        if (node?.nodeType === 8 && /^\?start\b/i.test(rawText)) {
          const nameMatch = rawText.match(/^\?start\b[^>]*?\bname\s*=\s*(?:['"]([^'"]+)['"]|([^\s?>]+))/i);
          const name = nameMatch ? (nameMatch[1] || nameMatch[2] || '') : '';
          const fallbackElements: any[] = [];
          let endComment: any = null;
          let j = i + 1;

          while (j < childNodes.length) {
            const sibling = childNodes[j];
            const siblingText = String(sibling?.nodeValue ?? sibling?.data ?? '').trim();
            if (sibling?.nodeType === 8 && /^\?end\b/i.test(siblingText)) {
              endComment = sibling;
              break;
            }
            if (sibling?.nodeType === 1) {
              fallbackElements.push(sibling);
            }
            j++;
          }

          if (endComment) {
            ranges.push({
              name,
              container,
              fallbackElements,
              startComment: node,
              endComment,
            });
            i = j + 1;
            continue;
          }
        }
        i++;
      }
    }
  }

  return ranges;
}

const STREAMING_HTML_METHODS = /^stream(ReplaceWith|Before|Prepend|Append|After)?HTML(Unsafe)?$/;
const SAFE_HTML_METHODS = /^(set|stream|replaceWith|streamReplaceWith|before|streamBefore|prepend|streamPrepend|append|streamAppend|after|streamAfter)HTML$/;
const UNSAFE_HTML_METHODS = /^(set|stream|replaceWith|streamReplaceWith|before|streamBefore|prepend|streamPrepend|append|streamAppend|after|streamAfter)HTMLUnsafe$/;

function getCalledMethodName(call: CallExpression): string | null {
  const expr = call.getExpression();
  if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
    return expr.getName();
  }
  if (expr.isKind(SyntaxKind.ElementAccessExpression)) {
    const arg = expr.getArgumentExpression();
    if (arg && arg.isKind(SyntaxKind.StringLiteral)) {
      return arg.getLiteralValue();
    }
  }
  return null;
}

test.describe('out-of-order-html-streaming Target Grader', () => {
  test('The page initially renders fallback content within a range defined by <?start> and <?end> processing instructions', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const ranges = findProcessingRanges(docs);
    expect(ranges.length).toBeGreaterThan(0);

    const hasNamedRangeWithFallback = ranges.some(
      (range) => range.name.length > 0 && range.fallbackElements.length > 0
    );
    expect(hasNamedRangeWithFallback).toBe(true);
  });

  test('The fallback content is automatically replaced by the final content delivered in a <template for="..."> element', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const ranges = findProcessingRanges(docs);
    expect(ranges.length).toBeGreaterThan(0);

    const templates = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('template[for]')) as any[]
    );
    expect(templates.length).toBeGreaterThan(0);

    const hasMatchingTemplateWithContent = templates.some((tpl: any) => {
      const targetName = (tpl.getAttribute('for') || '').trim();
      if (!targetName) return false;

      const matchingRange = ranges.find((r) => r.name === targetName);
      if (!matchingRange) return false;

      const templateRoot = tpl.content?.children?.length ? tpl.content : tpl;
      const children = Array.from(templateRoot.children || []) as any[];
      const text = String(templateRoot.textContent || tpl.textContent || '').trim();
      return children.length > 0 && text.length > 0;
    });

    expect(hasMatchingTemplateWithContent).toBe(true);
  });

  test('Placeholder containers have stable dimensions (such as min-height or aspect-ratio) to prevent layout shifts', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const ranges = findProcessingRanges(docs);
    expect(ranges.length).toBeGreaterThan(0);

    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = Array.from(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    expect(styleRules.length).toBeGreaterThan(0);

    const dimensionProps = ['min-height', 'aspect-ratio', 'min-block-size', 'height', 'block-size'];

    const hasCascadedDimensionOnPlaceholder = ranges.some((range) => {
      const candidateElements: any[] = [
        range.container,
        ...range.fallbackElements,
        ...range.fallbackElements.flatMap((el: any) => Array.from(el.querySelectorAll('*'))),
      ].filter(Boolean);

      return candidateElements.some((el: any) => {
        const cascaded = getCascadedStyle(el, allRules);
        const hasCssDimension = dimensionProps.some((prop) => {
          const val = cascaded.getPropertyValue(prop).trim();
          return val.length > 0 && val !== 'auto' && val !== 'none' && val !== '0' && val !== '0px';
        });
        const className = String(el.getAttribute?.('class') || '');
        const hasUtilityDimension = /\b(min-h-|aspect-|h-\d|h-\[)/.test(className);
        return hasCssDimension || hasUtilityDimension;
      });
    });

    expect(hasCascadedDimensionOnPlaceholder).toBe(true);
  });

  test('Imperative updates stream the fetch response into a streaming HTML method with pipeTo(), decoding it with Response.textStream() or pipeThrough(new TextDecoderStream())', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    const allCalls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    expect(allCalls.length).toBeGreaterThan(0);

    // 1. Check that fetch() is called
    const hasFetchCall = allCalls.some((call) => {
      const expr = call.getExpression();
      return expr.getText() === 'fetch' || getCalledMethodName(call) === 'fetch';
    });
    expect(hasFetchCall).toBe(true);

    // 2. Check that a streaming HTML method (e.g. streamHTML / streamHTMLUnsafe) is called
    const streamingHtmlCalls = allCalls.filter((call) => {
      const name = getCalledMethodName(call);
      return Boolean(name && STREAMING_HTML_METHODS.test(name));
    });
    expect(streamingHtmlCalls.length).toBeGreaterThan(0);

    // 3. Check pipeTo() calls that decode with .textStream() or .pipeThrough(new TextDecoderStream())
    const pipeToCalls = allCalls.filter((call) => getCalledMethodName(call) === 'pipeTo');
    expect(pipeToCalls.length).toBeGreaterThan(0);

    const hasDecodedStreamPipeTo = pipeToCalls.some((pipeToCall) => {
      const expr = pipeToCall.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;

      // Receiver of .pipeTo(...) must decode via .textStream() or .pipeThrough(new TextDecoderStream())
      const receiver = expr.getExpression();
      const receiverCalls = [
        ...(receiver.isKind(SyntaxKind.CallExpression) ? [receiver] : []),
        ...receiver.getDescendantsOfKind(SyntaxKind.CallExpression),
      ];

      const usesTextStream = receiverCalls.some((c) => getCalledMethodName(c) === 'textStream');
      const usesTextDecoderStream = receiverCalls.some((c) => {
        if (getCalledMethodName(c) !== 'pipeThrough') return false;
        const newExprs = c.getDescendantsOfKind(SyntaxKind.NewExpression);
        return newExprs.some((ne) => ne.getExpression().getText() === 'TextDecoderStream');
      });

      if (!usesTextStream && !usesTextDecoderStream) return false;

      // Argument of .pipeTo(arg) is either directly a streaming HTML method call,
      // or a parameter of a helper function that is called with a streaming HTML method call
      const arg = pipeToCall.getArguments()[0];
      if (!arg) return false;

      const argCalls = [
        ...(arg.isKind(SyntaxKind.CallExpression) ? [arg] : []),
        ...arg.getDescendantsOfKind(SyntaxKind.CallExpression),
      ];
      if (argCalls.some((c) => Boolean(getCalledMethodName(c) && STREAMING_HTML_METHODS.test(getCalledMethodName(c)!)))) {
        return true;
      }

      // Check if pipeTo is inside a helper function (e.g. function pipe(response, writable))
      // that gets invoked with a streaming HTML method call as an argument
      const enclosingFn = pipeToCall.getFirstAncestor(
        (node): boolean =>
          node.isKind(SyntaxKind.FunctionDeclaration) ||
          node.isKind(SyntaxKind.ArrowFunction) ||
          node.isKind(SyntaxKind.FunctionExpression)
      );
      if (enclosingFn) {
        let helperName: string | undefined;
        if (enclosingFn.isKind(SyntaxKind.FunctionDeclaration)) {
          helperName = enclosingFn.getName();
        } else {
          const varDecl = enclosingFn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
          helperName = varDecl?.getName();
        }
        if (helperName) {
          return allCalls.some((c) => {
            if (c.getExpression().getText() !== helperName) return false;
            return c.getArguments().some((callArg) => {
              const nestedCalls = [
                ...(callArg.isKind(SyntaxKind.CallExpression) ? [callArg] : []),
                ...callArg.getDescendantsOfKind(SyntaxKind.CallExpression),
              ];
              return nestedCalls.some(
                (nc) => Boolean(getCalledMethodName(nc) && STREAMING_HTML_METHODS.test(getCalledMethodName(nc)!))
              );
            });
          });
        }
      }

      return false;
    });

    expect(hasDecodedStreamPipeTo).toBe(true);
  });

  test('HTML from users or other untrusted sources is written with a safe method (such as setHTML() or streamHTML()), not with an ...Unsafe() method', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    const allCalls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    // Must call at least one safe HTML setter/streaming method
    const safeHtmlCalls = allCalls.filter((call) => {
      const name = getCalledMethodName(call);
      return Boolean(name && SAFE_HTML_METHODS.test(name));
    });
    expect(safeHtmlCalls.length).toBeGreaterThan(0);

    // Locate functions handling untrusted customer reviews
    const allFunctions = sourceFiles.flatMap((sf) => [
      ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
      ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ]);

    const reviewFunctions = allFunctions.filter((fn) => {
      // Exclude outer module/IIFE wrappers that declare multiple sub-functions
      if (fn.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).length > 0) {
        return false;
      }
      const fnName = fn.isKind(SyntaxKind.FunctionDeclaration)
        ? fn.getName() || ''
        : fn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)?.getName() || '';
      if (/review/i.test(fnName)) return true;
      const fnText = fn.getText();
      return !fnName && /review/i.test(fnText) && !/promo/i.test(fnText);
    });
    expect(reviewFunctions.length).toBeGreaterThan(0);

    // None of the review functions may call an *Unsafe HTML method
    const reviewCallsUnsafe = reviewFunctions.some((fn) =>
      fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const name = getCalledMethodName(call);
        return Boolean(name && UNSAFE_HTML_METHODS.test(name));
      })
    );
    expect(reviewCallsUnsafe).toBe(false);

    // At least one review function must use a safe HTML method directly or via a helper function
    const reviewUsesSafeMethod = reviewFunctions.some((fn) => {
      const fnCalls = fn.getDescendantsOfKind(SyntaxKind.CallExpression);
      const directSafe = fnCalls.some((call) => {
        const name = getCalledMethodName(call);
        return Boolean(name && SAFE_HTML_METHODS.test(name));
      });
      if (directSafe) return true;

      // Check helper functions called by the review function (e.g. setSafeHTML(reviews, ...))
      return fnCalls.some((call) => {
        const calledIdent = call.getExpression().getText();
        return allFunctions.some((helperFn) => {
          const helperName = helperFn.isKind(SyntaxKind.FunctionDeclaration)
            ? helperFn.getName()
            : helperFn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)?.getName();
          if (!helperName || helperName !== calledIdent) return false;
          const helperCalls = helperFn.getDescendantsOfKind(SyntaxKind.CallExpression);
          const helperHasSafe = helperCalls.some((hc) => {
            const name = getCalledMethodName(hc);
            return Boolean(name && SAFE_HTML_METHODS.test(name));
          });
          const helperHasUnsafe = helperCalls.some((hc) => {
            const name = getCalledMethodName(hc);
            return Boolean(name && UNSAFE_HTML_METHODS.test(name));
          });
          return helperHasSafe && !helperHasUnsafe;
        });
      });
    });

    expect(reviewUsesSafeMethod).toBe(true);
  });

  test('The runScripts: true option is only passed to an unsafe method when writing content that contains trusted <script> elements', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    const propAssignments = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    );

    const runScriptsTrueProps = propAssignments.filter(
      (prop) =>
        prop.getName() === 'runScripts' &&
        prop.getInitializer()?.getKind() === SyntaxKind.TrueKeyword
    );
    expect(runScriptsTrueProps.length).toBeGreaterThan(0);

    // Every { runScripts: true } must be passed to an *Unsafe HTML method for the trusted CMS promo content
    const allValidRunScriptsCalls = runScriptsTrueProps.every((prop) => {
      const callExpr = prop.getFirstAncestorByKind(SyntaxKind.CallExpression);
      if (!callExpr) return false;

      const methodName = getCalledMethodName(callExpr);
      if (!methodName || !UNSAFE_HTML_METHODS.test(methodName)) return false;

      const enclosingFn = callExpr.getFirstAncestor(
        (node: Node): boolean =>
          node.isKind(SyntaxKind.FunctionDeclaration) ||
          node.isKind(SyntaxKind.FunctionExpression) ||
          node.isKind(SyntaxKind.ArrowFunction)
      );
      const contextText = (enclosingFn ?? callExpr).getText();

      // Must be used for the trusted promo/CMS content and never for untrusted reviews
      const isTrustedPromoContext = /promo|cms|<script/i.test(contextText);
      const isReviewContext = /review/i.test(callExpr.getText());
      return isTrustedPromoContext && !isReviewContext;
    });

    expect(allValidRunScriptsCalls).toBe(true);
  });

  test('Containers receiving out-of-order updates have appropriate aria-live attributes to notify screen reader users of the changes', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const liveRegions = docs.flatMap(({ document }) =>
      Array.from(
        document.querySelectorAll(
          '[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"], [role="log"]'
        )
      ).filter((el: any) => !el.closest('template'))
    );

    expect(liveRegions.length).toBeGreaterThan(0);
  });
});
