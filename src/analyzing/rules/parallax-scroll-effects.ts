import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import {
  matchEventListenerCall,
  resolveCallableNode,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const PARALLAX_SCROLL_EFFECTS_GUIDE_HASH = '94614c5601e1';

const VERTICAL_SCROLL_READ_RE =
  /\b(scrollY|pageYOffset|scrollTop)\b|getBoundingClientRect\s*\(\s*\)/;

const PARALLAX_TRANSLATE_OR_BG_RE =
  /\bstyle\s*\.\s*(?:transform|translate|backgroundPositionY|backgroundPosition)\s*=|\.\s*css\s*\(\s*(?:['"](?:transform|background-position|backgroundPosition|background-position-y)['"]|\{[^}]*\b(?:transform|backgroundPosition|background-position))/i;

const VERTICAL_MOTION_VALUE_RE =
  /\btranslate(?:Y|3d)\s*\(|\btranslate\s*\(\s*0(?:px)?\s*,|\bbackgroundPosition|\bbackground-position/i;

const SPEED_FACTOR_RE =
  /[*/]\s*(?:-?[0-9.]+|[a-zA-Z_$][\w$]*)|\b(?:speed|rate|factor|depth|parallax|ratio)\b|dataset\s*\.\s*(?:speed|rate|parallax|depth)|getAttribute\s*\(\s*['"]data-(?:speed|rate|parallax|depth)['"]\s*\)/i;

// Carve out scroll-progress-indicator, sticky headers, pull-to-refresh, virtual lists
const EXCLUSION_RE =
  /\b(scrollHeight|reading-progress|scroll-progress|progress-bar|scroll-handle|scrollbar|refresher|virtual|listView|monaco|px_per_sec|playhead|_condenseHeader|paper-scroll-header)\b/i;

function isAlreadyModern(fileContent: string): boolean {
  return (
    fileContent.includes('animation-timeline') &&
    (fileContent.includes('view(') || fileContent.includes('scroll('))
  );
}

function expandHandlerText(handler: Node): string {
  const root = resolveCallableNode(handler);
  const rootText = root.getText();
  if (rootText.length > 350) {
    return rootText;
  }
  const parts = [rootText];
  const calls = [
    ...(Node.isCallExpression(root) ? [root] : []),
    ...root.getDescendantsOfKind(SyntaxKind.CallExpression).slice(0, 4),
  ];
  for (const call of calls) {
    const callee = resolveCallableNode(call.getExpression());
    if (callee !== call.getExpression()) {
      parts.push(callee.getText());
    }
    const firstArg = call.getArguments()[0];
    if (firstArg) {
      const resolvedArg = resolveCallableNode(firstArg);
      if (resolvedArg !== firstArg) {
        parts.push(resolvedArg.getText());
      }
    }
  }
  return parts.join('\n');
}

function isParallaxCallbackText(text: string): boolean {
  if (!VERTICAL_SCROLL_READ_RE.test(text)) return false;
  if (!PARALLAX_TRANSLATE_OR_BG_RE.test(text)) return false;
  if (!VERTICAL_MOTION_VALUE_RE.test(text)) return false;
  if (!SPEED_FACTOR_RE.test(text)) return false;
  if (EXCLUSION_RE.test(text)) return false;
  if (/\bscrollLeft\b/.test(text) && !/\bparallax\b/i.test(text)) return false;
  return true;
}

function matchScrollCall(
  call: CallExpression,
): AnalyzerMatch | null {
  const listener = matchEventListenerCall(call, ['scroll']);
  if (!listener) return null;

  const fullText = expandHandlerText(listener.handlerNode);
  if (!isParallaxCallbackText(fullText)) {
    return null;
  }

  return {
    line: call.getStartLineNumber(),
    column: call.getStartLinePos(),
    message:
      'Scroll listener computing vertical parallax translation or background-position from scrollY/scrollTop; replace with CSS animation-timeline: view() or scroll().',
  };
}

export const parallaxScrollEffectsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scroll', 'onscroll'] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (isAlreadyModern(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const m = matchScrollCall(call);
      if (m && !seenLines.has(m.line)) {
        seenLines.add(m.line);
        matches.push(m);
      }
    }

    for (const bin of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
      const leftText = bin.getLeft().getText();
      if (!leftText.endsWith('.onscroll')) continue;
      const callback = resolveCallableNode(bin.getRight());
      const fullText = expandHandlerText(callback);
      if (isParallaxCallbackText(fullText)) {
        const line = bin.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({
            line,
            column: bin.getStartLinePos(),
            message:
              'onscroll handler computing vertical parallax translation or background-position from scrollY/scrollTop; replace with CSS animation-timeline: view() or scroll().',
          });
        }
      }
    }

    return matches;
  },
};

export const parallaxScrollEffectsRule: AnalyzerRule = {
  id: 'parallax-scroll-effects',
  guideId: 'parallax-scroll-effects',
  guideHash: PARALLAX_SCROLL_EFFECTS_GUIDE_HASH,
  summary:
    'Detects scroll event listeners that compute vertical parallax translateY/translate3d or backgroundPosition offsets from scrollY/scrollTop instead of CSS animation-timeline: view() or scroll().',
  matcher: parallaxScrollEffectsMatcher,
  verifierRubric: {
    keepWhen: [
      'Scroll listener or requestAnimationFrame handler reading vertical scroll offset (scrollY, pageYOffset, scrollTop, or getBoundingClientRect().top) and multiplying by a speed factor to set inline translateY, translate3d, or backgroundPosition for a parallax effect',
    ],
    dropWhen: [
      'Scroll progress bar or custom scrollbar thumb calculating scrollY / (scrollHeight - innerHeight)',
      'Sticky header or back-to-top button toggling visibility or fixed state past a pixel threshold',
      'Virtualized list, infinite scroll loader, or pull-to-refresh gesture handler',
    ],
  },
};

export default [parallaxScrollEffectsRule] satisfies readonly AnalyzerRule[];
