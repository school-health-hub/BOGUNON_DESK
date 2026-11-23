import {createHash,createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';

const [installerPath,baseUrl,notesPath,outputPath]=process.argv.slice(2);
if(!installerPath||!baseUrl||!notesPath||!outputPath)throw new Error('Usage: sign-update-manifest.mjs <NSIS EXE> <HTTPS base URL> <notes.txt> <output.json>');
const config=JSON.parse(await readFile('config/production-electron-update.json','utf8'));
const product=JSON.parse(await readFile('electron-p0/package.json','utf8'));
const keyText=process.env.BOGUNON_UPDATE_SIGN_KEY;
if(config.enabled!==true||!keyText)throw new Error('A configured public update key and a separate private signing key are required.');
const base=new URL(baseUrl),feed=new URL(config.manifestUrl);
if(base.protocol!=='https:'||base.origin!==feed.origin||base.username||base.password||base.search||base.hash)throw new Error('The update URL must use the configured HTTPS origin.');
if(feed.hostname==='github.com'){
  const match=/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/releases\/download\/updates-(beta|stable)\/bogunon-update\.json$/.exec(feed.pathname);
  if(!match||base.pathname!==`/${match[1]}/${match[2]}/releases/download/v${product.version}/`)throw new Error('The GitHub Release must match the configured repository and product version.');
}
if(basename(installerPath)!==`BOGUNON-DESK-Setup-${product.version}-x64.exe`)throw new Error('NSIS file name does not match the product version.');
const privateKey=createPrivateKey(keyText),publicKey=createPublicKey(privateKey).export({type:'spki',format:'pem'}).toString();
if(![config.publicKeyPem,config.nextPublicKeyPem].some(key=>typeof key==='string'&&publicKey.trim()===key.trim()))throw new Error('Private key does not match an app public key.');
const notes=(await readFile(notesPath,'utf8')).trim(),size=(await stat(installerPath)).size;
if(!notes||notes.length>2000||!Number.isSafeInteger(size)||size<1||size>1024*1024*1024)throw new Error('Invalid update notes or installer size.');
const hash=createHash('sha256');for await(const chunk of createReadStream(installerPath))hash.update(chunk);
const sha256=hash.digest('hex'),url=new URL(encodeURIComponent(basename(installerPath)),base).href;
const issuedAt=new Date(),expiresAt=new Date(issuedAt.getTime()+30*24*60*60*1000);
const payload={schema:2,channel:config.channel,version:product.version,notes,url,size,sha256,issuedAt:issuedAt.toISOString(),expiresAt:expiresAt.toISOString()};
const signature=sign(null,Buffer.from(JSON.stringify([payload.schema,payload.channel,payload.version,payload.notes,payload.url,payload.size,payload.sha256,payload.issuedAt,payload.expiresAt])),privateKey).toString('base64');
await writeFile(outputPath,JSON.stringify({...payload,signature},null,2)+'\n',{flag:'wx'});
process.stdout.write(`Signed update manifest: ${basename(outputPath)} (${product.version})\n`);
