import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  DIGITAL_SIGNATURES_GUIDE_HASH,
  digitalSignaturesJsMatcher,
  digitalSignaturesJsRule,
  digitalSignaturesPackageMatcher,
  digitalSignaturesPackageRule,
  digitalSignaturesRules,
} from './digital-signatures.ts';

void test('digital-signatures: rule metadata', () => {
  assert.equal(
    digitalSignaturesPackageRule.id,
    'digital-signatures/package-signature',
  );
  assert.equal(digitalSignaturesPackageRule.guideId, 'digital-signatures');
  assert.equal(
    digitalSignaturesPackageRule.guideHash,
    DIGITAL_SIGNATURES_GUIDE_HASH,
  );
  assert.equal(DIGITAL_SIGNATURES_GUIDE_HASH.length, 12);

  assert.equal(digitalSignaturesJsRule.id, 'digital-signatures/js-signature');
  assert.equal(digitalSignaturesJsRule.guideId, 'digital-signatures');
  assert.equal(
    digitalSignaturesJsRule.guideHash,
    DIGITAL_SIGNATURES_GUIDE_HASH,
  );

  assert.equal(digitalSignaturesRules.length, 2);
  assert.ok(digitalSignaturesPackageRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(digitalSignaturesPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(digitalSignaturesJsRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(digitalSignaturesJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('digital-signatures dependency matcher', async (t) => {
  await t.test('flags jsrsasign, tweetnacl, and elliptic', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          jsrsasign: '^11.1.0',
          tweetnacl: '^1.0.3',
          elliptic: '^6.5.5',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      digitalSignaturesPackageMatcher,
    ]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          express: '^4.18.2',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      digitalSignaturesPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('digital-signatures JS matcher', async (t) => {
  await t.test('flags KJUR.crypto.Signature, nacl.sign, nacl.sign.detached.verify, and elliptic', () => {
    const project = createInMemoryProject();
    const code = `
      import nacl from 'tweetnacl';
      import { ec as EC } from 'elliptic';

      const sig = new KJUR.crypto.Signature({ alg: 'SHA256withECDSA' });
      const signed = nacl.sign(msgBytes, secretKey);
      const isOk = nacl.sign.detached.verify(msgBytes, sigBytes, publicKey);
      const curve = new EC('p256');
    `;
    const sourceFile = project.createSourceFile('signatures.js', code);
    const matches = digitalSignaturesJsMatcher.matchFile(sourceFile, {
      filePath: 'signatures.js',
      fileContent: code,
    });
    assert.equal(matches.length, 4);
  });

  await t.test('exempts when guarded by crypto.subtle check', () => {
    const project = createInMemoryProject();
    const code = `
      if (!window.crypto?.subtle) {
        nacl.sign.detached.verify(msg, sig, pubKey);
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = digitalSignaturesJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts native crypto.subtle.sign and verify', () => {
    const project = createInMemoryProject();
    const code = `
      const signature = await crypto.subtle.sign('Ed25519', privateKey, data);
      const valid = await crypto.subtle.verify('Ed25519', publicKey, signature, data);
    `;
    const sourceFile = project.createSourceFile('native.js', code);
    const matches = digitalSignaturesJsMatcher.matchFile(sourceFile, {
      filePath: 'native.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
