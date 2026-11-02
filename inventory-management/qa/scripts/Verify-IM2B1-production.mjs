// Build the public connection entry in production, including an explicit hostile mode request.
import { build } from 'vite';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const out=await mkdtemp(join(tmpdir(),'inventory-im2b1-production-'));
try {
  const result=await build({configFile:false,root,mode:'production',logLevel:'error',build:{outDir:out,lib:{entry:resolve(root,'src/inventory-management/connection/index.ts'),formats:['es'],fileName:()=> 'connection.mjs'},minify:true}});
  const chunks=(Array.isArray(result)?result:[result]).flatMap(r=>r.output).filter(o=>o.type==='chunk');
  assert(chunks.every(c=>!Object.keys(c.modules).some(m=>m.endsWith('/localQa.ts'))),'Local QA transport must be absent from production public entry');
  const code=await readFile(join(out,'connection.mjs'),'utf8');
  for(const marker of ['56321','auth/v1/token','rest/v1/rpc','sb_secret_']) assert(!code.includes(marker));
  const api=await import(pathToFileURL(join(out,'connection.mjs')).href);
  const previous=globalThis.fetch; let requests=0;
  globalThis.fetch=()=>{requests++;throw Error('Production attempted network');};
  try {
    const p=await api.createInventoryConnection();assert.equal(p.mode,'preview');await p.adapter.loadWorkspace();
    for(const mode of ['local-qa','production']) await assert.rejects(()=>api.createInventoryConnection(mode,{endpoint:'http://127.0.0.1:56321',publishableKey:'sb_publishable_synthetic'}),e=>e.code==='ENVIRONMENT_BLOCKED');
    assert.equal(requests,0);
  } finally {globalThis.fetch=previous;}
  console.log('PASS: production entry excludes Local QA transport; Preview and rejected modes make zero network requests.');
} finally {await rm(out,{recursive:true,force:true});}
