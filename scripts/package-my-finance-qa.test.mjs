import { it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script=fileURLToPath(new URL('./package-my-finance-qa.mjs',import.meta.url));
async function fixture(patch={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'bogunon-qa-package-synthetic-'));
 execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['-c','user.name=Synthetic QA','-c','user.email=synthetic@example.invalid','commit','--allow-empty','-qm','synthetic'],{cwd:root});
 const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const bytes=Buffer.from('SYNTHETIC NOT AN EXECUTABLE');const hash=createHash('sha256').update(bytes).digest('hex');
 for(const dir of ['src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis','artifacts/my-finance-qa-evidence','docs'])await fs.mkdir(path.join(root,dir),{recursive:true});
 await fs.writeFile(path.join(root,'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/synthetic.exe'),bytes);
 await fs.writeFile(path.join(root,'docs/MY_FINANCE_WINDOWS_QA.md'),'SYNTHETIC instructions');
 await fs.writeFile(path.join(root,'artifacts/my-finance-qa-evidence/ISOLATION.json'),JSON.stringify({status:'passed',sourceSha:sha,sha256:hash,authenticodeStatus:'NotSigned',fullOperatingTreePreservedWhenClosed:true,simultaneousExecution:true,operatingNeverUninstalled:true,qaUninstallPreservedBothFinancialStores:true,...patch}));
 return{root,sha,hash};
}
it.each([{status:'failed'},{simultaneousExecution:false},{sha256:'0'.repeat(64)},{authenticodeStatus:'HashMismatch'}])('refuses testable packaging for invalid evidence %j',async(patch)=>{
 const {root}=await fixture(patch);try{const result=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});expect(result.status).not.toBe(0);await expect(fs.access(path.join(root,'artifacts/my-finance-qa-ready'))).rejects.toThrow();}finally{await fs.rm(root,{recursive:true,force:true});}
});
it('copies only the exact tested bytes and labels unsigned synthetic QA explicitly',async()=>{
 const {root,sha,hash}=await fixture();try{const result=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});expect(result.status,result.stderr).toBe(0);const status=JSON.parse(await fs.readFile(path.join(root,'artifacts/my-finance-qa-ready/QA-TEST-STATUS.json'),'utf8'));expect(status.sourceSha).toBe(sha);expect(status.sha256).toBe(hash);expect(status.authenticodeStatus).toBe('NotSigned');expect(status.productionDeployment).toBe(false);expect(status.fileName).toContain('MY-FINANCE-QA');}finally{await fs.rm(root,{recursive:true,force:true});}
});
