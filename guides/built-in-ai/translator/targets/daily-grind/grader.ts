import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type StringLiteral, type NoSubstitutionTemplateLiteral } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Translator Target Grader', () => {
  // Requirement 1: The Translator API should be available in the browser on window.Translator, but not on window.ai.translator.
  test('Translator API is accessed via global Translator and not deprecated window.ai.translator', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasTranslatorApi = sourceFiles.some((sf) => {
      const hasIdentifier = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => id.getText() === 'Translator');
      const hasStringLiteral = sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .some((str) => str.getLiteralValue() === 'Translator');
      const hasTemplateLiteral = sf
        .getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
        .some((tl) => tl.getLiteralText() === 'Translator');
      return hasIdentifier || hasStringLiteral || hasTemplateLiteral;
    });

    const hasDeprecatedAiTranslator = sourceFiles.some((sf) => {
      const propAccesses = sf.getDescendantsOfKind(
        SyntaxKind.PropertyAccessExpression
      );
      return propAccesses.some((pa) => {
        const text = pa.getText();
        return (
          text === 'window.ai.translator' ||
          text === 'self.ai.translator' ||
          text === 'ai.translator'
        );
      });
    });

    expect(hasTranslatorApi && !hasDeprecatedAiTranslator).toBe(true);
  });

  // Requirement 2: The Translator.availability() function must be called with both sourceLanguage and targetLanguage options.
  test('Translator.availability() is called with sourceLanguage and targetLanguage options', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasAvailabilityCall = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      return (
        (exprText === 'availability' || exprText.endsWith('.availability')) &&
        call.getArguments().length > 0
      );
    });

    const hasSourceAndTargetLanguage = sourceFiles.some((sf) => {
      const propertyAssignments = [
        ...sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment),
        ...sf.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment),
      ];
      const propNames = propertyAssignments.map((pa) => pa.getName());
      return (
        propNames.includes('sourceLanguage') &&
        propNames.includes('targetLanguage')
      );
    });

    expect(hasAvailabilityCall && hasSourceAndTargetLanguage).toBe(true);
  });

  // Requirement 3: The Translator.availability() function should return available or downloadable or downloading or unavailable.
  test('Translator.availability() return statuses are handled (available, downloadable, downloading, unavailable)', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAvailabilityCall = sourceFiles.some((sf) => {
      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExpressions.some((call) => {
        const exprText = call.getExpression().getText();
        return exprText === 'availability' || exprText.endsWith('.availability');
      });
    });

    const validStatuses = ['available', 'downloadable', 'downloading', 'unavailable'];
    const handlesStatus = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      return validStatuses.some((status) => new RegExp(`\\b${status}\\b`).test(text));
    });

    expect(hasAvailabilityCall && handlesStatus).toBe(true);
  });

  // Requirement 4: The same sourceLanguage and targetLanguage options should be passed to both Translator.availability() and Translator.create().
  test('Same sourceLanguage and targetLanguage options are passed to Translator.create() and Translator.availability()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasAvailabilityCall = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      return (
        (exprText === 'availability' || exprText.endsWith('.availability')) &&
        call.getArguments().length > 0
      );
    });
    const hasCreateCall = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      return (
        (exprText === 'create' || exprText.endsWith('.create')) &&
        call.getArguments().length > 0
      );
    });

    const hasLanguageOptions = sourceFiles.some((sf) => {
      const propertyAssignments = [
        ...sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment),
        ...sf.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment),
      ];
      const propNames = propertyAssignments.map((pa) => pa.getName());
      return (
        propNames.includes('sourceLanguage') &&
        propNames.includes('targetLanguage')
      );
    });

    expect(hasAvailabilityCall && hasCreateCall && hasLanguageOptions).toBe(
      true
    );
  });

  // Requirement 5: The Translator instance translate() or translateStreaming() method should be used to generate a translation.
  test('Translator instance translate() or translateStreaming() method is used to generate a translation', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasTranslateMethodCall = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      return (
        exprText === 'translate' ||
        exprText.endsWith('.translate') ||
        exprText === 'translateStreaming' ||
        exprText.endsWith('.translateStreaming')
      );
    });

    expect(hasTranslateMethodCall).toBe(true);
  });

  // Requirement 6: A monitor for download progress should be implemented using the downloadprogress event.
  test('Monitor for download progress is implemented using the downloadprogress event', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasDownloadProgressMonitor = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      if (
        exprText === 'addEventListener' ||
        exprText.endsWith('.addEventListener')
      ) {
        const args = call.getArguments();
        if (args.length > 0) {
          const firstArg = args[0];
          if (firstArg.getKind() === SyntaxKind.StringLiteral) {
            return (
              (firstArg as StringLiteral).getLiteralValue() ===
              'downloadprogress'
            );
          }
          if (
            firstArg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral
          ) {
            return (
              (firstArg as NoSubstitutionTemplateLiteral).getLiteralText() ===
              'downloadprogress'
            );
          }
        }
      }
      return false;
    });

    expect(hasDownloadProgressMonitor).toBe(true);
  });
});
