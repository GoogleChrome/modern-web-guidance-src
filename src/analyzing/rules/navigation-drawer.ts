import { Node, type SourceFile } from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const NAVIGATION_DRAWER_GUIDE_HASH = '3481f6feb2e8';

const FAST_TOKENS: readonly string[] = [
  'drawer',
  'Drawer',
  'sidenav',
  'Sidenav',
  'side-nav',
  'side_nav',
  'SideNav',
  'offcanvas',
  'Offcanvas',
  'off-canvas',
  'OffCanvas',
  'sidebar-menu',
  'sidebar_menu',
  'sidebarMenu',
] as const;

const DRAWER_IDENTIFIER_REGEX =
  /(?:drawer|sidenav|offcanvas|side[-_]?nav|sidebar[-_]?menu)/i;

const BACKDROP_OR_OVERLAY_REGEX =
  /(?:backdrop|overlay|scrim|mask)/i;

const BODY_SCROLL_LOCK_REGEX =
  /(?:overflow\s*=\s*['"]hidden['"]|classList\.(?:add|toggle)\(['"]no-scroll['"])/i;

const CLASS_TOGGLE_REGEX =
  /classList\.(?:add|remove|toggle)\(['"](?:open|is-open|active|show|visible)['"]\)/i;

const NON_DRAWER_TOKEN_REGEX =
  /(?:^|[\s_-])(?:sidebar|static|persistent|collapse|dialog|modal|confirm|header|head|body|footer|content|item|pic|icon|button|btn|close|toggle|trigger|handle|row|list|title|label|backdrop|overlay|scrim|container|tools|col-(?:xs|sm|md|lg|xl)|offcanvas-(?:sm|md|lg|xl|xxl))(?:$|[\s_-])/i;

function isCandidateCallable(node: Node): boolean {
  if (
    !Node.isFunctionDeclaration(node) &&
    !Node.isFunctionExpression(node) &&
    !Node.isArrowFunction(node) &&
    !Node.isMethodDeclaration(node)
  ) {
    return false;
  }
  const parent = node.getParent();
  if (
    (Node.isFunctionExpression(node) || Node.isArrowFunction(node)) &&
    (Node.isParenthesizedExpression(parent) ||
      Node.isPrefixUnaryExpression(parent) ||
      (Node.isCallExpression(parent) && parent.getExpression() === node))
  ) {
    return false;
  }
  const body = node.getBody();
  if (Node.isBlock(body) && body.getStatements().some((s) => Node.isFunctionDeclaration(s))) {
    const fnName = (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) ? (node.getName() ?? '') : '';
    const sig = `${fnName} ${node.getParameters().map((p) => p.getText()).join(' ')}`;
    if (!DRAWER_IDENTIFIER_REGEX.test(sig)) return false;
  }
  return hasDrawerControllerSignals(node.getText().replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''));
}

function hasDrawerControllerSignals(scopeText: string): boolean {
  if (!DRAWER_IDENTIFIER_REGEX.test(scopeText) || scopeText.includes('touchmove')) {
    return false;
  }
  let signals = 0;
  if (CLASS_TOGGLE_REGEX.test(scopeText) || /style\.(?:transform|left|right)\s*=/.test(scopeText)) {
    signals++;
  }
  if (BACKDROP_OR_OVERLAY_REGEX.test(scopeText)) signals++;
  if (BODY_SCROLL_LOCK_REGEX.test(scopeText)) signals++;
  if (scopeText.includes("'Escape'") || scopeText.includes('"Escape"')) signals++;

  return signals >= 2;
}

export const navigationDrawerJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    FAST_TOKENS,
    ['classList', 'style.', 'backdrop', 'Backdrop', 'overlay', 'Overlay', 'scrim', 'mask', 'overflow', 'no-scroll', 'Escape'],
  ],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const lowerPath = ctx.filePath.toLowerCase();
    if (
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/') ||
      lowerPath.includes('/test/data/') ||
      lowerPath.includes('/fixtures/') ||
      lowerPath.includes('/fixture/') ||
      lowerPath.includes('__tests__') ||
      !DRAWER_IDENTIFIER_REGEX.test(ctx.fileContent)
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const matchedLines = new Set<number>();

    const candidates: Node[] = [];
    sourceFile.forEachDescendant((node: Node) => {
      if (isCandidateCallable(node)) candidates.push(node);
    });

    for (const node of candidates) {
      if (
        candidates.some(
          (other) =>
            other !== node &&
            other.getStart() >= node.getStart() &&
            other.getEnd() <= node.getEnd(),
        )
      ) {
        continue;
      }

      const lineNumber = node.getStartLineNumber();
      if (matchedLines.has(lineNumber)) {
        continue;
      }
      matchedLines.add(lineNumber);

      matches.push({
        line: lineNumber,
        message:
          'Navigation drawer controller manually manages visibility classes, backdrop clicks, or body scroll locking; modernize with HTML popover="manual" or <dialog>.',
      });
    }

    return matches;
  },
};

export const navigationDrawerDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'div, nav, aside',
  fastTokens: [
    ['<div', '<Div', '<nav', '<Nav', '<aside', '<Aside'],
    ['class=', 'className=', 'id='],
    ['drawer', 'Drawer', 'sidenav', 'Sidenav', 'side-nav', 'SideNav', 'offcanvas', 'Offcanvas'],
  ],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    const lowerPath = ctx.filePath.toLowerCase();
    if (
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/') ||
      lowerPath.includes('/test/data/') ||
      lowerPath.includes('/fixtures/') ||
      lowerPath.includes('/fixture/') ||
      lowerPath.includes('__tests__')
    ) {
      return null;
    }

    if (element.hasAttribute('popover') || element.tagName.toLowerCase() === 'dialog') {
      return null;
    }

    const elementClass =
      element.getAttribute('class') ?? element.getAttribute('className') ?? '';
    const elementId = element.getAttribute('id') ?? '';
    const combinedIdentifiers = `${elementClass} ${elementId}`.toLowerCase();

    const isDrawerContainer =
      /\b(?:drawer|sidenav|offcanvas|side-nav)\b/i.test(
        combinedIdentifiers,
      );

    if (!isDrawerContainer || NON_DRAWER_TOKEN_REGEX.test(combinedIdentifiers)) {
      return null;
    }

    if (!element.isJsx) {
      const hasDrawerToken =
        /(?:^|\s)(?:drawer|offcanvas)(?:\s|$)/i.test(elementClass) &&
        /(?:drawer|offcanvas|menu)/i.test(elementId);
      const hasInteractiveTrigger =
        /data-(?:bs-)?toggle\s*=\s*["']offcanvas["']|data-drawer-(?:target|show)|data-action\s*=\s*["']open-drawer["']/i.test(
          ctx.documentText,
        );
      if (
        element.getAttribute('tabindex') !== '-1' &&
        !hasInteractiveTrigger &&
        !hasDrawerToken
      ) {
        return null;
      }
    }

    return {
      message:
        'Navigation drawer container implemented without native popover; modernize using popover="manual" with CSS scroll-snap and scroll-driven backdrop animations.',
    };
  },
};

