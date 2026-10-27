import assert from 'node:assert/strict';
import test from 'node:test';
import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { AnalyzerRule } from '../schema.ts';
import {
  createInMemoryProject,
  createJsCallMatcher,
  matchJsRule,
  scanFiles,
  scanJsSource,
  withVirtualSourceFile,
} from './index.ts';

function createCallExpressionRule(id: string, guideId: string, targetCallee: string): AnalyzerRule {
  return {
    id,
    guideId,
    guideHash: '0123456789ab',
    summary: `Detects calls to ${targetCallee}`,
    verifierRubric: {
      keepWhen: [`Calls ${targetCallee}`],
      dropWhen: ['Already migrated'],
    },
    matcher: {
      kind: 'js',
      matchFile(sourceFile: SourceFile) {
        const fullText = sourceFile.getFullText();
        const trimmedText = sourceFile.getText();
        if (!fullText || !trimmedText) {
          return [];
        }
        const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
        return calls
          .filter((call) => call.getExpression().getText() === targetCallee)
          .map((call) => ({
            line: call.getStartLineNumber(),
            message: `Found ${targetCallee} call`,
          }));
      },
    },
  };
}

test('scanFiles memoizes sourceFile.getDescendantsOfKind, getFullText, and getText across multiple JS rules', async (t) => {
  const rules: readonly AnalyzerRule[] = [
    createCallExpressionRule('rule-alpha', 'guide-alpha', 'legacyAlpha'),
    createCallExpressionRule('rule-beta', 'guide-beta', 'legacyBeta'),
    createCallExpressionRule('rule-gamma', 'guide-gamma', 'legacyGamma'),
  ];

  await t.test('executes underlying getDescendantsOfKind only once per SyntaxKind per JS file and returns identical findings', () => {
    const project = createInMemoryProject();
    const origCreateSourceFile = project.createSourceFile.bind(project);
    const descendantsCallCounts = new Map<SyntaxKind, number>();
    let getFullTextCallCount = 0;
    let getTextCallCount = 0;

    project.createSourceFile = ((...args: Parameters<typeof origCreateSourceFile>) => {
      const sf = origCreateSourceFile(...args);

      const rawGetDescendantsOfKind = sf.getDescendantsOfKind.bind(sf);
      sf.getDescendantsOfKind = (<TKind extends SyntaxKind>(kind: TKind) => {
        descendantsCallCounts.set(kind, (descendantsCallCounts.get(kind) ?? 0) + 1);
        return rawGetDescendantsOfKind(kind);
      }) as SourceFile['getDescendantsOfKind'];

      const rawGetFullText = sf.getFullText.bind(sf);
      sf.getFullText = (): string => {
        getFullTextCallCount++;
        return rawGetFullText();
      };

      const rawGetText = sf.getText.bind(sf);
      sf.getText = ((includeJsDocComments?: boolean): string => {
        getTextCallCount++;
        return rawGetText(includeJsDocComments);
      }) as SourceFile['getText'];

      return sf;
    }) as typeof project.createSourceFile;

    const files = new Map<string, string>([
      [
        'src/app.ts',
        [
          'export function runApp() {',
          '  legacyAlpha(1);',
          '  legacyBeta(2);',
          '  legacyGamma(3);',
          '}',
        ].join('\n'),
      ],
    ]);

    const combinedFindings = scanFiles(files, rules, {
      repo: 'test-repo',
      commit: 'abc1234',
      project,
    });

    assert.equal(
      descendantsCallCounts.get(SyntaxKind.CallExpression),
      1,
      'underlying getDescendantsOfKind(SyntaxKind.CallExpression) must only execute once across 3 JS rules',
    );
    assert.equal(
      getFullTextCallCount,
      1,
      'underlying getFullText() must only execute once across 3 JS rules',
    );
    assert.equal(
      getTextCallCount,
      1,
      'underlying getText() must only execute once across 3 JS rules',
    );

    const individualFindings = rules.flatMap((rule) =>
      scanFiles(files, [rule], {
        repo: 'test-repo',
        commit: 'abc1234',
      }),
    );

    assert.deepEqual(combinedFindings, individualFindings);
    assert.deepEqual(
      combinedFindings.map((f) => ({ ruleId: f.ruleId, line: f.line })),
      [
        { ruleId: 'rule-alpha', line: 2 },
        { ruleId: 'rule-beta', line: 3 },
        { ruleId: 'rule-gamma', line: 4 },
      ],
    );
  });

  await t.test('executes underlying getDescendantsOfKind only once per SyntaxKind in SFC/HTML script blocks', () => {
    const project = createInMemoryProject();
    const origCreateSourceFile = project.createSourceFile.bind(project);
    const descendantsCallCounts = new Map<SyntaxKind, number>();

    project.createSourceFile = ((...args: Parameters<typeof origCreateSourceFile>) => {
      const sf = origCreateSourceFile(...args);
      const rawGetDescendantsOfKind = sf.getDescendantsOfKind.bind(sf);
      sf.getDescendantsOfKind = (<TKind extends SyntaxKind>(kind: TKind) => {
        descendantsCallCounts.set(kind, (descendantsCallCounts.get(kind) ?? 0) + 1);
        return rawGetDescendantsOfKind(kind);
      }) as SourceFile['getDescendantsOfKind'];
      return sf;
    }) as typeof project.createSourceFile;

    const files = new Map<string, string>([
      [
        'src/index.html',
        [
          '<!doctype html>',
          '<script>',
          '  legacyAlpha();',
          '  legacyBeta();',
          '</script>',
        ].join('\n'),
      ],
    ]);

    const findings = scanFiles(files, rules, {
      repo: 'test-repo',
      commit: 'abc1234',
      project,
    });

    assert.equal(descendantsCallCounts.get(SyntaxKind.CallExpression), 1);
    assert.deepEqual(
      findings.map((f) => ({ ruleId: f.ruleId, line: f.line })),
      [
        { ruleId: 'rule-alpha', line: 3 },
        { ruleId: 'rule-beta', line: 4 },
      ],
    );
  });
});

