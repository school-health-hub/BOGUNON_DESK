import {excludedNames,excludedExts} from 'app-builder-lib/out/fileMatcher.js';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,cp,readdir,stat,rm} from 'node:fs/promises';
import {dirname,join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
// Match electron-builder's shared metadata exclusions before hashing the staged payload.
const excludedMetadata=new Set(excludedNames.split(',')),metadataExtensions=[...excludedExts.split(','),'pdb'];
const isMetadata=(part)=>excludedMetadata.has(part)||part.startsWith('._')||metadataExtensions.some(ext=>part.endsWith('.'+ext));
const root=resolve('build/purchase-ocr'),require=createRequire(resolve('package.json')),seen=new Map();
await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});
async function copyPackage(name,fromRequire=require){
 const source=dirname(fromRequire.resolve(name+'/package.json')),pkg=JSON.parse(await readFile(join(source,'package.json'),'utf8'));
 if(seen.has(name)){if(seen.get(name)!==pkg.version)throw Error('Conflicting OCR dependency versions');return;}
 seen.set(name,pkg.version);const dest=join(root,'node_modules',name);await mkdir(dest,{recursive:true});
 if(name==='tesseract.js-core'){
  for(const file of ['package.json','LICENSE','README.md','tesseract-core.js','tesseract-core.wasm','tesseract-core-simd.js','tesseract-core-simd.wasm'])await cp(join(source,file),join(dest,file));
 }else await cp(source,dest,{recursive:true,filter:path=>!path.slice(source.length).split(/[\\/]/).some(part=>(['node_modules','.git','test','tests','examples'].includes(part)||isMetadata(part)||(part==='dist'&&name==='tesseract.js')))});
 const childRequire=createRequire(join(source,'package.json'));
 for(const dep of Object.keys(pkg.dependencies??{}))await copyPackage(dep,childRequire);
}
await copyPackage('tesseract.js');
await copyPackage('pngjs');
await mkdir(join(root,'data'),{recursive:true});
for(const lang of ['kor','eng']){
 const source=dirname(require.resolve('@tesseract.js-data/'+lang+'/package.json'));
 await cp(join(source,'4.0.0_best_int',lang+'.traineddata.gz'),join(root,'data',lang+'.traineddata.gz'));
 await cp(join(source,'package.json'),join(root,'data',lang+'-package.json'));
 await cp(join(source,'README.md'),join(root,'data',lang+'-README.md'));
}
await cp('electron-p0/ocr/licenses',join(root,'licenses'),{recursive:true});
for(const file of ['runner.cjs','offline-guard.cjs','preprocess.cjs'])await cp(join('electron-p0/ocr',file),join(root,file));
const files=[];async function scan(dir){for(const name of await readdir(dir)){const file=join(dir,name),s=await stat(file);if(s.isDirectory())await scan(file);else files.push({file:relative(root,file).replaceAll('\\','/'),bytes:s.size,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});}}
await scan(root);
await writeFile(join(root,'manifest.json'),JSON.stringify({engine:'Tesseract.js',version:seen.get('tesseract.js'),coreVersion:seen.get('tesseract.js-core'),engineLicense:'Apache-2.0',languagePackages:{kor:'1.0.0',eng:'1.0.0'},languagePackageLicense:'MIT (npm metadata); upstream traineddata Apache-2.0',offline:true,network:'disabled in child and worker threads',languages:['kor','eng'],files,bytes:files.reduce((sum,f)=>sum+f.bytes,0)},null,2));
console.log(`Offline OCR: ${files.length} files, ${(files.reduce((sum,f)=>sum+f.bytes,0)/1024/1024).toFixed(1)} MiB`);
