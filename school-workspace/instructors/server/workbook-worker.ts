import {createHealthSupportSettlementDocuments} from '../core/settlement/documents.js';
import {parentPort,workerData} from 'node:worker_threads';
import {parseHealthSupportWorkLogImport} from '../core/import/work-log-import.js';
import {paymentWorkbook} from '../core/payment-workbook.js';
try {parentPort?.postMessage(workerData.kind==='read'?parseHealthSupportWorkLogImport(new Uint8Array(workerData.bytes),workerData.input):paymentWorkbook(createHealthSupportSettlementDocuments({instructor:workerData.board.instructor,workLogs:workerData.board.logs,month:workerData.month})));}
catch {parentPort?.postMessage({error:'unreadableWorkbook'});}
