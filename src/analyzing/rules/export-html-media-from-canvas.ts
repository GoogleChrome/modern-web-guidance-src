import {
  Node,
  type CallExpression,
  type NewExpression,
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
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH = '3c108b82f2d1';

const CANVAS_MEDIA_PACKAGES = [
  'ccapture.js',
  'gifshot',
  'whammy',
] as const;

const CANVAS_MEDIA_GUARD_TOKENS = [
  'captureStream',
  'MediaRecorder',
  'drawElementImage',
] as const;

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
        for (const el of param.getDescendantsOfKind(identNode.getKind())) {
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

function matchCanvasMediaRecorderNode(
  node: CallExpression | NewExpression,
): string | null {
  const callee = unwrapExpression(node.getExpression());

  if (isLibraryReference(callee, 'CCapture', ['ccapture.js'])) {
    return 'CCapture canvas frame recorder can be modernized with native canvas.captureStream() and MediaRecorder.';
  }

  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const propName = callee.getName();
  const receiver = callee.getExpression();

  if (
    Node.isCallExpression(node) &&
    propName === 'createGIF' &&
    isLibraryReference(receiver, 'gifshot', ['gifshot'])
  ) {
    return 'gifshot.createGIF() client-side media encoder can be modernized with native canvas.captureStream() and MediaRecorder.';
  }

  if (
    (propName === 'Video' || propName === 'fromImageArray') &&
    isLibraryReference(receiver, 'Whammy', ['whammy'])
  ) {
    return `Whammy.${propName}() canvas frame encoder can be modernized with native canvas.captureStream() and MediaRecorder.`;
  }

  return null;
}

export const exportHtmlMediaFromCanvasPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: CANVAS_MEDIA_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy client-side canvas recording package "${pkgName}" (${versionRange}) can be modernized with HTMLCanvasElement.captureStream() and MediaRecorder.`,
    };
  },
};

export const exportHtmlMediaFromCanvasJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['CCapture', 'gifshot', 'Whammy'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node) && !Node.isNewExpression(node)) {
        return;
      }

      const msg = matchCanvasMediaRecorderNode(node);
      if (msg && !isProtectedByFeatureGuard(node, CANVAS_MEDIA_GUARD_TOKENS)) {
        matches.push({
          line: node.getStartLineNumber(),
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const exportHtmlMediaFromCanvasPackageRule: AnalyzerRule = {
  id: 'export-html-media-from-canvas/package-canvas-recorder',
  guideId: 'export-html-media-from-canvas',
  guideHash: EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH,
  summary:
    'Legacy client-side canvas video/GIF encoder packages (ccapture.js, gifshot, whammy) should be modernized with HTMLCanvasElement.captureStream() and MediaRecorder.',
  matcher: exportHtmlMediaFromCanvasPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares ccapture.js, gifshot, or whammy in package.json dependencies to record or export video/frames from a canvas.',
    ],
    dropWhen: [
      'The code already uses HTMLCanvasElement.captureStream() and MediaRecorder.',
      'The code runs in a server-side FFmpeg rendering pipeline or uses toDataURL / toBlob for single static screenshot capture.',
    ],
  },
};

export const exportHtmlMediaFromCanvasJsRule: AnalyzerRule = {
  id: 'export-html-media-from-canvas/js-canvas-recorder',
  guideId: 'export-html-media-from-canvas',
  guideHash: EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH,
  summary:
    'JavaScript canvas recording calls (new CCapture, gifshot.createGIF, new Whammy.Video) should be modernized with canvas.captureStream() and MediaRecorder.',
  matcher: exportHtmlMediaFromCanvasJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript instantiates new CCapture(...), calls gifshot.createGIF(...), or invokes new Whammy.Video(...) to encode canvas frames in the browser.',
      'Manual frame-by-frame canvas extraction loops dump toDataURL frames into client-side encoders.',
    ],
    dropWhen: [
      'The recording call is guarded by a captureStream or MediaRecorder feature check.',
      'The code uses canvas.toDataURL() or canvas.toBlob() for a single static screenshot or runs in a server-side FFmpeg pipeline.',
    ],
  },
};

export const exportHtmlMediaFromCanvasRules: readonly AnalyzerRule[] = [
  exportHtmlMediaFromCanvasPackageRule,
  exportHtmlMediaFromCanvasJsRule,
];