test('createJsCallMatcher, matchJsRule, and withVirtualSourceFile', async (t) => {
  await t.test('reuses a single virtual Project and removes virtual files after each call', () => {
    const matcher = createJsCallMatcher({
      fastTokens: ['legacyCall', 'LegacyWidget'],
      featureGuardTokens: ['modernApi'],
      dedupeLines: true,
      matchCall: (node) =>
        node.getExpression().getText() === 'legacyCall' ? 'legacy call' : null,
      matchNew: (node) =>
        node.getExpression().getText() === 'LegacyWidget' ? 'legacy widget' : null,
    });

    const first = matchJsRule(
      matcher,
      'sample.ts',
      [
        'legacyCall(); legacyCall();',
        'new LegacyWidget();',
        'if (!window.modernApi) { legacyCall(); }',
      ].join('\n'),
    );
    assert.deepEqual(first, [
      { line: 1, message: 'legacy call' },
      { line: 2, message: 'legacy widget' },
    ]);

    const second = matchJsRule(matcher, 'sample.ts', 'const clean = 1;');
    assert.deepEqual(second, []);

    const fileCountAfter = withVirtualSourceFile('check.ts', 'export const x = 1;', (sf) =>
      sf.getProject().getSourceFiles().length,
    );
    assert.equal(fileCountAfter, 1, 'only the active virtual SourceFile exists during callback');
  });

  await t.test('scanJsSource omits sourceFile when project is omitted and returns active sourceFile when project is passed', () => {
    const matcher = createJsCallMatcher({
      fastTokens: ['legacyCall'],
      matchCall: (node) =>
        node.getExpression().getText() === 'legacyCall' ? 'legacy call' : null,
    });

    const withoutProject = scanJsSource('sample.ts', 'legacyCall();', [matcher]);
    assert.equal(withoutProject.matches.length, 1);
    assert.equal('sourceFile' in withoutProject, false);

    const callerProject = createInMemoryProject();
    const withProject = scanJsSource('sample.ts', 'legacyCall();', [matcher], callerProject);
    assert.equal(withProject.matches.length, 1);
    assert.equal(withProject.sourceFile?.wasForgotten(), false);
  });
});
