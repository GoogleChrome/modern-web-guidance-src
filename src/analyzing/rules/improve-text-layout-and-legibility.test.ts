import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH,
  improveTextLayoutAndLegibilityJsMatcher,
  improveTextLayoutAndLegibilityJsRule,
  improveTextLayoutAndLegibilityPackageMatcher,
  improveTextLayoutAndLegibilityPackageRule,
  improveTextLayoutAndLegibilityRules,
} from './improve-text-layout-and-legibility.ts';

void test('improve-text-layout-and-legibility: rule metadata', () => {
  assert.equal(
    improveTextLayoutAndLegibilityPackageRule.id,
    'improve-text-layout-and-legibility/package-text-balance',
  );
  assert.equal(
    improveTextLayoutAndLegibilityPackageRule.guideId,
    'improve-text-layout-and-legibility',
  );
  assert.equal(
    improveTextLayoutAndLegibilityPackageRule.guideHash,
    IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH,
  );
  assert.equal(IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH.length, 12);

  assert.equal(
    improveTextLayoutAndLegibilityJsRule.id,
    'improve-text-layout-and-legibility/js-text-balance',
  );
  assert.equal(
    improveTextLayoutAndLegibilityJsRule.guideId,
    'improve-text-layout-and-legibility',
  );
  assert.equal(
    improveTextLayoutAndLegibilityJsRule.guideHash,
    IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH,
  );

  assert.equal(improveTextLayoutAndLegibilityRules.length, 2);
  assert.ok(
    improveTextLayoutAndLegibilityPackageRule.verifierRubric.keepWhen.length >= 1,
  );
  assert.ok(
    improveTextLayoutAndLegibilityPackageRule.verifierRubric.dropWhen.length >= 2,
  );
  assert.ok(
    improveTextLayoutAndLegibilityJsRule.verifierRubric.keepWhen.length >= 1,
  );
  assert.ok(
    improveTextLayoutAndLegibilityJsRule.verifierRubric.dropWhen.length >= 2,
  );
});

void test('improve-text-layout-and-legibility dependency matcher', async (t) => {
  await t.test('flags react-wrap-balancer and balance-text', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'react-wrap-balancer': '^1.1.0',
          'balance-text': '^3.3.1',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      improveTextLayoutAndLegibilityPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          react: '^18.2.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      improveTextLayoutAndLegibilityPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('improve-text-layout-and-legibility JS matcher', async (t) => {
  await t.test('flags balanceText(), jQuery .balanceText(), and <Balancer>', () => {
    const project = createInMemoryProject();
    const code = `
      import balanceText from 'balance-text';
      import Balancer from 'react-wrap-balancer';

      balanceText('.headline', { watch: true });
      $('.hero-title').balanceText();
      export const Hero = () => <h1><Balancer>Balanced Heading</Balancer></h1>;
    `;
    const sourceFile = project.createSourceFile('balance.tsx', code);
    const matches = improveTextLayoutAndLegibilityJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'balance.tsx',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports("text-wrap", "balance") or local Balancer component', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('text-wrap', 'balance')) {
        balanceText('.headline');
      }
      function Balancer({ children }) { return <div>{children}</div>; }
      export const Local = () => <Balancer>Not react-wrap-balancer</Balancer>;
    `;
    const sourceFile = project.createSourceFile('guarded.tsx', code);
    const matches = improveTextLayoutAndLegibilityJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'guarded.tsx',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 0);
  });
});
