import {
  Node,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH = '900026d2769b';

const TOAST_GUARD_TOKENS = [
  'popover',
  'showPopover',
  'hidePopover',
  'togglePopover',
] as const;

const NOTYF_METHODS: ReadonlySet<string> = new Set([
  'success',
  'error',
  'open',
]);

const TOASTR_METHODS: ReadonlySet<string> = new Set([
  'info',
  'success',
  'warning',
  'error',
]);

function matchesPackageSpec(
  spec: string | null,
  packages: readonly string[],
): boolean {
  return (
    spec !== null &&
    packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))
  );
}

function isRequireOfPackage(
  node: Node,
  packages: readonly string[],
): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped)) {
    return false;
  }
  const callee = unwrapExpression(unwrapped.getExpression());
  const firstArg = unwrapped.getArguments()[0];
  if (
    Node.isIdentifier(callee) &&
    callee.getText() === 'require' &&
    firstArg &&
    Node.isStringLiteral(firstArg)
  ) {
    return matchesPackageSpec(firstArg.getLiteralText(), packages);
  }
  return false;
}

function checkEnclosingBindings(
  identNode: Node,
  localName: string,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean,
): 'matched' | 'shadowed' | 'none' {
  let current: Node | undefined = identNode.getParent();
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      if (
        (Node.isFunctionDeclaration(current) || Node.isFunctionExpression(current)) &&
        current.getName() === localName
      ) {
        return 'shadowed';
      }
      for (const param of current.getParameters()) {
        for (const el of param.getDescendantsOfKind(
          identNode.getKind(),
        )) {
          if (el.getText() === localName && el.getParent() !== current) {
            return 'shadowed';
          }
        }
      }
    }

    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      for (const stmt of current.getStatements()) {
        if (!Node.isVariableStatement(stmt)) {
          continue;
        }
        for (const decl of stmt.getDeclarationList().getDeclarations()) {
          const nameNode = decl.getNameNode();
          if (Node.isObjectBindingPattern(nameNode)) {
            for (const el of nameNode.getElements()) {
              if (el.getName() === localName) {
                const propName = el.getPropertyNameNode()?.getText() ?? el.getName();
                const init = decl.getInitializer();
                if (
                  init &&
                  (propName === identName || (allowDefaultImport && propName === 'default')) &&
                  isRequireOfPackage(resolveLocalExpression(init, 2), packages)
                ) {
                  return 'matched';
                }
                return 'shadowed';
              }
            }
          } else if (Node.isArrayBindingPattern(nameNode)) {
            for (const el of nameNode.getElements()) {
              if (Node.isBindingElement(el) && el.getName() === localName) {
                return 'shadowed';
              }
            }
          }
        }
      }
    }

    current = current.getParent();
  }
  return 'none';
}

function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean = true,
  allowGlobal: boolean = true,
): boolean {
  const unwrapped = unwrapExpression(node);

  if (allowDefaultImport && isRequireOfPackage(unwrapped, packages)) {
    return true;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    const propName = unwrapped.getName();
    if (propName === identName || (allowDefaultImport && propName === 'default')) {
      const receiver = unwrapped.getExpression();
      if (isRequireOfPackage(resolveLocalExpression(receiver, 2), packages)) {
        return true;
      }
    }
  }

  if (Node.isIdentifier(unwrapped)) {
    const localName = unwrapped.getText();
    const sourceFile = unwrapped.getSourceFile();

    for (const imp of sourceFile.getImportDeclarations()) {
      const matchesPkg = matchesPackageSpec(getSafeModuleSpecifier(imp), packages);
      if (
        imp.getDefaultImport()?.getText() === localName ||
        imp.getNamespaceImport()?.getText() === localName
      ) {
        return allowDefaultImport && matchesPkg;
      }
      for (const named of imp.getNamedImports()) {
        const importedName = named.getName();
        const boundName = named.getAliasNode()?.getText() ?? importedName;
        if (boundName === localName) {
          return (
            matchesPkg &&
            (importedName === identName ||
              (allowDefaultImport && importedName === 'default'))
          );
        }
      }
    }

    const bindingStatus = checkEnclosingBindings(
      unwrapped,
      localName,
      identName,
      packages,
      allowDefaultImport,
    );
    if (bindingStatus === 'matched') {
      return true;
    }
    if (bindingStatus === 'shadowed') {
      return false;
    }

    const resolved = resolveLocalExpression(unwrapped, 2);
    if (resolved !== unwrapped) {
      if (allowDefaultImport && isRequireOfPackage(resolved, packages)) {
        return true;
      }
      if (Node.isPropertyAccessExpression(resolved)) {
        const propName = resolved.getName();
        if (
          (propName === identName || (allowDefaultImport && propName === 'default')) &&
          isRequireOfPackage(resolveLocalExpression(resolved.getExpression(), 2), packages)
        ) {
          return true;
        }
      }
      return false;
    }
  }

  if (allowGlobal && isGlobalReference(unwrapped, identName)) {
    return true;
  }

  return false;
}

