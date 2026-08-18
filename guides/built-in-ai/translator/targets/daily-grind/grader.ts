import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';

import { pathToFileURL } from 'url';

const targetFiles: string[] = getTargetFiles(
  typeof __filename !== 'undefined'
    ? pathToFileURL(__filename).href
    : pathToFileURL(process.cwd() + '/grader.ts').href
);

test.describe('Translator Target Grader', () => {
  // Requirement 1: The Translator API should be available in the browser on window.Translator, but not on window.ai.translator.
  test('Translator API is available on global Translator and not on deprecated window.ai.translator', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasGlobalTranslator = sourceFiles.some((sf) => {
      const hasIdentifier = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => id.getText() === 'Translator');
      const hasStringLiteral = sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .some((sl) => sl.getLiteralValue() === 'Translator');
      return hasIdentifier || hasStringLiteral;
    });

    const usesDeprecatedAiTranslator = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      return /\bai\.translator\b/i.test(text) || /\bwindow\.ai\b/i.test(text);
    });

    expect(hasGlobalTranslator && !usesDeprecatedAiTranslator).toBe(true);
  });

  // Requirement 2: The Translator.availability() function must be called with both sourceLanguage and targetLanguage options.
  test('Translator.availability() is called with both sourceLanguage and targetLanguage options', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAvailabilityCall = sourceFiles.some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const expr = call.getExpression().getText();
        return expr.endsWith('availability') || expr === 'availability';
      });
    });

    const hasLanguageOptions = sourceFiles.some((sf) => {
      const identifiers = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .map((id) => id.getText());
      const propAssignments = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .map((p) => p.getName());
      const shorthands = sf
        .getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
        .map((p) => p.getName());
      const allKeys = new Set([...identifiers, ...propAssignments, ...shorthands]);
      return allKeys.has('sourceLanguage') && allKeys.has('targetLanguage');
    });

    expect(hasAvailabilityCall && hasLanguageOptions).toBe(true);
  });

  // Requirement 3: The Translator.availability() function should return available or downloadable or downloading or unavailable.
  test('Translator.availability() return values (available, downloadable, downloading, unavailable) are handled', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const stringsInCode = new Set(
      sourceFiles.flatMap((sf) =>
        sf
          .getDescendantsOfKind(SyntaxKind.StringLiteral)
          .map((sl) => sl.getLiteralValue())
      )
    );

    const handlesExpectedStates =
      stringsInCode.has('available') &&
      stringsInCode.has('downloadable') &&
      stringsInCode.has('downloading') &&
      stringsInCode.has('unavailable');

    expect(handlesExpectedStates).toBe(true);
  });

  // Requirement 4: The same sourceLanguage and targetLanguage options should be passed to both Translator.availability() and Translator.create().
  test('Same sourceLanguage and targetLanguage options are passed to Translator.availability() and Translator.create()', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAvailabilityCall = sourceFiles.some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const expr = call.getExpression().getText();
        return expr.endsWith('availability') || expr === 'availability';
      });
    });

    const hasCreateCall = sourceFiles.some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const expr = call.getExpression().getText();
        return expr.endsWith('create') || expr === 'create';
      });
    });

    const hasLanguageOptions = sourceFiles.some((sf) => {
      const identifiers = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .map((id) => id.getText());
      const propAssignments = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .map((p) => p.getName());
      const shorthands = sf
        .getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
        .map((p) => p.getName());
      const allKeys = new Set([...identifiers, ...propAssignments, ...shorthands]);
      return allKeys.has('sourceLanguage') && allKeys.has('targetLanguage');
    });

    expect(hasAvailabilityCall && hasCreateCall && hasLanguageOptions).toBe(true);
  });

  // Requirement 5: The Translator instance\'s translate() or translateStreaming() method should be used to generate a translation.
  test('Translator instance translate() or translateStreaming() method is used to generate translations', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasTranslateCall = sourceFiles.some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some((call) => {
        const expr = call.getExpression().getText();
        return (
          expr.endsWith('.translate') ||
          expr.endsWith('.translateStreaming') ||
          expr === 'translate' ||
          expr === 'translateStreaming'
        );
      });
    });

    expect(hasTranslateCall).toBe(true);
  });

  // Requirement 6: A monitor for download progress should be implemented using the downloadprogress event.
  test('Download progress monitor is implemented using the downloadprogress event', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const stringsInCode = new Set(
      sourceFiles.flatMap((sf) =>
        sf
          .getDescendantsOfKind(SyntaxKind.StringLiteral)
          .map((sl) => sl.getLiteralValue())
      )
    );

    const hasDownloadProgressEvent = stringsInCode.has('downloadprogress');

    const hasMonitorDefinition = sourceFiles.some((sf) => {
      const identifiers = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .map((id) => id.getText());
      const methods = sf
        .getDescendantsOfKind(SyntaxKind.MethodDeclaration)
        .map((m) => m.getName());
      const props = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .map((p) => p.getName());
      const shorthands = sf
        .getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
        .map((p) => p.getName());
      const allNames = new Set([
        ...identifiers,
        ...methods,
        ...props,
        ...shorthands,
      ]);
      return allNames.has('monitor');
    });

    expect(hasDownloadProgressEvent && hasMonitorDefinition).toBe(true);
  });
});