export const navigationDrawerRule: AnalyzerRule = {
  id: 'navigation-drawer',
  guideId: 'navigation-drawer',
  guideHash: NAVIGATION_DRAWER_GUIDE_HASH,
  summary:
    'Custom navigation drawer/off-canvas controller manually toggles visibility classes, backdrop clicks, or body scroll locking; replace with HTML popover="manual" or <dialog>.',
  matcher: navigationDrawerJsMatcher,
  verifierRubric: {
    keepWhen: [
      'The component implements a slide-in navigation drawer, sidenav, or off-canvas menu overlaid on top of page content.',
      'The implementation manually toggles open/closed classes, listens for backdrop/overlay clicks, locks body scroll (overflow: hidden), or listens for Escape keypresses.',
      'The container is a regular div, nav, or aside element without popover="manual" or native <dialog>.',
    ],
    dropWhen: [
      'The element already uses the native HTML popover attribute (e.g. popover="manual" or popover="auto") or <dialog>.',
      'The drawer is an inline persistent responsive sidebar (e.g. desktop dual-column layout) that does not overlay content or dismiss on backdrop click.',
      'The element is a desktop accordion, collapsible card, or disclosure panel rather than an off-canvas navigation overlay.',
    ],
  },
};

export const navigationDrawerDomRule: AnalyzerRule = {
  id: 'navigation-drawer/dom',
  guideId: 'navigation-drawer',
  guideHash: NAVIGATION_DRAWER_GUIDE_HASH,
  summary:
    'Navigation drawer/off-canvas container implemented as a standard element without popover; modernize using popover="manual" with scroll-driven backdrop animations.',
  matcher: navigationDrawerDomMatcher,
  verifierRubric: {
    keepWhen: [
      'The container element represents an off-canvas navigation drawer, sidenav, or slide-in overlay menu.',
      'The markup uses standard div, nav, or aside tags without the popover attribute or native <dialog>.',
    ],
    dropWhen: [
      'The element already defines popover="manual" or popover="auto".',
      'The element is a static, persistent sidebar layout container.',
      'The element is an accordion, dialog, or drawer toggle button.',
    ],
  },
};

export default [
  navigationDrawerRule,
  navigationDrawerDomRule,
] satisfies readonly AnalyzerRule[];