const DISQUALIFYING_TOAST_OPTION_KEYS: ReadonlySet<string> = new Set([
  'progressBar',
  'preventDuplicates',
  'maxOpened',
  'newestOnTop',
  'onclick',
  'onClick',
  'onCloseClick',
  'tapToDismiss',
  'destination',
  'newWindow',
  'callback',
]);

function hasDisqualifyingToastOptions(obj: ObjectLiteralExpression): boolean {
  for (const prop of obj.getProperties()) {
    if (
      Node.isPropertyAssignment(prop) ||
      Node.isShorthandPropertyAssignment(prop) ||
      Node.isMethodDeclaration(prop)
    ) {
      const name = prop.getName();
      if (DISQUALIFYING_TOAST_OPTION_KEYS.has(name)) {
        const init = Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;
        const initText = init ? unwrapExpression(init).getText() : undefined;
        if (
          initText === undefined ||
          (initText !== 'false' && initText !== 'null' && initText !== 'undefined')
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

const VIEWPORT_UNIT_REGEX = /\b\d+(?:\.\d+)?(?:vh|vw|vmin|vmax|dvh|svh|lvh|dvw)\b/i;
const INLINE_FIXED_STYLE_REGEX = /\bposition\s*:\s*fixed\b/i;
const VIEWPORT_OFFSET_PROP_NAMES: ReadonlySet<string> = new Set([
  'top',
  'bottom',
  'left',
  'right',
  'inset',
]);

function getStaticStringText(node: Node | undefined): string | null {
  if (!node) {
    return null;
  }
  const unwrapped = unwrapExpression(node);
  if (Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.getLiteralText();
  }
  return null;
}

function isBodyTargetNode(node: Node | undefined): boolean {
  if (!node) {
    return false;
  }
  const unwrapped = unwrapExpression(node);
  const literal = getStaticStringText(unwrapped);
  if (literal !== null) {
    return literal.trim().toLowerCase() === 'body';
  }
  const text = unwrapped.getText().trim();
  if (text === 'document.body' || text === 'window.document.body') {
    return true;
  }
  return /^(?:\$|jQuery)\(\s*(?:['"]body['"]|(?:window\.)?document\.body)\s*\)$/.test(text);
}

function hasInlineFixedOrViewportCssText(styleText: string): boolean {
  if (INLINE_FIXED_STYLE_REGEX.test(styleText)) {
    return true;
  }
  return (
    /\b(?:top|bottom|left|right|inset)\s*:\s*[^;{}]*/i.test(styleText) &&
    VIEWPORT_UNIT_REGEX.test(styleText)
  );
}

function hasFixedOrViewportCssCall(call: CallExpression): boolean {
  const args = call.getArguments();
  const first = args[0];
  if (!first) {
    return false;
  }
  const firstStr = getStaticStringText(first);
  if (firstStr !== null && args.length >= 2) {
    const propName = firstStr.trim().toLowerCase();
    const secondStr = getStaticStringText(args[1]) ?? unwrapExpression(args[1]!).getText().trim();
    if (propName === 'position' && /^['"]?fixed['"]?$/i.test(secondStr.trim())) {
      return true;
    }
    if (VIEWPORT_OFFSET_PROP_NAMES.has(propName) && VIEWPORT_UNIT_REGEX.test(secondStr)) {
      return true;
    }
    return false;
  }

  const unwrappedFirst = unwrapExpression(first);
  if (Node.isObjectLiteralExpression(unwrappedFirst)) {
    for (const prop of unwrappedFirst.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) {
        continue;
      }
      const key = prop.getName().replace(/^['"]|['"]$/g, '').toLowerCase();
      const init = prop.getInitializer();
      if (!init) {
        continue;
      }
      const valStr = getStaticStringText(init) ?? unwrapExpression(init).getText().trim();
      if (key === 'position' && /^['"]?fixed['"]?$/i.test(valStr.trim())) {
        return true;
      }
      if (VIEWPORT_OFFSET_PROP_NAMES.has(key) && VIEWPORT_UNIT_REGEX.test(valStr)) {
        return true;
      }
    }
  }
  return false;
}

function hasFixedOrViewportAttrCall(call: CallExpression): boolean {
  const args = call.getArguments();
  const first = args[0];
  if (!first) {
    return false;
  }
  const firstStr = getStaticStringText(first);
  if (firstStr !== null && firstStr.trim().toLowerCase() === 'style' && args.length >= 2) {
    const styleVal = getStaticStringText(args[1]);
    return styleVal !== null && hasInlineFixedOrViewportCssText(styleVal);
  }
  const unwrappedFirst = unwrapExpression(first);
  if (Node.isObjectLiteralExpression(unwrappedFirst)) {
    for (const prop of unwrappedFirst.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) {
        continue;
      }
      const key = prop.getName().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (key === 'style') {
        const styleVal = getStaticStringText(prop.getInitializer());
        if (styleVal !== null && hasInlineFixedOrViewportCssText(styleVal)) {
          return true;
        }
      }
    }
  }
  return false;
}

function chainNodeHasToastPlacementSignal(startNode: Node): {
  hasSignal: boolean;
  rootNode: Node;
} {
  let current = unwrapExpression(startNode);
  while (Node.isCallExpression(current)) {
    const expr = unwrapExpression(current.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const mName = expr.getName();
      if (
        (mName === 'appendTo' || mName === 'prependTo') &&
        isBodyTargetNode(current.getArguments()[0])
      ) {
        return { hasSignal: true, rootNode: current };
      }
      if (mName === 'css' && hasFixedOrViewportCssCall(current)) {
        return { hasSignal: true, rootNode: current };
      }
      if (mName === 'attr' && hasFixedOrViewportAttrCall(current)) {
        return { hasSignal: true, rootNode: current };
      }
      current = unwrapExpression(expr.getExpression());
      continue;
    }

    // Root call like `$('<div style="position: fixed">')` or `$(el)`
    const calleeText = expr.getText().trim();
    if (calleeText === '$' || calleeText === 'jQuery') {
      const rootArg = current.getArguments()[0];
      const htmlLiteral = getStaticStringText(rootArg);
      if (
        htmlLiteral !== null &&
        /\bstyle\s*=\s*["']([^"']*)["']/i.test(htmlLiteral) &&
        hasInlineFixedOrViewportCssText(htmlLiteral)
      ) {
        return { hasSignal: true, rootNode: current };
      }
      if (rootArg) {
        return { hasSignal: false, rootNode: unwrapExpression(rootArg) };
      }
    }
    break;
  }

  return { hasSignal: false, rootNode: current };
}

function identifierHasBlockPlacementSignal(identNode: Node): boolean {
  if (!Node.isIdentifier(identNode)) {
    return false;
  }
  const varName = identNode.getText();
  const resolved = resolveLocalExpression(identNode, 2);
  if (resolved !== identNode && chainNodeHasToastPlacementSignal(resolved).hasSignal) {
    return true;
  }

  let container: Node | undefined = identNode.getParent();
  while (container && !Node.isBlock(container) && !Node.isSourceFile(container)) {
    container = container.getParent();
  }
  if (!container) {
    return false;
  }

  for (const stmt of container.getStatements()) {
    const stmtText = stmt.getText();
    if (!stmtText.includes(varName)) {
      continue;
    }
    let found = false;
    stmt.forEachDescendant((desc) => {
      if (found) {
        return;
      }
      if (Node.isCallExpression(desc)) {
        const expr = unwrapExpression(desc.getExpression());
        if (Node.isPropertyAccessExpression(expr)) {
          const mName = expr.getName();
          const recv = unwrapExpression(expr.getExpression());
          // `document.body.appendChild(el)` or `$('body').append(el)`
          if (
            (mName === 'appendChild' || mName === 'append' || mName === 'prepend') &&
            isBodyTargetNode(recv) &&
            desc.getArguments().some((a) => unwrapExpression(a).getText() === varName)
          ) {
            found = true;
            return;
          }
          // `el.appendTo('body')` / `$(el).css({ position: 'fixed' })`
          const recvCheck = chainNodeHasToastPlacementSignal(desc);
          if (
            recvCheck.hasSignal &&
            Node.isIdentifier(recvCheck.rootNode) &&
            recvCheck.rootNode.getText() === varName
          ) {
            found = true;
          }
        }
      } else if (Node.isBinaryExpression(desc) && desc.getOperatorToken().getText() === '=') {
        const leftText = desc.getLeft().getText().replace(/\s+/g, '');
        const rightStr =
          getStaticStringText(desc.getRight()) ?? unwrapExpression(desc.getRight()).getText();
        if (
          leftText === `${varName}.style.position` &&
          /^['"]?fixed['"]?$/i.test(rightStr.trim())
        ) {
          found = true;
        } else if (
          leftText === `${varName}.style.cssText` &&
          hasInlineFixedOrViewportCssText(rightStr)
        ) {
          found = true;
        }
      }
    });
    if (found) {
      return true;
    }
  }

  return false;
}

function matchHandRolledToast(node: CallExpression): string | null {
  const callee = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }
  const methodName = callee.getName();
  if (methodName !== 'fadeOut' && methodName !== 'slideUp' && methodName !== 'hide') {
    return null;
  }

  let walker: Node | undefined = unwrapExpression(callee.getExpression());
  let hasAnimatedEntry = false;
  let hasShowEntry = false;
  let hasDelay = false;

  while (walker && Node.isCallExpression(walker)) {
    const wExpr = unwrapExpression(walker.getExpression());
    if (!Node.isPropertyAccessExpression(wExpr)) {
      break;
    }
    const wName = wExpr.getName();
    if (wName === 'fadeIn' || wName === 'slideDown') {
      hasAnimatedEntry = true;
    } else if (wName === 'show') {
      hasShowEntry = true;
    } else if (wName === 'delay') {
      hasDelay = true;
    }
    walker = unwrapExpression(wExpr.getExpression());
  }

  const hasValidToastLifecycle =
    methodName === 'hide'
      ? hasDelay && (hasAnimatedEntry || hasShowEntry)
      : hasAnimatedEntry || (hasShowEntry && hasDelay);
  if (!hasValidToastLifecycle) {
    return null;
  }

  const placementCheck = chainNodeHasToastPlacementSignal(node);
  const hasSecondSignal =
    placementCheck.hasSignal || identifierHasBlockPlacementSignal(placementCheck.rootNode);

  if (!hasSecondSignal) {
    return null;
  }

  return 'Hand-rolled toast notification using animation and DOM insertion can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.';
}

function isToastifyInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isCallExpression(resolved) || Node.isNewExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'Toastify', ['toastify-js'])) {
      const firstArg = resolved.getArguments()[0];
      if (firstArg) {
        const resolvedArg = resolveLocalExpression(firstArg, 2);
        if (
          Node.isObjectLiteralExpression(resolvedArg) &&
          hasDisqualifyingToastOptions(resolvedArg)
        ) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

function isNotyfInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isNewExpression(resolved) || Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'Notyf', ['notyf'])) {
      const firstArg = resolved.getArguments()[0];
      if (firstArg) {
        const resolvedArg = resolveLocalExpression(firstArg, 2);
        if (
          Node.isObjectLiteralExpression(resolvedArg) &&
          hasDisqualifyingToastOptions(resolvedArg)
        ) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

function matchToastCall(callExpr: CallExpression): string | null {
  const handRolledMsg = matchHandRolledToast(callExpr);
  if (handRolledMsg) {
    return handRolledMsg;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  const receiver = callee.getExpression();

  if (methodName === 'showToast' && isToastifyInstance(receiver)) {
    return 'Toastify(...).showToast() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.';
  }

  const args = callExpr.getArguments();

  if (
    NOTYF_METHODS.has(methodName) &&
    args.length > 0 &&
    isNotyfInstance(receiver)
  ) {
    const firstArg = args[0];
    if (firstArg) {
      const resolvedFirst = resolveLocalExpression(firstArg, 2);
      if (
        Node.isObjectLiteralExpression(resolvedFirst) &&
        hasDisqualifyingToastOptions(resolvedFirst)
      ) {
        return null;
      }
    }
    return `new Notyf().${methodName}() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.`;
  }

  if (
    TOASTR_METHODS.has(methodName) &&
    args.length > 0 &&
    args.length <= 3 &&
    isLibraryReference(receiver, 'toastr', ['toastr'])
  ) {
    for (const arg of args) {
      const resolvedArg = resolveLocalExpression(arg, 2);
      if (
        Node.isObjectLiteralExpression(resolvedArg) &&
        hasDisqualifyingToastOptions(resolvedArg)
      ) {
        return null;
      }
    }
    return `toastr.${methodName}() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.`;
  }

  return null;
}

function fileUsesManualPopoverOrQueueManager(fileContent: string): boolean {
  return (
    /popover\s*=\s*["']manual["']/i.test(fileContent) ||
    fileContent.includes('showPopover') ||
    /\btoastr\.(?:options|clear|remove)\b/.test(fileContent) ||
    /\bdismissAll\s*\(/.test(fileContent)
  );
}

export const persistentToastNotificationsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Toastify', 'Notyf', 'toastr', 'fadeOut', 'slideUp', 'delay'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (fileUsesManualPopoverOrQueueManager(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const matchedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const line = node.getStartLineNumber();
      if (matchedLines.has(line)) {
        return;
      }

      const msg = matchToastCall(node);
      if (msg && !isProtectedByFeatureGuard(node, TOAST_GUARD_TOKENS)) {
        matchedLines.add(line);
        matches.push({
          line,
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const persistentToastNotificationsJsRule: AnalyzerRule = {
  id: 'persistent-toast-notifications/js-toast',
  guideId: 'persistent-toast-notifications',
  guideHash: PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH,
  summary:
    'JavaScript toast notification calls (Toastify().showToast, new Notyf().success/error, toastr.info/success/warning/error) should be modernized with HTML popover="manual".',
  matcher: persistentToastNotificationsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript invokes Toastify(...).showToast(), new Notyf().success/error(...), or toastr.info/success/warning/error(...) to display floating toast notifications without native popover="manual".',
      'Hand-rolled toast notifications append to document.body or use position: fixed / viewport offsets combined with show/fadeIn and delay/fadeOut lifecycle.',
    ],
    dropWhen: [
      'The component already uses native <div popover="manual"> with showPopover() and hidePopover() or is guarded by a popover feature check.',
      'The toast relies on multi-toast queue stacking, progress bars, interactive click/destination callbacks (onClick, destination, newWindow, callback), or imperative queue clearing (toastr.clear / dismissAll) that native popover="manual" does not provide.',
      'The code renders blocking modal dialogs (<dialog>) or inline form validation error banners.',
    ],
  },
};

export const persistentToastNotificationsRules: readonly AnalyzerRule[] = [
  persistentToastNotificationsJsRule,
];
