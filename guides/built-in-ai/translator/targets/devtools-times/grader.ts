import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type Project, type SourceFile } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAppSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter(sf => !sf.getFilePath().endsWith('global.d.ts'));
}

test.describe('devtools-times Translator Target Grader', () => {

  test('The Translator API should be available on window.Translator and not on window.ai.translator', () => {
    const project: Project = getJsProject(targetFiles);
    const allSourceFiles = project.getSourceFiles();

    if (allSourceFiles.length === 0) {
      expect(false).toBe(true);
      return;
    }

    // 1. Verify that deprecated window.ai.translator / ai.translator is NOT accessed
    const hasLegacyAiTranslator = allSourceFiles.some(sf => {
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      return propAccesses.some(pa => {
        const text = pa.getText();
        return text === 'window.ai.translator' || text === 'ai.translator';
      });
    });

    // 2. Verify that Translator is accessed via global Translator or 'Translator' in window
    const hasTranslatorAccess = allSourceFiles.some(sf => {
      const hasId = sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText() === 'Translator');
      const hasStr = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(str => str.getLiteralValue() === 'Translator');
      return hasId || hasStr;
    });

    expect(hasTranslatorAccess && !hasLegacyAiTranslator).toBe(true);
  });

  test('The Translator.availability() function must be called with both sourceLanguage and targetLanguage options', () => {
    const project: Project = getJsProject(targetFiles);
    const appSourceFiles = getAppSourceFiles(project);

    if (appSourceFiles.length === 0) {
      expect(false).toBe(true);
      return;
    }

    const hasAvailabilityCall = appSourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
        const exprText = call.getExpression().getText();
        return exprText.endsWith('.availability') || exprText === 'availability' || exprText === 'checkAvailability';
      });
      if (calls.length === 0) return false;

      const fileText = sf.getFullText();
      return /\bsourceLanguage\b/.test(fileText) && /\btargetLanguage\b/.test(fileText);
    });

    expect(hasAvailabilityCall).toBe(true);
  });

  test('The Translator.availability() function should return available or downloadable or downloading or unavailable', () => {
    const project: Project = getJsProject(targetFiles);
    const allSourceFiles = project.getSourceFiles();

    if (allSourceFiles.length === 0) {
      expect(false).toBe(true);
      return;
    }

    const allText = allSourceFiles.map(sf => sf.getFullText()).join('\n');
    const validStatuses = ['available', 'downloadable', 'downloading', 'unavailable'];
    const handlesStatus = validStatuses.some(status => new RegExp(`\\b${status}\\b`).test(allText));

    expect(handlesStatus).toBe(true);
  });

  test('The same sourceLanguage and targetLanguage options should be passed to both Translator.availability() and Translator.create()', () => {
    const project: Project = getJsProject(targetFiles);
    const appSourceFiles = getAppSourceFiles(project);

    if (appSourceFiles.length === 0) {
      expect(false).toBe(true);
      return;
    }

    const allCalls = appSourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasAvailabilityCall = allCalls.some(call => {
      const expr = call.getExpression().getText();
      return expr.endsWith('.availability') || expr === 'availability' || expr === 'checkAvailability';
    });

    const hasCreateCall = allCalls.some(call => {
      const expr = call.getExpression().getText();
      return expr.endsWith('.create') || expr === 'create' || expr === 'createTranslator';
    });

    const hasLanguageOptions = appSourceFiles.some(sf => {
      const text = sf.getFullText();
      return /\bsourceLanguage\b/.test(text) && /\btargetLanguage\b/.test(text);
    });

    expect(hasAvailabilityCall && hasCreateCall && hasLanguageOptions).toBe(true);
  });

  test("The Translator instance's translate() or translateStreaming() method should be used to generate a translation", () => {
    const project: Project = getJsProject(targetFiles);
    const appSourceFiles = getAppSourceFiles(project);

    if (appSourceFiles.length === 0) {
      expect(false).toBe(true);
      return;
    }

    const calls = appSourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasTranslateCall = calls.some(call => {
      const exprText = call.getExpression().getText();
      return exprText.endsWith('.translate') || exprText.endsWith('.translateStreaming');
    });

    expect(hasTranslateCall).toBe(true);
  });

  test('A monitor for download progress should be implemented using the downloadprogress event', () => {
    const project: Project = getJsProject(targetFiles);
    const appSourceFiles = getAppSourceFiles(project);

    if (appSourceFiles.length === 0) {
      expect(false).toBe(true);
      return;
    }

    const hasDownloadProgressMonitor = appSourceFiles.some(sf => {
      const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const hasEventLiteral = stringLiterals.some(sl => sl.getLiteralText() === 'downloadprogress');
      const text = sf.getFullText();
      const hasMonitor = /\bmonitor\b/.test(text) || /\baddEventListener\b/.test(text);

      return hasEventLiteral && hasMonitor;
    });

    expect(hasDownloadProgressMonitor).toBe(true);
  });
});
