import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDiagnostics,verifyRootDebt} from './int-el02-root-types.mjs';
const baseline=JSON.parse(readFileSync(new URL('./int-el02-root-diagnostics.json',import.meta.url),'utf8'));
test('normalizes Windows paths/positions but retains diagnostic identity and duplicate counts',()=>{
 assert.deepEqual(parseDiagnostics('src\\synthetic.ts(3,5): error TS2339: Synthetic missing property.\n  continuation'),[{file:'src/synthetic.ts',code:'TS2339',message:'Synthetic missing property.'}]);
 assert.throws(()=>parseDiagnostics('error TS9999: unsupported global diagnostic'));
 assert.equal(verifyRootDebt(baseline,[...baseline.diagnostics].reverse(),2).rootTypecheck,'FAIL');
});
test('rejects a new error, a replacement at the same count, missing errors, wrong SHA or a false clean-build claim',()=>{
 for(const rows of [[...baseline.diagnostics,{file:'synthetic.ts',code:'TS9999',message:'Synthetic new error'}],baseline.diagnostics.map((r,i)=>i? r:{...r,code:'TS9999'}),baseline.diagnostics.slice(1)])assert.throws(()=>verifyRootDebt(baseline,rows,2));
 assert.throws(()=>verifyRootDebt({...baseline,productSha:'unapproved'},baseline.diagnostics,2));
 assert.throws(()=>verifyRootDebt(baseline,baseline.diagnostics,0));
});
