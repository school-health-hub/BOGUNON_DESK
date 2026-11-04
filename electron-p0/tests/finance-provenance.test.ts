import {it,expect} from 'vitest';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import ts from 'typescript';
it('preserves the selected Rust crypto/SQLCipher/restore engines byte-for-byte (only fixture relative path adapted)',()=>{
 const manifest=JSON.parse(readFileSync('tools/my-finance-cli/source-hashes.json','utf8'));for(const [path,hash] of Object.entries(manifest.files)){const name=path.slice(path.lastIndexOf('/')+1);let bytes=readFileSync(`tools/my-finance-cli/src/${name}`);if(name===manifest.testPathAdaptation.file)bytes=Buffer.from(bytes.toString().replace(manifest.testPathAdaptation.to,manifest.testPathAdaptation.from));expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);expect(bytes).toEqual(readFileSync(path));}
 const original=readFileSync('src-tauri/src/my_finance_commands.rs','utf8'),platform=readFileSync('tools/my-finance-cli/src/platform.rs','utf8');const start=original.indexOf('#[cfg(windows)]\nfn open_at('),end=original.indexOf('#[cfg(all(test, windows))]\nmod tests',start);expect(platform).toContain(original.slice(start,end).replace('fn open_at(','pub(crate) fn open_at('));
});
it('keeps public DTO declarations identical to the original domain/repository contracts',()=>{
 const aliases=(path:string)=>{const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);return new Map(source.statements.filter(ts.isTypeAliasDeclaration).map(node=>[node.name.text,node.getText(source)]));};const reused=new Map([...aliases('src/my-finance/domain.ts'),...aliases('src/my-finance/repository.ts')]);for(const [name,declaration] of aliases('electron-p0/finance-protocol.ts'))if(reused.has(name))expect(declaration).toBe(reused.get(name));
});
it('packages the fixed Windows engine, with no Tauri repository or plaintext export adapter in the renderer',()=>{
 const config=JSON.parse(readFileSync('electron-p0/builder.json','utf8'));expect(config.win.extraResources).toContainEqual({from:'build/my-finance-cli',to:'my-finance-cli',filter:['my-finance-cli.exe']});expect(readFileSync('.gitignore','utf8')).toContain('/build/my-finance-cli/');const code=readFileSync('electron-p0/renderer/finance/repository.ts','utf8');expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|invoke\(/);const meta=JSON.parse(readFileSync('build/electron-p0-app/renderer/p0-renderer-boundary.json','utf8'));expect(meta.reused.filter((p:string)=>p.includes('/my-finance/'))).not.toContain('src/my-finance/repository.ts');
});

import {getFileMatchers} from 'app-builder-lib/out/fileMatcher.js';
import {resolve,basename} from 'node:path';
it('uses actual electron-builder extraResources merging to include all three Windows engines',()=>{
 const config=JSON.parse(readFileSync('electron-p0/builder.json','utf8'));const matchers=getFileMatchers(config,'extraResources',resolve('/tmp/synthetic-resources'),{defaultSrc:process.cwd(),macroExpander:(v:string)=>v,customBuildOptions:config.win,globalOutDir:resolve('release-electron-p0')});expect(matchers?.map(m=>basename(m.from)).sort()).toEqual(['chatgpt-auth-cli','my-finance-cli','official-document-cli','purchase-excel-cli','purchase-ocr','node_modules'].sort());
});
