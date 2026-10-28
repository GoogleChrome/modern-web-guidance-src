import {
  Node,
  type ClassDeclaration,
  type ClassExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const FORM_ASSOCIATED_CUSTOM_ELEMENTS_GUIDE_HASH = '8f95e4c7f6d0';

const FEATURE_GUARD_TOKENS = [
  'formAssociated',
  'attachInternals',
  'ElementInternals',
  'setFormValue',
] as const;

const HTML_INPUT_HIDDEN_REGEX =
  /<input\b[^>]*\btype\s*=\s*(?:['"]hidden['"]|hidden\b)/i;

const QUERY_HIDDEN_INPUT_REGEX =
  /input\s*\[\s*type\s*=\s*['"]?hidden['"]?\s*\]/i;

function isCustomElementClass(
  cls: ClassDeclaration | ClassExpression,
): boolean {
  for (const clause of cls.getHeritageClauses()) {
    const text = clause.getText();
    if (
      /\b(?:HTMLElement|HTML\w*Element|LitElement|ReactiveElement|FastElement|Smart\.\w+)\b/.test(
        text,
      )
    ) {
      return true;
    }
  }
  return false;
}

function classAlreadyUsesFace(classText: string): boolean {
  return (
    /\bformAssociated\b/.test(classText) ||
    /\battachInternals\s*\(/.test(classText) ||
    /\bsetFormValue\s*\(/.test(classText)
  );
}

function isCreateElementInputCall(node: Node): boolean {
  if (!Node.isCallExpression(node)) {
    return false;
  }
  const expr = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== 'createElement') {
    return false;
  }
  const args = node.getArguments();
  if (args.length === 0) {
    return false;
  }
  const firstArg = unwrapExpression(args[0]);
  return (
    Node.isStringLiteral(firstArg) &&
    firstArg.getLiteralText().toLowerCase() === 'input'
  );
}

function isHiddenTypeAssignmentOnClass(
  cls: ClassDeclaration | ClassExpression,
): Node | undefined {
  let createInputNode: Node | undefined;
  let setsHiddenTypeNode: Node | undefined;

  cls.forEachDescendant((node) => {
    if (!createInputNode && isCreateElementInputCall(node)) {
      createInputNode = node;
    }
    if (!setsHiddenTypeNode) {
      if (Node.isBinaryExpression(node) && node.getOperatorToken().getText() === '=') {
        const left = unwrapExpression(node.getLeft());
        const right = unwrapExpression(node.getRight());
        if (
          Node.isPropertyAccessExpression(left) &&
          left.getName() === 'type' &&
          Node.isStringLiteral(right) &&
          right.getLiteralText().toLowerCase() === 'hidden'
        ) {
          setsHiddenTypeNode = node;
        }
      } else if (Node.isCallExpression(node)) {
        const expr = unwrapExpression(node.getExpression());
        const args = node.getArguments();
        if (
          Node.isPropertyAccessExpression(expr) &&
          expr.getName() === 'setAttribute' &&
          args.length >= 2
        ) {
          const attrName = unwrapExpression(args[0]);
          const attrVal = unwrapExpression(args[1]);
          if (
            Node.isStringLiteral(attrName) &&
            attrName.getLiteralText().toLowerCase() === 'type' &&
            Node.isStringLiteral(attrVal) &&
            attrVal.getLiteralText().toLowerCase() === 'hidden'
          ) {
            setsHiddenTypeNode = node;
          }
        }
      }
    }
  });

  if (createInputNode && setsHiddenTypeNode) {
    return setsHiddenTypeNode;
  }

  let templateHiddenNode: Node | undefined;
  let syncsInputValue = false;

  cls.forEachDescendant((node) => {
    if (
      !templateHiddenNode &&
      (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node) || Node.isTemplateExpression(node))
    ) {
      const text = node.getText();
      if (HTML_INPUT_HIDDEN_REGEX.test(text) || QUERY_HIDDEN_INPUT_REGEX.test(text)) {
        templateHiddenNode = node;
      }
    }
    if (!syncsInputValue && Node.isBinaryExpression(node) && node.getOperatorToken().getText() === '=') {
      const left = unwrapExpression(node.getLeft());
      if (Node.isPropertyAccessExpression(left) && left.getName() === 'value') {
        const receiverText = left.getExpression().getText();
        if (receiverText !== 'this' && /(?:input|hidden|field|control)/i.test(receiverText)) {
          syncsInputValue = true;
        }
      }
    }
    if (!syncsInputValue && Node.isCallExpression(node)) {
      const expr = unwrapExpression(node.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName();
        const receiverText = expr.getExpression().getText();
        if (
          methodName === 'setAttribute' &&
          /(?:input|hidden|field|control)/i.test(receiverText)
        ) {
          const args = node.getArguments();
          if (args.length >= 2) {
            const firstArg = unwrapExpression(args[0]);
            if (
              Node.isStringLiteral(firstArg) &&
              (firstArg.getLiteralText().toLowerCase() === 'value' ||
                firstArg.getLiteralText().toLowerCase() === 'name')
            ) {
              syncsInputValue = true;
            }
          }
        } else if (/updateHid+enInput/i.test(methodName)) {
          syncsInputValue = true;
        }
      }
    }
  });

  if (templateHiddenNode && syncsInputValue) {
    return templateHiddenNode;
  }

  return undefined;
}

const formAssociatedCustomElementsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['extends HTMLElement', 'extends LitElement', 'hiddenInput'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    if (
      !ctx.fileContent.includes('hidden') ||
      !/\b(?:HTMLElement|HTML\w*Element|LitElement|ReactiveElement|FastElement|Smart\.)\b/.test(
        ctx.fileContent,
      )
    ) {
      return matches;
    }
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isClassDeclaration(node) && !Node.isClassExpression(node)) {
        return;
      }
      if (!isCustomElementClass(node)) {
        return;
      }
      const classText = node.getText();
      if (classAlreadyUsesFace(classText)) {
        return;
      }
      if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) {
        return;
      }

      const hiddenNode = isHiddenTypeAssignmentOnClass(node);
      if (!hiddenNode) {
        return;
      }
      if (isProtectedByFeatureGuard(hiddenNode, FEATURE_GUARD_TOKENS)) {
        return;
      }

      const line = hiddenNode.getStartLineNumber();
      if (!visitedLines.has(line)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'Custom element uses a hidden <input type="hidden"> to surface its value to a form; use static formAssociated = true and ElementInternals.setFormValue() instead.',
        });
      }
    });

    return matches;
  },
};

