import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  clientSideEncryptionJsMatcher
} from './client-side-encryption.ts';
void test('client-side-encryption JS matcher', async (t) => {
  await t.test('flags global and imported CryptoJS.AES.encrypt/decrypt and sjcl.encrypt/decrypt', () => {
    const code = `
      import CryptoJS from 'crypto-js';
      import AES from 'crypto-js/aes';
      const sjcl = require('sjcl');

      const ct = CryptoJS.AES.encrypt('secret message', passphrase);
      const pt = CryptoJS.AES.decrypt(ct, passphrase);
      const subCt = AES.encrypt('payload', passphrase);
      const sjclCt = sjcl.encrypt(password, 'plaintext');
      const sjclPt = sjcl.decrypt(password, sjclCt);
    `;
    const matches = matchJsRule(clientSideEncryptionJsMatcher, 'encrypt.js', code);
    assert.equal(matches.length, 5);
  });

  await t.test('exempts MD5 and SHA1 non-encryption hashing checksums and local shadowed symbols', () => {
    const code = `
      import CryptoJS from 'crypto-js';
      const checksum = CryptoJS.MD5('file-contents').toString();
      const sha1 = CryptoJS.SHA1('avatar-email').toString();
      const { sjcl } = customHelper;
      sjcl.encrypt('k', 'v');
    `;
    const matches = matchJsRule(clientSideEncryptionJsMatcher, 'checksum.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts calls guarded by crypto.subtle feature check', () => {
    const code = `
      if (!window.crypto || !window.crypto.subtle) {
        CryptoJS.AES.encrypt('fallback', key);
        sjcl.encrypt(key, 'fallback');
      }
    `;
    const matches = matchJsRule(clientSideEncryptionJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });
});
