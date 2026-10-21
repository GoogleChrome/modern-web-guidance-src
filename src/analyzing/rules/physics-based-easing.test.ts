import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  PHYSICS_BASED_EASING_GUIDE_HASH,
  physicsBasedEasingJsMatcher,
  physicsBasedEasingJsRule,
  physicsBasedEasingPackageMatcher,
  physicsBasedEasingPackageRule,
  physicsBasedEasingRules,
} from './physics-based-easing.ts';

void test('physics-based-easing: rule metadata', () => {
  assert.equal(
    physicsBasedEasingPackageRule.id,
    'physics-based-easing/package-spring',
  );
  assert.equal(physicsBasedEasingPackageRule.guideId, 'physics-based-easing');
  assert.equal(
    physicsBasedEasingPackageRule.guideHash,
    PHYSICS_BASED_EASING_GUIDE_HASH,
  );
  assert.equal(PHYSICS_BASED_EASING_GUIDE_HASH.length, 12);

  assert.equal(physicsBasedEasingJsRule.id, 'physics-based-easing/js-spring');
  assert.equal(physicsBasedEasingJsRule.guideId, 'physics-based-easing');
  assert.equal(
    physicsBasedEasingJsRule.guideHash,
    PHYSICS_BASED_EASING_GUIDE_HASH,
  );

  assert.equal(physicsBasedEasingRules.length, 2);
  assert.ok(physicsBasedEasingPackageRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(physicsBasedEasingPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(physicsBasedEasingJsRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(physicsBasedEasingJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('physics-based-easing dependency matcher', async (t) => {
  await t.test('flags popmotion, re-spring, and react-motion', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          popmotion: '^11.0.5',
          're-spring': '^9.0.0',
          'react-motion': '^0.5.2',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      physicsBasedEasingPackageMatcher,
    ]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'date-fns': '^2.30.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      physicsBasedEasingPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('physics-based-easing JS matcher', async (t) => {
  await t.test('flags popmotion and react-motion spring({ stiffness, damping }) calls', () => {
    const project = createInMemoryProject();
    const code = `
      import { spring } from 'popmotion';
      import { spring as motionSpring } from 'react-motion';

      const anim = spring({ from: 0, to: 100, stiffness: 200, damping: 15 });
      const style = { x: motionSpring(10, { stiffness: 120, damping: 17 }) };
      window.popmotion.spring({ stiffness: 300, damping: 20 });
    `;
    const sourceFile = project.createSourceFile('spring.js', code);
    const matches = physicsBasedEasingJsMatcher.matchFile(sourceFile, {
      filePath: 'spring.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports linear() check', () => {
    const project = createInMemoryProject();
    const code = `
      import { spring } from 'popmotion';
      const supportsLinearEasing = window.CSS && CSS.supports('animation-timing-function', 'linear(0, 1)');
      if (!supportsLinearEasing) {
        spring({ stiffness: 100, damping: 10 });
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = physicsBasedEasingJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated functions named spring without physics config', () => {
    const project = createInMemoryProject();
    const code = `
      spring('season');
      calendar.spring({ month: 'April' });
    `;
    const sourceFile = project.createSourceFile('season.js', code);
    const matches = physicsBasedEasingJsMatcher.matchFile(sourceFile, {
      filePath: 'season.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
