import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  DIGITAL_SIGNATURES_GUIDE_HASH,
  digitalSignaturesJsMatcher,
  digitalSignaturesJsRule,
  digitalSignaturesRules,
} from './digital-signatures.ts';

void test('digital-signatures: rule metadata', () => {
  assert.equal(DIGITAL_SIGNATURES_GUIDE_HASH.length, 12);

  assert.equal(digitalSignaturesJsRule.id, 'digital-signatures/js-signature');
  assert.equal(digitalSignaturesJsRule.guideId, 'digital-signatures');
  assert.equal(
    digitalSignaturesJsRule.guideHash,
    DIGITAL_SIGNATURES_GUIDE_HASH,
  );

  assert.equal(digitalSignaturesRules.length, 1);
  assert.ok(digitalSignaturesJsRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(digitalSignaturesJsRule.verifierRubric.dropWhen.length >= 2);
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

  await t.test('exempts native crypto.subtle.sign and verify, secp256k1 curves, and unimported EC classes', () => {
    const project = createInMemoryProject();
    const code = `
      import elliptic, { ec as ImportedEC } from 'elliptic';
      const signature = await crypto.subtle.sign('Ed25519', privateKey, data);
      const valid = await crypto.subtle.verify('Ed25519', publicKey, signature, data);
      const btcCurve = new ImportedEC('secp256k1');
      const ethCurve = new elliptic.ec('secp256k1');
      class EC { constructor(name) { this.name = name; } }
      const localEc = new EC('custom');
    `;
    const sourceFile = project.createSourceFile('native.js', code);
    const matches = digitalSignaturesJsMatcher.matchFile(sourceFile, {
      filePath: 'native.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
