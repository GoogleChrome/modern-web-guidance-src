import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  digitalSignaturesJsMatcher
} from './digital-signatures.ts';
void test('digital-signatures JS matcher', async (t) => {
  await t.test('flags KJUR.crypto.Signature, nacl.sign, nacl.sign.detached.verify, and elliptic', () => {
    const code = `
      import nacl from 'tweetnacl';
      import { ec as EC } from 'elliptic';

      const sig = new KJUR.crypto.Signature({ alg: 'SHA256withECDSA' });
      const signed = nacl.sign(msgBytes, secretKey);
      const isOk = nacl.sign.detached.verify(msgBytes, sigBytes, publicKey);
      const curve = new EC('p256');
    `;
    const matches = matchJsRule(digitalSignaturesJsMatcher, 'signatures.js', code);
    assert.equal(matches.length, 4);
  });

  await t.test('exempts when guarded by crypto.subtle check', () => {
    const code = `
      if (!window.crypto?.subtle) {
        nacl.sign.detached.verify(msg, sig, pubKey);
      }
    `;
    const matches = matchJsRule(digitalSignaturesJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts native crypto.subtle.sign and verify, secp256k1 curves, and unimported EC classes', () => {
    const code = `
      import elliptic, { ec as ImportedEC } from 'elliptic';
      const signature = await crypto.subtle.sign('Ed25519', privateKey, data);
      const valid = await crypto.subtle.verify('Ed25519', publicKey, signature, data);
      const btcCurve = new ImportedEC('secp256k1');
      const ethCurve = new elliptic.ec('secp256k1');
      const ecdhCurve = new ImportedEC('curve25519');
      const dynamicCurve = new ImportedEC(this.curveType);
      const dynamicKjur = new KJUR.crypto.Signature({ alg: dynamicAlg });
      class EC { constructor(name) { this.name = name; } }
      const localEc = new EC('custom');
    `;
    const matches = matchJsRule(digitalSignaturesJsMatcher, 'native.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts Node.js server files importing crypto or fs and synchronous wrapper functions', () => {
    const code = `
      import crypto from 'crypto';
      import nacl from 'tweetnacl';
      const sig = nacl.sign.detached(msg, secretKey);
    `;
    const matches = matchJsRule(digitalSignaturesJsMatcher, 'server.js', code);
    assert.equal(matches.length, 0);

    const syncFnCode = `
      import nacl from 'tweetnacl';
      export function verifySync(msg, sig, pubKey): boolean {
        return nacl.sign.detached.verify(msg, sig, pubKey);
      }
    `;
    assert.equal(matchJsRule(digitalSignaturesJsMatcher, 'sync.ts', syncFnCode).length, 0);
  });
});
