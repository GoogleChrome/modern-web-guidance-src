import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type Project, type Node, type SourceFile } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function nodeHasLanguageOptions(node: Node | undefined, sf: SourceFile): boolean {
  if (!node) return false;

  if (node.getKind() === SyntaxKind.ObjectLiteralExpression) {
    const text = node.getText();
    if (text.includes('sourceLanguage') && text.includes('targetLanguage')) {
      return true;
    }
  }

  if (node.getKind() === SyntaxKind.Identifier) {
    const varName = node.getText();
    const varDecls = sf
      .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .filter((v) => v.getName() === varName);
    for (const v of varDecls) {
      const fullVarText = v.getText();
      if (
        fullVarText.includes('sourceLanguage') &&
        fullVarText.includes('targetLanguage')
      ) {
        return true;
      }
      const typeText = v.getTypeNode()?.getText() || '';
      if (
        typeText.includes('TranslatorLanguageOptions') ||
        typeText.includes('TranslatorCreateOptions') ||
        (typeText.includes('sourceLanguage') &&
          typeText.includes('targetLanguage'))
      ) {
        return true;
      }
    }
  }

  const nodeText = node.getText();
  return (
    nodeText.includes('sourceLanguage') && nodeText.includes('targetLanguage')
  );
}

function checkTranslatorApiScope(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  const hasTranslatorRef = sourceFiles.some((sf) => {
    const hasId = sf
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .some((id) => id.getText() === 'Translator');
    const hasStr = sf
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .some((s) => s.getLiteralValue() === 'Translator');
    return hasId || hasStr;
  });

  const hasDeprecatedAi = sourceFiles.some((sf) => {
    const text = sf.getFullText();
    return (
      /\bai\.translator\b/i.test(text) ||
      /\bwindow\.ai\b/i.test(text) ||
      /\bself\.ai\b/i.test(text)
    );
  });

  return hasTranslatorRef && !hasDeprecatedAi;
}

function checkAvailabilityCall(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  const availabilityCalls = sourceFiles.flatMap((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
      const exprText = call.getExpression().getText();
      return exprText === 'availability' || exprText.endsWith('.availability');
    })
  );

  if (availabilityCalls.length === 0) return false;

  return availabilityCalls.some((call) => {
    const args = call.getArguments();
    if (args.length === 0) return false;
    const sf = call.getSourceFile();
    return nodeHasLanguageOptions(args[0], sf);
  });
}

function checkAvailabilityReturnStatuses(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  const expectedStatuses = ['available', 'downloadable', 'unavailable'];
  const allStringLiterals = new Set(
    sourceFiles.flatMap((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .map((s) => s.getLiteralValue())
    )
  );

  return expectedStatuses.every((status) => allStringLiterals.has(status));
}

function checkAvailabilityAndCreateOptions(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  const hasAvailability = checkAvailabilityCall(project);
  if (!hasAvailability) return false;

  const createCalls = sourceFiles.flatMap((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
      const exprText = call.getExpression().getText();
      return (
        exprText === 'create' ||
        exprText.endsWith('.create') ||
        exprText === 'createTranslator' ||
        exprText.endsWith('.createTranslator')
      );
    })
  );

  if (createCalls.length === 0) return false;

  return createCalls.some((call) => {
    const args = call.getArguments();
    if (args.length === 0) return false;
    const sf = call.getSourceFile();
    const firstArg = args[0];

    if (nodeHasLanguageOptions(firstArg, sf)) return true;

    if (firstArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const obj = firstArg.asKind(SyntaxKind.ObjectLiteralExpression);
      if (obj) {
        const spreads = obj
          .getProperties()
          .filter((p) => p.getKind() === SyntaxKind.SpreadAssignment);
        for (const spread of spreads) {
          const spreadExpr = (spread as any).getExpression?.();
          if (spreadExpr && nodeHasLanguageOptions(spreadExpr, sf)) {
            return true;
          }
        }
        const text = obj.getText();
        if (
          text.includes('sourceLanguage') &&
          text.includes('targetLanguage')
        ) {
          return true;
        }
      }
    }

    return false;
  });
}

function checkTranslationMethod(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  const translateCalls = sourceFiles.flatMap((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
      const exprText = call.getExpression().getText();
      return (
        exprText.endsWith('.translate') ||
        exprText.endsWith('.translateStreaming') ||
        exprText === 'translate' ||
        exprText === 'translateStreaming'
      );
    })
  );

  return translateCalls.length > 0;
}

function checkDownloadProgressMonitor(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  const hasDownloadProgressString = sourceFiles.some((sf) =>
    sf
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .some((s) => s.getLiteralValue() === 'downloadprogress')
  );

  const addEventListenerCalls = sourceFiles.flatMap((sf) =>
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
      const exprText = call.getExpression().getText();
      return exprText.endsWith('addEventListener');
    })
  );

  const hasDownloadProgressEventListener = addEventListenerCalls.some(
    (call) => {
      const args = call.getArguments();
      return (
        args.length > 0 &&
        args[0].getText().replace(/['"`]/g, '') === 'downloadprogress'
      );
    }
  );

  return hasDownloadProgressString && hasDownloadProgressEventListener;
}

test.describe('Translator Target Grader', () => {
  test('Translator API is available on window.Translator and not window.ai.translator', () => {
    const project = getJsProject(targetFiles);
    expect(checkTranslatorApiScope(project)).toBe(true);
  });

  test('Translator.availability() is called with both sourceLanguage and targetLanguage options', () => {
    const project = getJsProject(targetFiles);
    expect(checkAvailabilityCall(project)).toBe(true);
  });

  test('Translator.availability() return values (available, downloadable, unavailable) are handled', () => {
    const project = getJsProject(targetFiles);
    expect(checkAvailabilityReturnStatuses(project)).toBe(true);
  });

  test('sourceLanguage and targetLanguage options are passed to both Translator.availability() and Translator.create()', () => {
    const project = getJsProject(targetFiles);
    expect(checkAvailabilityAndCreateOptions(project)).toBe(true);
  });

  test('Translator instance translate() or translateStreaming() is used to generate translation', () => {
    const project = getJsProject(targetFiles);
    expect(checkTranslationMethod(project)).toBe(true);
  });

  test('Download progress monitor is implemented using the downloadprogress event', () => {
    const project = getJsProject(targetFiles);
    expect(checkDownloadProgressMonitor(project)).toBe(true);
  });
});
