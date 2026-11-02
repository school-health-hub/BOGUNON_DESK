import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,copyFile,rm,readdir} from 'node:fs/promises';
import {join,dirname,posix} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {minimatch} from 'minimatch';
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
  const selected=(await walk(root)).filter(file=>config.files.some(pattern=>minimatch(file,pattern)));
  const staging=join(temp,'app');await mkdir(staging);
  for(const file of selected){await mkdir(dirname(join(staging,file)),{recursive:true});await copyFile(join(root,file),join(staging,file));}
  const archive=join(temp,'app.asar');await createPackage(staging,archive);
  const files=new Set(listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')));
  const read=file=>extractFile(archive,file).toString('utf8');
  const graph=verifyRuntime(files,read);
  assert(graph.has('inventory-qa-protocol.js'),'Main must use the Inventory protocol');
  assert(graph.has('protocol.js'));
  const broken=new Set(files);broken.delete('inventory-qa-protocol.js');
  assert.throws(()=>verifyRuntime(broken,read),/Missing packaged runtime module: inventory-qa-protocol.js/);
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
