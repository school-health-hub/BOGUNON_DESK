import {generateKeyPairSync} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,relative,resolve} from 'node:path';
import {decryptRecoveryBackup,defaultSigningStore,encryptRecoveryBackup,promptRecoveryPassphrase,protectForWindowsUser,publicFingerprint,publicPem,readProtectedSigningKey} from './update-key-store.mjs';

const [mode,backupArgument]=process.argv.slice(2);
if(process.platform!=='win32'||!['provision','backup','restore','public'].includes(mode))throw new Error('Usage on Windows: provision-update-key.mjs <provision|backup|restore|public> <absolute encrypted backup path>');
const store=defaultSigningStore();
if(!isAbsolute(store))throw new Error('LOCALAPPDATA must be an absolute Windows profile path.');
const backup=backupArgument?resolve(backupArgument):'';
if(mode!=='public'&&!isAbsolute(backupArgument??''))throw new Error('Provide an absolute encrypted backup path outside Git.');
if(mode!=='public'){
  const withinRepository=relative(process.cwd(),backup);
  if(withinRepository===''||!withinRepository.startsWith('..')&&!isAbsolute(withinRepository))throw new Error('The encrypted backup must stay outside the repository.');
}
if(mode==='provision'){
  try{await readFile(store);throw new Error('An operational signing key already exists. Refusing to replace it.');}
  catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw error;}
  try{await readFile(backup);throw new Error('An encrypted backup already exists. Refusing to replace it.');}
  catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw error;}
  const passphrase=promptRecoveryPassphrase(true);
  const {privateKey}=generateKeyPairSync('ed25519');
  const privatePem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const protectedBlob=protectForWindowsUser(privatePem);
  const recovery=encryptRecoveryBackup(privatePem,passphrase);
  await mkdir(dirname(store),{recursive:true});
  await mkdir(dirname(backup),{recursive:true});
  await writeFile(backup,JSON.stringify(recovery,null,2)+'\n',{flag:'wx'});
  await writeFile(store,protectedBlob+'\n',{flag:'wx'});
  const restored=decryptRecoveryBackup(JSON.parse(await readFile(backup,'utf8')),passphrase);
  if(publicFingerprint(restored)!==publicFingerprint(await readProtectedSigningKey(store)))throw new Error('Signing key backup verification failed.');
  console.log(`Operational key prepared. Public fingerprint: ${publicFingerprint(privatePem)}`);
  console.log(`Protected store: ${store}`);
  console.log(`Encrypted backup: ${backup}`);
}else if(mode==='backup'){
  const privatePem=await readProtectedSigningKey(store);
  const recovery=encryptRecoveryBackup(privatePem,promptRecoveryPassphrase(true));
  await mkdir(dirname(backup),{recursive:true});
  await writeFile(backup,JSON.stringify(recovery,null,2)+'\n',{flag:'wx'});
  console.log(`Encrypted backup prepared. Public fingerprint: ${publicFingerprint(privatePem)}`);
}else if(mode==='restore'){
  const recovery=JSON.parse(await readFile(backup,'utf8'));
  const privatePem=decryptRecoveryBackup(recovery,promptRecoveryPassphrase(false));
  await mkdir(dirname(store),{recursive:true});
  await writeFile(store,protectForWindowsUser(privatePem)+'\n',{flag:'wx'});
  console.log(`Operational key restored. Public fingerprint: ${publicFingerprint(privatePem)}`);
}else{
  const privatePem=await readProtectedSigningKey(store);
  console.log(publicPem(privatePem));
  console.log(`Public fingerprint: ${publicFingerprint(privatePem)}`);
}
