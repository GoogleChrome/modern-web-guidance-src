import {
  Node,
  type CallExpression,
  type ClassDeclaration,
  type ClassExpression,
  type MethodDeclaration,
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

export const ACCESSIBLE_WEB_COMPONENTS_GUIDE_HASH = '0fd7f196ca5f';

const FEATURE_GUARD_TOKENS = [
  'attachInternals',
  'ElementInternals',
  'ariaChecked',
] as const;

/**
 * IDREF-based ARIA attributes cannot be set as plain string properties on ElementInternals
 * (ElementInternals only supports Element reference arrays such as ariaLabelledByElements).
 */
const IDREF_ARIA_ATTRIBUTES = new Set([
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-errormessage',
  'aria-details',
  'aria-flowto',
]);

const CUSTOM_ELEMENT_LIFECYCLE_METHODS = new Set([
  'connectedCallback',
  'disconnectedCallback',
  'attributeChangedCallback',
  'adoptedCallback',
  'firstUpdated',
  'updated',
  'ready',
  'setup',
]);

function isCustomElementClass(
  cls: ClassDeclaration | ClassExpression,
  fileContent: string,
): boolean {
  const clauses = cls.getHeritageClauses();
  if (clauses.length === 0) {
    return false;
  }
  const hasLifecycle =
    cls.getConstructors().length > 0 ||
    cls.getMethods().some((m) => CUSTOM_ELEMENT_LIFECYCLE_METHODS.has(m.getName()));
  for (const clause of clauses) {
    const text = clause.getText();
    if (
      /\b(?:HTMLElement|HTML\w*Element|LitElement|ReactiveElement|FastElement|PolymerElement|CustomElement\w*)\b/.test(
        text,
      )
    ) {
      return true;
    }
    if (hasLifecycle && /\b[A-Z]\w*Element\b/.test(text)) {
      return true;
    }
  }
  if (
    /\b(?:HTMLElement|LitElement|ReactiveElement|PolymerElement|customElements\.define)\b|@customElement\b/.test(
      fileContent,
    ) &&
    hasLifecycle
  ) {
    return true;
  }
  return false;
}

function isHostRoleOrAriaSetAttribute(
  call: CallExpression,
  scopeText: string,
): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== 'setAttribute') {
    return false;
  }
  const receiver = unwrapExpression(expr.getExpression());
  const isHostReceiver =
    Node.isThisExpression(receiver) ||
    (Node.isIdentifier(receiver) &&
      (receiver.getText() === 'that' || receiver.getText() === 'self') &&
      new RegExp(`\\b(?:const|let|var)\\s+${receiver.getText()}\\s*=\\s*this\\b`).test(
        scopeText,
      ));
  if (!isHostReceiver) {
    return false;
  }
  const args = call.getArguments();
  if (args.length < 2) {
    return false;
  }
  const firstArg = unwrapExpression(args[0]);
  if (!Node.isStringLiteral(firstArg)) {
    return false;
  }
  const attrName = firstArg.getLiteralText().toLowerCase().trim();
  if (attrName === 'role') {
    return true;
  }
  if (attrName.startsWith('aria-') && !IDREF_ARIA_ATTRIBUTES.has(attrName)) {
    return true;
  }
  return false;
}

function collectLifecycleMethods(
  cls: ClassDeclaration | ClassExpression,
): Set<MethodDeclaration> {
  const result = new Set<MethodDeclaration>();
  const methodsByName = new Map<string, MethodDeclaration>();

  for (const method of cls.getMethods()) {
    methodsByName.set(method.getName(), method);
  }

  const connected = methodsByName.get('connectedCallback');
  const firstUpdated = methodsByName.get('firstUpdated');
  const updated = methodsByName.get('updated');
  const ready = methodsByName.get('ready');
  const setup = methodsByName.get('setup');
  const attrChanged = methodsByName.get('attributeChangedCallback');
  const queue: Node[] = [
    ...cls.getConstructors(),
    ...(connected ? [connected] : []),
    ...(firstUpdated ? [firstUpdated] : []),
    ...(updated ? [updated] : []),
    ...(ready ? [ready] : []),
    ...(setup ? [setup] : []),
    ...(attrChanged ? [attrChanged] : []),
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const currentText = current.getText();
    current.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }
      const expr = unwrapExpression(node.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const recv = unwrapExpression(expr.getExpression());
        const isHost =
          Node.isThisExpression(recv) ||
          (Node.isIdentifier(recv) &&
            (recv.getText() === 'that' || recv.getText() === 'self') &&
            new RegExp(`\\b(?:const|let|var)\\s+${recv.getText()}\\s*=\\s*this\\b`).test(
              currentText,
            ));
        if (isHost) {
          const helper = methodsByName.get(expr.getName());
          if (helper && !result.has(helper)) {
            result.add(helper);
            queue.push(helper);
          }
        }
      }
    });
  }

  if (connected) result.add(connected);
  if (firstUpdated) result.add(firstUpdated);
  if (updated) result.add(updated);
  if (ready) result.add(ready);
  if (setup) result.add(setup);
  if (attrChanged) result.add(attrChanged);
  return result;
}

const accessibleWebComponentsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['setAttribute'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    if (
      !ctx.fileContent.includes('setAttribute') ||
      (!ctx.fileContent.includes('role') && !ctx.fileContent.includes('aria-')) ||
      !/\b(?:HTMLElement|[A-Z]\w*Element|CustomElement\w*|customElements\.define)\b|@customElement\b/.test(
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
      if (!isCustomElementClass(node, ctx.fileContent)) {
        return;
      }
      const classText = node.getText();
      if (
        !/(?:this|that|self)\s*\.\s*setAttribute\s*\(\s*['"`](?:role|aria-)/i.test(
          classText,
        )
      ) {
        return;
      }
      if (
        /\battachInternals\s*\(/.test(classText) &&
        /(?:internals|#internals|_internals)\s*\.\s*(?:role|aria[A-Z]\w*)\s*=/.test(
          classText,
        )
      ) {
        return;
      }
      if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) {
        return;
      }

      const scopes: Node[] = [
        ...node.getConstructors(),
        ...collectLifecycleMethods(node),
      ];

      for (const scope of scopes) {
        const scopeText = scope.getText();
        if (
          !/(?:this|that|self)\s*\.\s*setAttribute\s*\(\s*['"`](?:role|aria-)/i.test(
            scopeText,
          )
        ) {
          continue;
        }
        let matchedCall: CallExpression | undefined;
        scope.forEachDescendant((desc) => {
          if (matchedCall || !Node.isCallExpression(desc)) {
            return;
          }
          if (
            isHostRoleOrAriaSetAttribute(desc, scopeText) &&
            !isProtectedByFeatureGuard(desc, FEATURE_GUARD_TOKENS)
          ) {
            matchedCall = desc;
          }
        });
        if (!matchedCall) {
          continue;
        }
        const line = matchedCall.getStartLineNumber();
        if (!visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'Custom element sets default role or ARIA state on the host via this.setAttribute() in constructor/connectedCallback; use this.attachInternals() (internals.role / internals.aria*) to avoid polluting Light DOM attributes.',
          });
        }
      }
    });

    return matches;
  },
};

export const accessibleWebComponentsRule: AnalyzerRule = {
  id: 'accessible-web-components',
  guideId: 'accessible-web-components',
  guideHash: ACCESSIBLE_WEB_COMPONENTS_GUIDE_HASH,
  summary:
    'Set default custom element role and ARIA state via the ElementInternals ARIA mixin (this.attachInternals()) instead of mutating host attributes with this.setAttribute() in constructor or connectedCallback.',
  matcher: accessibleWebComponentsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A custom element class extending HTMLElement, LitElement, or CustomElementBase sets its default role or ARIA state on the host element via this.setAttribute("role", ...) or this.setAttribute("aria-*", ...) in constructor(), connectedCallback(), firstUpdated(), updated(), ready(), setup(), or attributeChangedCallback().',
      'Using this.attachInternals() (e.g. internals.role and internals.ariaChecked) exposes default semantics to the accessibility tree without polluting Light DOM attributes or clobbering consumer overrides.',
    ],
    dropWhen: [
      'setAttribute is called on an internal shadow DOM child or light DOM child element rather than on the custom element host (this).',
      'The custom element already sets role or aria* properties on ElementInternals and only falls back to this.setAttribute() when ElementInternals ARIA properties are unsupported.',
      'The code is a minified or bundled third-party vendor script (e.g. single-line minified class declarations with mangled 1-2 character class names).',
    ],
  },
};

export default [
  accessibleWebComponentsRule,
] satisfies readonly AnalyzerRule[];
