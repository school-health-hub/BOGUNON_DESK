import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {HOST_BASELINE} from './inventory-host-ci-policy.mjs';
export function parseDiagnostics(output){
 const rows=[];
 for(const line of output.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/)){
  const match=/^(.*?)\(\d+,\d+\): error (TS\d+): (.*)$/.exec(line);
  if(match)rows.push({file:match[1].replaceAll('\\','/'),code:match[2],message:match[3]});
  else if(/error TS\d+:/.test(line))throw Error('UNPARSED_DIAGNOSTIC');
 }
 return rows;
}
export function verifyRootDebt(baseline,actual,status){
 if(baseline.productSha!==HOST_BASELINE||baseline.expectedCount!==15||baseline.diagnostics.length!==15)throw Error('ROOT_BASELINE');
 const signatures=rows=>rows.map(r=>JSON.stringify([r.file,r.code,r.message])).sort();
 if(status!==2||JSON.stringify(signatures(actual))!==JSON.stringify(signatures(baseline.diagnostics)))throw Error('ROOT_DIAGNOSTICS_CHANGED');
 return {status:'EXPECTED_FAILURE',rootTypecheck:'FAIL',baselineCount:15,actualCount:actual.length,newDiagnostics:0,removedDiagnostics:0,productSha:HOST_BASELINE};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const baseline=JSON.parse(readFileSync(new URL('./int-el02-root-diagnostics.json',import.meta.url),'utf8'));
  const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--pretty','false'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000,maxBuffer:4*1024*1024});
  if(result.error)throw Error('ROOT_COMMAND_FAILED');
  const report=verifyRootDebt(baseline,parseDiagnostics(result.stdout+'\n'+result.stderr),result.status);
  console.log(JSON.stringify(report));
 }catch{console.error('BLOCKED: root diagnostic baseline changed or could not be verified; root build is not PASS. Raw diagnostics withheld.');process.exitCode=1;}
}