export const formAssociatedCustomElementsRule: AnalyzerRule = {
  id: 'form-associated-custom-elements',
  guideId: 'form-associated-custom-elements',
  guideHash: FORM_ASSOCIATED_CUSTOM_ELEMENTS_GUIDE_HASH,
  summary:
    'Custom elements should participate natively in forms using static formAssociated = true and ElementInternals.setFormValue() instead of injecting and syncing a hidden <input>.',
  matcher: formAssociatedCustomElementsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A custom element class extending HTMLElement creates or queries an internal or light-DOM <input type="hidden"> to submit its value to an ancestor <form>.',
      'Replacing the hidden <input> workaround with static formAssociated = true and this.attachInternals().setFormValue() lets the custom element participate natively in form submission, reset, and validation.',
    ],
    dropWhen: [
      'The custom element already declares static formAssociated = true or uses attachInternals().setFormValue(), and the hidden <input> is an explicit feature-detected fallback.',
      'The <input> element inside the custom element is a visible interactive text/number/checkbox control rather than a hidden form-submission proxy.',
      'The hidden <input> is part of a full server-submitted <form> rendered by a page-level component (such as a CSRF token field) rather than a custom form control widget.',
    ],
  },
};

export default [
  formAssociatedCustomElementsRule,
] satisfies readonly AnalyzerRule[];
