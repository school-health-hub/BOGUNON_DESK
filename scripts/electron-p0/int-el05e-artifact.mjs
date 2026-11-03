import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join,posix,normalize} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sourceSha='9e22f7e5666ffa73afc48a03ff2c844ea67bc0c9';
const root=resolve(process.argv[2]??'product');
const run=(command,args)=>execFileSync(command,args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(run('git',['rev-parse','HEAD']),sourceSha);
assert.equal(run('git',['status','--porcelain']),'','Product checkout must remain clean');
const require=createRequire(join(root,'package.json'));
const asar=require('@electron/asar'),ts=require('typescript');
const output=join(root,'release-electron-p0');
const archive=join(output,'win-unpacked/resources/app.asar');
const files=new Set(asar.listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')));
const read=file=>asar.extractFile(archive,normalize(file)).toString('utf8');
const queue=['main/main.mjs','preload/preload.cjs'],seen=new Set();
while(queue.length){
 const file=queue.pop();if(seen.has(file))continue;seen.add(file);
 assert(files.has(file),`Missing runtime module in actual ASAR: ${file}`);
 const visit=node=>{
  let specifier;
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))specifier=node.moduleSpecifier.text;
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]))specifier=node.arguments[0].text;
  if(specifier?.startsWith('.'))queue.push(posix.normalize(posix.join(posix.dirname(file),specifier)));
  ts.forEachChild(node,visit);
 };
 visit(ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS));
}
assert(seen.has('inventory-qa-protocol.js'));
assert(seen.has('protocol.js'));
const metadata=JSON.parse(read('build-meta.json'));
assert.equal(metadata.sourceSha,sourceSha);assert.equal(metadata.dirty,false);
assert.deepEqual(metadata,JSON.parse(await readFile(join(root,'build/electron-p0-app/build-meta.json'),'utf8')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const nativeClis=[];
for(const name of ['purchase-excel-cli','official-document-cli','my-finance-cli']){
 const file=`${name}.exe`;
 const bytes=await readFile(join(output,'win-unpacked/resources',name,file));
 assert.equal(bytes.subarray(0,2).toString(),'MZ');
 assert.equal(hash(bytes),hash(await readFile(join(root,'build',name,file))),'Packaged CLI must match build output');
 nativeClis.push({file,sha256:hash(bytes),included:true});
}
const executables=(await readdir(output)).filter(file=>file.endsWith('.exe'));
assert.equal(executables.length,1,'Only the Portable EXE is expected');
assert(!executables[0].includes('Setup'));
const bytes=await readFile(join(output,executables[0]));assert.equal(bytes.subarray(0,2).toString(),'MZ');
const manifest={version:1,scope:'Integrated 12-feature Windows x64 Portable',productSourceSha:sourceSha,integrationBaselineSha:sourceSha,ciWorkflowSha:process.env.GITHUB_SHA,runUrl:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,buildType:'Windows x64 Portable; no updater publication',financeBuild:{extraCargoFeature:'windows-sys/Win32_Security',reason:'CreateJobObjectW export gate missing from product Cargo.toml',productCargoFilesModified:false,originalCommandFailureRun:41606939989},metadata,packagedApplication:{file:'BOGUNON DESK ELECTRON P0.exe',sha256:hash(await readFile(join(output,'win-unpacked','BOGUNON DESK ELECTRON P0.exe')))},asar:{sha256:hash(await readFile(archive)),runtimeGraph:'PASS',modules:[...seen].sort(),requiredInventoryProtocol:true},nativeClis,portable:{file:executables[0],sha256:hash(bytes),signature:'PENDING_CHECK'},versions:{node:process.version,electron:require('electron/package.json').version,rust:run('rustc',['--version'])},windowsGui:'NOT RUN',installationQa:'NOT RUN',productionDeployment:false};
await writeFile(join(output,'INTEGRATED-PORTABLE-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(output,'SHA256SUMS.txt'),`${manifest.portable.sha256}  ${manifest.portable.file}\n`);
console.log(JSON.stringify(manifest,null,2));
