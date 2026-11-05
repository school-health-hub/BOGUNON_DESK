// Extracted verbatim row contract from original PaymentStatementPreview.downloadExcel.
import * as XLSX from 'xlsx';
import type {HealthSupportSettlementDocuments} from './settlement/documents.js';
export function paymentWorkbook(documents:HealthSupportSettlementDocuments):Uint8Array {
 const statement=documents.paymentStatement;
 const rows=[['순','','1','비고'],['성명','',statement.instructorName,''],['주당시수','',statement.weeklyHours,''],['과목','',statement.subject,''],['일자','요일','수업시수','비고'],...statement.rows.map(row=>[`${Number(statement.month.slice(5,7))}월 ${Number(row.date.slice(8,10))}일`,row.weekday,row.hours,row.note]),['총계','',statement.hours,''],['금액','',statement.amount,'']];
 const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(rows),'지급명세서');
 return new Uint8Array(XLSX.write(workbook,{bookType:'xlsx',type:'array'}));
}
