import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  CLIENT_SIDE_ENCRYPTION_GUIDE_HASH,
  clientSideEncryptionJsMatcher,
  clientSideEncryptionJsRule,
  clientSideEncryptionRules,
} from './client-side-encryption.ts';

void test('client-side-encryption: rule metadata', () => {
  assert.equal(CLIENT_SIDE_ENCRYPTION_GUIDE_HASH.length, 12);

  assert.equal(
    clientSideEncryptionJsRule.id,
    'client-side-encryption/js-crypto',
  );
  assert.equal(
    clientSideEncryptionJsRule.guideId,
    'client-side-encryption',
  );
  assert.equal(
    clientSideEncryptionJsRule.guideHash,
    CLIENT_SIDE_ENCRYPTION_GUIDE_HASH,
  );

  assert.equal(clientSideEncryptionRules.length, 1);
  assert.ok(clientSideEncryptionJsRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(clientSideEncryptionJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('client-side-encryption JS matcher', async (t) => {
  await t.test('flags global and imported CryptoJS.AES.encrypt/decrypt and sjcl.encrypt/decrypt', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('encrypt.js', code);
    const matches = clientSideEncryptionJsMatcher.matchFile(sourceFile, {
      filePath: 'encrypt.js',
      fileContent: code,
    });
    assert.equal(matches.length, 5);
  });

  await t.test('exempts MD5 and SHA1 non-encryption hashing checksums and local shadowed symbols', () => {
    const project = createInMemoryProject();
    const code = `
      import CryptoJS from 'crypto-js';
      const checksum = CryptoJS.MD5('file-contents').toString();
      const sha1 = CryptoJS.SHA1('avatar-email').toString();
      const { sjcl } = customHelper;
      sjcl.encrypt('k', 'v');
    `;
    const sourceFile = project.createSourceFile('checksum.js', code);
    const matches = clientSideEncryptionJsMatcher.matchFile(sourceFile, {
      filePath: 'checksum.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts calls guarded by crypto.subtle feature check', () => {
    const project = createInMemoryProject();
    const code = `
      if (!window.crypto || !window.crypto.subtle) {
        CryptoJS.AES.encrypt('fallback', key);
        sjcl.encrypt(key, 'fallback');
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = clientSideEncryptionJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
