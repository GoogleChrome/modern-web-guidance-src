import assert from 'node:assert/strict';
import test from 'node:test';
import { SyntaxKind, type SourceFile } from 'ts-morph';
import type { AnalyzerRule } from '../schema.ts';
import { createInMemoryProject, scanFiles } from './index.ts';

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

test('scanFiles memoizes sourceFile.getDescendantsOfKind, getFullText, and getText across multiple JS rules (O2)', async (t) => {
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
