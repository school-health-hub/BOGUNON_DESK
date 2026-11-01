import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const original=execFileSync('git',['show','7b24104cf0e5c0d17fbbf54402cd52ecb407e672:src-tauri/src/purchase_helper.rs'],{encoding:'utf8'});
const copy=readFileSync('tools/purchase-excel-cli/src/engine.rs','utf8');
let count=0;
for(const match of copy.matchAll(/^(?:pub(?:\(crate\))? )?fn (\w+)[\s\S]*?^}/gm)){
 if(['analyze_paths','export_bytes','verify_export','edufine_bytes','edufine_preview'].includes(match[1]))continue;
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

const enhancedSha='fec6deb78502b6101a7efd328ab4b0bb57fe77be';
const source=path=>execFileSync('git',['show',`${enhancedSha}:src/${path}`],{encoding:'utf8'});
const pure=source('purchase/purchaseSettlement.ts');
assert.equal(readFileSync('electron-p0/renderer/purchase/purchase/purchaseSettlement.ts','utf8'),pure);
assert.equal(readFileSync('electron-p0/main/purchase-settlement-domain.ts','utf8'),pure.replaceAll('./purchaseDomain','./purchase-domain.js').replaceAll('./types','../renderer/purchase/purchase/types.js'));
for(const name of ['purchaseOutputPreview','usePurchaseOutputPreview']){
 const original=source(`purchase/${name}.ts`);const selected=readFileSync(`electron-p0/renderer/purchase/purchase/${name}.ts`,'utf8');
 assert.equal(selected,name==='usePurchaseOutputPreview'?original.replace('createPurchaseSettlementExportRows, ','').replace('purchasePreviewRepository.settlement(createPurchaseSettlementExportRows(items, settlement), calculatePurchaseSettlementSummary(items, settlement))','purchasePreviewRepository.settlement(items, settlement)'):original);
}
assert.equal(readFileSync('electron-p0/renderer/purchase/components/desktop/PurchaseOutputPreviewDialog.tsx','utf8'),source('components/desktop/PurchaseOutputPreviewDialog.tsx'));
let settlement=execFileSync('git',['show',`${enhancedSha}:src-tauri/src/purchase_settlement.rs`],{encoding:'utf8'}).split('#[tauri::command]\npub fn save_purchase_settlement_export')[0];
settlement=settlement.replace('use std::path::Path;\n','').replace('use tauri::AppHandle;\n','').replace('use tauri_plugin_dialog::DialogExt;\n','').replace('use crate::purchase_helper::chrono_free_date;\n','').replaceAll('#[tauri::command]\n','').replace('fn write_purchase_settlement_workbook(\n    path: &Path,','pub(crate) fn settlement_bytes(').replaceAll(') -> Result<(), String> {',') -> Result<Vec<u8>, String> {').replace('workbook.save(path).map_err(|error| error.to_string())','workbook.save_to_buffer().map_err(|error| error.to_string())');
assert.equal(readFileSync('tools/purchase-excel-cli/src/settlement.rs','utf8').split('\n').slice(1).join('\n').split('\n#[cfg(test)]')[0],settlement);
console.log('Settlement calculation/preview/writer and Edufine original contract parity PASS');
