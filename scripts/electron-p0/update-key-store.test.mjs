import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {decryptRecoveryBackup,encryptRecoveryBackup,protectForWindowsUser,publicFingerprint,unprotectForWindowsUser} from './update-key-store.mjs';

test('encrypted recovery backup restores the same Ed25519 key and rejects tampering',()=>{
  const privatePem=generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const passphrase='synthetic QA recovery phrase only';
  const backup=encryptRecoveryBackup(privatePem,passphrase);
  assert.equal(decryptRecoveryBackup(backup,passphrase),privatePem);
  assert.equal(backup.fingerprint,publicFingerprint(privatePem));
  assert.throws(()=>decryptRecoveryBackup({...backup,ciphertext:'AAAA'},passphrase));
  assert.throws(()=>decryptRecoveryBackup(backup,'incorrect synthetic password'));
});

test('Windows CurrentUser protection round trips without exposing the key',()=>{
  if(process.platform!=='win32')return;
  const privatePem=generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}).toString();
  assert.equal(unprotectForWindowsUser(protectForWindowsUser(privatePem)),privatePem);
});
