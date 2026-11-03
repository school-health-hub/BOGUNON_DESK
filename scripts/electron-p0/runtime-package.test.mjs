import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,copyFile,rm,readdir,stat} from 'node:fs/promises';
import {join,dirname,posix,resolve,normalize,win32} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {getMainFileMatchers} from 'app-builder-lib/out/fileMatcher.js';
import {createPackage,listPackage,extractFile} from '@electron/asar';
import ts from 'typescript';

const config=JSON.parse(await readFile('electron-p0/builder.json','utf8'));
const root='build/electron-p0-app';
async function walk(dir,prefix=''){
 const files=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const name=posix.join(prefix,entry.name);
  if(entry.isDirectory())files.push(...await walk(join(dir,entry.name),name));
  else files.push(name);
 }
 return files;
}
function verifyRuntime(files,read){
 const queue=['main/main.mjs','preload/preload.cjs'],seen=new Set();
 while(queue.length){
  const file=queue.pop();if(seen.has(file))continue;seen.add(file);
  assert(files.has(file),`Missing packaged runtime module: ${file}`);
  const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const visit=node=>{
   let specifier;
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))specifier=node.moduleSpecifier.text;
   if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]))specifier=node.arguments[0].text;
   if(specifier?.startsWith('.'))queue.push(posix.normalize(posix.join(posix.dirname(file),specifier)));
   ts.forEachChild(node,visit);
  };visit(source);
 }
 return seen;
}
test('builder selection archives the complete Main/Preload relative runtime graph',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'desk-runtime-package-'));
 try{
  const appDir=resolve(root);
  const matchers=getMainFileMatchers(appDir,join(temp,'app'),value=>value,config.win,{info:{config,projectDir:process.cwd(),buildResourcesDir:'build',isPrepackedAppAsar:false,debugLogger:{isEnabled:false}}},resolve(config.directories.output),false);
  assert.equal(matchers.length,1,'Review new file mappings before packaging');
  const filter=matchers[0].createFilter();
  const selected=[];
  for(const file of await walk(root)){const absolute=resolve(root,file);if(filter(absolute,await stat(absolute)))selected.push(file);}
  assert(selected.includes('main/inventory-connection/transport.js'),'Builder must include nested transport');
  const staging=join(temp,'app');await mkdir(staging);
  for(const file of selected){await mkdir(dirname(join(staging,file)),{recursive:true});await copyFile(join(root,file),join(staging,file));}
  const archive=join(temp,'app.asar');await createPackage(staging,archive);
  const files=new Set(listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')));
  const read=file=>extractFile(archive,normalize(file)).toString('utf8');
  const graph=verifyRuntime(files,read);
  assert(graph.has('inventory-qa-protocol.js'),'Main must use the Inventory protocol');
  assert(graph.has('protocol.js'));
  assert(graph.has('local-tasks.js'),'Task contract must ship with its Main store');
  for(const missing of graph){
   const broken=new Set(files);broken.delete(missing);
   assert.throws(()=>verifyRuntime(broken,read),/Missing packaged runtime module:/,`Missing ${missing} must fail`);
  }
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('native CLI generated output is ignored without hiding source crates',()=>{
 for(const file of ['build/official-document-cli/official-document-cli.exe','build/purchase-excel-cli/purchase-excel-cli.exe']){
  assert.equal(execFileSync('git',['check-ignore',file],{encoding:'utf8'}).trim(),file);
 }
 for(const file of ['tools/official-document-cli/src/main.rs','tools/purchase-excel-cli/src/main.rs']){
  assert.throws(()=>execFileSync('git',['check-ignore',file],{stdio:'pipe'}));
 }
});

// Exercise the installed ASAR implementation with Win32 path semantics on Linux too.
test('ASAR Win32 nested lookup reproduces POSIX failure and accepts native paths',async()=>{
 const require=createRequire(import.meta.url);
 const library=require.resolve('@electron/asar/lib/filesystem.js');
 const localRequire=createRequire(library),exports={};
 runInNewContext(await readFile(library,'utf8'),{exports,require:name=>name==='path'?win32:localRequire(name),Buffer,process});
 const make=()=>{const fs=new exports.Filesystem('C:\\synthetic');fs.setHeader({files:{main:{files:{'inventory-connection':{files:{'transport.js':{size:1,offset:'0'}}}}}}});return fs;};
 assert.throws(()=>make().getFile('main/inventory-connection/transport.js'),/was not found in this archive/);
 assert.equal(make().getFile(win32.normalize('main/inventory-connection/transport.js')).size,1);
});
