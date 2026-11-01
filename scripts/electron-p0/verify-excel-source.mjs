import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const original=execFileSync('git',['show','1aeb817c6214213b23659fe54b66c6bdf7ac532c:src-tauri/src/purchase_helper.rs'],{encoding:'utf8'});
const copy=readFileSync('tools/purchase-excel-cli/src/engine.rs','utf8');
let count=0;
for(const match of copy.matchAll(/^(?:pub(?:\(crate\))? )?fn (\w+)[\s\S]*?^}/gm)){
 if(match[1]==='analyze_paths')continue;
 assert(original.includes(match[0]),`Original Rust function changed: ${match[1]}`);count++;
}
const pdfOutput=copy.match(/^impl OutputDev for PdfLayoutOutput[\s\S]*?^}/m)?.[0];assert(pdfOutput&&original.includes(pdfOutput));
const bounds=copy.match(/^impl SpreadsheetBounds[\s\S]*?^}/m)?.[0];assert(bounds&&original.includes(bounds));
const selection=original.slice(original.indexOf('        let parsed = tables'),original.indexOf('const ANALYSIS_WORKER_ERROR'));
assert(copy.includes(selection));
for(const match of readFileSync('tools/purchase-excel-cli/src/engine_tests.rs','utf8').split('#[test]\nfn cli_fixtures')[0].matchAll(/^    fn \w+[\s\S]*?^    }/gm))assert(original.includes(match[0]),'Original synthetic test/helper changed');
assert(count>=25);console.log(`Rust source parity PASS: ${count} functions, bounds, selection and original test bodies`);
