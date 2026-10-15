import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SHADOW_DOM_GUIDE_HASH = '7c77ee087448';

const TEMPLATE_SCRIPT_TYPES: ReadonlySet<string> = new Set([
  'text/template',
  'text/x-template',
  'text/x-handlebars-template',
  'text/html',
  'text/template-html',
]);

const SHADOW_FEATURE_TOKENS = [
  'shadowrootmode',
  'shadowroot',
  '<template',
  'template.content.cloneNode',
] as const;

const shadowDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector:
    'script[type="text/template"], script[type="text/x-template"], script[type="text/x-handlebars-template"], script[type="text/html"]',
  fastTokens: [
    'text/template',
    'text/x-template',
    'text/x-handlebars-template',
    'text/html',
  ],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['type'],
  matchElement: (element: DomElementView, _ctx: DomMatcherContext) => {
    if (element.tagName !== 'script') {
      return null;
    }

    const type = element.getAttribute('type')?.toLowerCase().trim() ?? '';
    if (!TEMPLATE_SCRIPT_TYPES.has(type)) {
      return null;
    }

    return {
      message:
        `Legacy client-side HTML template in <script type="${type}">; modernize with native <template> or declarative Shadow DOM (<template shadowrootmode="open">).`,
    };
  },
};

function isShadowRootInnerHTMLAssignment(node: Node): boolean {
  if (!Node.isBinaryExpression(node)) {
    return false;
  }
  if (node.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return false;
  }

  const left = unwrapExpression(node.getLeft());
  if (!Node.isPropertyAccessExpression(left)) {
    return false;
  }
  if (left.getName() !== 'innerHTML') {
    return false;
  }

  const targetObj = unwrapExpression(left.getExpression());
  const objText = targetObj.getText();

  const isShadowTarget =
    objText.includes('shadowRoot') ||
    objText === 'shadow' ||
    objText.endsWith('.shadow') ||
    objText === 'root' ||
    objText.endsWith('.root');

  if (!isShadowTarget) {
    return false;
  }

  // Verify the enclosing constructor, method, or file creates a shadow root with attachShadow
  const enclosing =
    node.getFirstAncestorByKind(SyntaxKind.Constructor) ??
    node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ??
    node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
    node.getFirstAncestorByKind(SyntaxKind.ArrowFunction);

  const scopeText = enclosing ? enclosing.getText() : node.getSourceFile().getText();
  return scopeText.includes('attachShadow');
}

const shadowDomJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['attachShadow', 'shadowRoot'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isBinaryExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, SHADOW_FEATURE_TOKENS)) {
        return;
      }

      const line = node.getStartLineNumber();
      if (visitedLines.has(line)) {
        return;
      }

      if (isShadowRootInnerHTMLAssignment(node)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'Imperative attachShadow() with innerHTML re-parses template HTML on every construction; modernize with native <template> cloning or declarative Shadow DOM (<template shadowrootmode="open">).',
        });
      }
    });

    return matches;
  },
};

export const shadowDomRule: AnalyzerRule = {
  id: 'shadow-dom',
  guideId: 'shadow-dom',
  guideHash: SHADOW_DOM_GUIDE_HASH,
  summary:
    'Legacy client-side HTML template script blocks (<script type="text/template">) should be modernized with native <template> or declarative Shadow DOM (<template shadowrootmode="open">).',
  matcher: shadowDomMatcher,
  phase2Rubric: {
    keepWhen: [
      'HTML contains client-side template script blocks (<script type="text/template">, <script type="text/x-template">, <script type="text/html">) used to hold markup for client-side stamping instead of native <template>.',
      'JavaScript component imperatively creates a shadow root via attachShadow() and assigns innerHTML with static template strings on every instance instead of cloning a <template> or using declarative Shadow DOM (<template shadowrootmode="open">).',
    ],
    dropWhen: [
      'The script element contains structured data, JSON-LD (application/ld+json), WebAssembly, or a non-HTML domain-specific language.',
      'The component dynamically constructs shadow tree content from dynamic server data or complex runtime DOM building that cannot be expressed as a static declarative template.',
      'The template is already defined using the native HTML <template> element.',
    ],
  },
};

export const shadowDomJsRule: AnalyzerRule = {
  id: 'shadow-dom/js',
  guideId: 'shadow-dom',
  guideHash: SHADOW_DOM_GUIDE_HASH,
  summary:
    'Imperative attachShadow() with innerHTML assignment should use native <template> content cloning or declarative Shadow DOM (<template shadowrootmode="open">).',
  matcher: shadowDomJsMatcher,
  phase2Rubric: shadowDomRule.phase2Rubric,
};

export const shadowDomRules: readonly AnalyzerRule[] = [
  shadowDomRule,
  shadowDomJsRule,
];
