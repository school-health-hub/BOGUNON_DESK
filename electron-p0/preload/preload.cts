import type {FinanceIdentity,IncomeRecord,Phase2Data} from '../finance-protocol.js';
import type {InventoryQaApi} from '../inventory-qa-protocol.js';
import { contextBridge, ipcRenderer } from 'electron';
import type { P0Bridge, P0Settings, WorkBridge, SyntheticSummaryRequest, MemoDocument, NewsletterExportRequest, NewsletterProjectsBridge, PurchaseClipboardRequest, PurchaseCsvMappingRequest, PurchaseExportRequest, SettlementRequest, EdufineRequest, EducationVideoLibraryItem,InventoryDocument,OfficialDocumentSave,AiConnect,AiRequest } from '../protocol.js';
if (!process.sandboxed || !process.contextIsolated) throw new Error('PoC requires a sandboxed isolated preload');
const bridge: P0Bridge = Object.freeze({
  info: () => ipcRenderer.invoke('p0:info'),
  readSettings: () => ipcRenderer.invoke('p0:read-settings'),
  writeSettings: (settings: P0Settings) => ipcRenderer.invoke('p0:write-settings',settings),
});
contextBridge.exposeInMainWorld('electronP0',bridge);

const projectCall=async(channel:string,...args:unknown[])=>{try{return await ipcRenderer.invoke(channel,...args);}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'프로젝트 연결에 실패했습니다.',retryable:true}};}};
const projects:NewsletterProjectsBridge=Object.freeze({
 list:()=>projectCall('p2:newsletter:projects:list'),
 load:r=>projectCall('p2:newsletter:projects:load',r),
 save:r=>projectCall('p2:newsletter:projects:save',r),
 history:r=>projectCall('p2:newsletter:projects:history',r),
 preview:r=>projectCall('p2:newsletter:projects:preview',r),
 restore:r=>projectCall('p2:newsletter:projects:restore',r),
});
const inventoryBusiness:InventoryQaApi=Object.freeze<InventoryQaApi>({
 login:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:login',input),
 logout:()=>ipcRenderer.invoke('p2:inventory-local-qa:logout'),
 authState:()=>ipcRenderer.invoke('p2:inventory-local-qa:authState'),
 dispose:()=>ipcRenderer.invoke('p2:inventory-local-qa:dispose'),
 selectSchool:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:selectSchool',input),
 listItems:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:listItems',input),
 itemDetail:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:itemDetail',input),
 movements:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:movements',input),
 purchaseBatches:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:purchaseBatches',input),
 purchaseProgress:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:purchaseProgress',input),
 registerItem:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:registerItem',input),
 prepare:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:prepare',input),
 execute:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:execute',input),
 discard:(input)=>ipcRenderer.invoke('p2:inventory-local-qa:discard',input),
});
const work: WorkBridge = Object.freeze({tasks:Object.freeze({load:()=>projectCall('p2:tasks:load'),save:(document:import('../local-tasks.js').LocalTaskDocument,expectedRevision:number)=>projectCall('p2:tasks:save',document,expectedRevision)}),inventoryLocalQa:Object.freeze({business:inventoryBusiness,status:()=>projectCall("p2:inventory-local-qa:status")}),officialDocument:Object.freeze({pick:()=>projectCall('p2:official-document:pick'),save:(document:OfficialDocumentSave)=>projectCall('p2:official-document:save',document),cancel:()=>projectCall('p2:official-document:cancel')}),finance:Object.freeze({status:()=>projectCall('p2:finance:status'),load:()=>projectCall('p2:finance:load'),createIncome:(input:{expected:FinanceIdentity;entry:IncomeRecord})=>projectCall('p2:finance:createIncome',input),updateIncome:(input:{expected:FinanceIdentity;entry:IncomeRecord})=>projectCall('p2:finance:updateIncome',input),deleteIncome:(input:{expected:FinanceIdentity;id:string})=>projectCall('p2:finance:deleteIncome',input),replacePhase2:(input:{expected:FinanceIdentity;phase2:Phase2Data})=>projectCall('p2:finance:replacePhase2',input),exportBackup:(input:{expected:FinanceIdentity;password:string})=>projectCall('p2:finance:exportBackup',input),selectBackup:()=>projectCall('p2:finance:selectBackup'),inspectBackup:(input:{token:string;password:string})=>projectCall('p2:finance:inspectBackup',input),restoreBackup:(input:{token:string;confirmDatasetChange:boolean})=>projectCall('p2:finance:restoreBackup',input),cancelBackup:(input:{token:string})=>projectCall('p2:finance:cancelBackup',input),close:()=>projectCall('p2:finance:close')}),ai:Object.freeze({status:()=>projectCall('p2:ai:status'),connectFromClipboard:(input:AiConnect)=>projectCall('p2:ai:connectFromClipboard',input),restore:()=>projectCall('p2:ai:restore'),selectModel:(input:{model:string})=>projectCall('p2:ai:selectModel',input),disconnect:()=>projectCall('p2:ai:disconnect'),cancel:()=>projectCall('p2:ai:cancel'),generate:(input:AiRequest)=>projectCall('p2:ai:generate',input)}),inventory:Object.freeze({load:()=>projectCall('p2:inventory:load'),save:(document:InventoryDocument,expectedUpdatedAt?:string|null)=>expectedUpdatedAt===undefined?projectCall('p2:inventory:save',document):projectCall('p2:inventory:save',document,expectedUpdatedAt)}),educationVideo:Object.freeze({exportFile:()=>projectCall('p2:education-video:export-file'),load:()=>projectCall('p2:education-video:load'),save:(item:EducationVideoLibraryItem)=>projectCall('p2:education-video:save',item),import:(json:string)=>projectCall('p2:education-video:import',json),export:()=>projectCall('p2:education-video:export'),recover:()=>projectCall('p2:education-video:recover')}),purchase:Object.freeze({previewSettlement:(r:SettlementRequest)=>projectCall('p2:purchase:settlement:preview',r),exportSettlement:(r:SettlementRequest)=>projectCall('p2:purchase:settlement:export',r),previewEdufine:(r:EdufineRequest)=>projectCall('p2:purchase:edufine:preview',r),exportEdufine:(r:EdufineRequest)=>projectCall('p2:purchase:edufine:export',r),exportItems:(request:PurchaseExportRequest)=>projectCall('p2:purchase:export',request),pickPdf:()=>projectCall('p2:purchase:pdf:pick'),cancelPdf:()=>projectCall('p2:purchase:pdf:cancel'),mapPdf:(request:PurchaseCsvMappingRequest)=>projectCall('p2:purchase:pdf:map',request),pickExcel:()=>projectCall('p2:purchase:excel:pick'),cancelExcel:()=>projectCall('p2:purchase:excel:cancel'),mapExcel:(request:PurchaseCsvMappingRequest)=>projectCall('p2:purchase:excel:map',request),pickCsv:()=>projectCall('p2:purchase:csv:pick'),cancelCsv:()=>projectCall('p2:purchase:csv:cancel'),mapCsv:(request:PurchaseCsvMappingRequest)=>projectCall('p2:purchase:csv:map',request),copy:(request:PurchaseClipboardRequest)=>projectCall('p2:purchase:copy',request)}),sample:Object.freeze({
  summarize: async (request:SyntheticSummaryRequest) => {
    try{return await ipcRenderer.invoke('p2:sample:summary',request);}
    catch{return {ok:false as const,error:{code:'INTERNAL_ERROR' as const,message:'샘플 연결을 완료하지 못했습니다.',retryable:true}};}
  },
}),newsletter:Object.freeze({projects,exportOutput:async(request:NewsletterExportRequest)=>{try{return await ipcRenderer.invoke('p2:newsletter:export',request);}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'출력 연결에 실패했습니다.',retryable:true}};}},saveJson:async(request:{readonly json:string})=>{try{return await ipcRenderer.invoke('p2:newsletter:save-json',request);}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'JSON 저장 연결을 완료하지 못했습니다.',retryable:true}};}}}),memo:Object.freeze({
  read:async()=>{try{return await ipcRenderer.invoke('p2:memo:read');}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'메모 연결을 완료하지 못했습니다.',retryable:true}};}},
  write:async(document:MemoDocument)=>{try{return await ipcRenderer.invoke('p2:memo:write',document);}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'메모 연결을 완료하지 못했습니다.',retryable:true}};}},
})});
contextBridge.exposeInMainWorld('electronWork',work);
