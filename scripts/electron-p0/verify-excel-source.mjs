import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const original=execFileSync('git',['show','26f57a0b3e5f42f4ef8532f45acd8b746a6edcb6:src-tauri/src/purchase_helper.rs'],{encoding:'utf8'});
const copy=readFileSync('tools/purchase-excel-cli/src/engine.rs','utf8');
let count=0;
for(const match of copy.matchAll(/^(?:pub(?:\(crate\))? )?fn (\w+)[\s\S]*?^}/gm)){
 if(['analyze_paths','export_bytes','verify_export'].includes(match[1]))continue;
 assert(original.includes(match[0]),`Original Rust function changed: ${match[1]}`);count++;
}
const pdfOutput=copy.match(/^impl OutputDev for PdfLayoutOutput[\s\S]*?^}/m)?.[0];assert(pdfOutput&&original.includes(pdfOutput));
const bounds=copy.match(/^impl SpreadsheetBounds[\s\S]*?^}/m)?.[0];assert(bounds&&original.includes(bounds));
const selection=original.slice(original.indexOf('        let parsed = tables'),original.indexOf('const ANALYSIS_WORKER_ERROR'));
assert(copy.includes(selection));
for(const match of readFileSync('tools/purchase-excel-cli/src/engine_tests.rs','utf8').split('#[test]\nfn cli_fixtures')[0].matchAll(/^    fn \w+[\s\S]*?^    }/gm))assert(original.includes(match[0]),'Original synthetic test/helper changed');
assert(count>=25);console.log(`Rust source parity PASS: ${count} functions, bounds, selection and original test bodies`);

const start=original.indexOf('    if format == "csv" {',original.indexOf('pub fn save_purchase_export'));
const end=original.indexOf('\n    Ok(true)',start);
const writer=original.slice(start,end).replace('fs::write(path, bytes).map_err(|error| error.to_string())?;','return Ok(bytes);').replace('workbook.save(path).map_err(|error| error.to_string())?;','return workbook.save_to_buffer().map_err(|error| error.to_string());');
assert(copy.includes(writer),'Original CSV/XLSX writer loop changed');
const domain=readFileSync('electron-p0/renderer/purchase/purchase/purchaseDomain.ts','utf8');
assert.equal(readFileSync('electron-p0/main/purchase-domain.ts','utf8').replace('./purchase-domain-types.js','./types'),domain,'Original monetary calculation changed');
console.log('Original writer and TypeScript monetary contract parity PASS');
