import { contextBridge, ipcRenderer } from 'electron';
import type { P0Bridge, P0Settings, WorkBridge, SyntheticSummaryRequest, MemoDocument, NewsletterExportRequest } from '../protocol.js';
if (!process.sandboxed || !process.contextIsolated) throw new Error('PoC requires a sandboxed isolated preload');
const bridge: P0Bridge = Object.freeze({
  info: () => ipcRenderer.invoke('p0:info'),
  readSettings: () => ipcRenderer.invoke('p0:read-settings'),
  writeSettings: (settings: P0Settings) => ipcRenderer.invoke('p0:write-settings',settings),
});
contextBridge.exposeInMainWorld('electronP0',bridge);

const work: WorkBridge = Object.freeze({sample:Object.freeze({
  summarize: async (request:SyntheticSummaryRequest) => {
    try{return await ipcRenderer.invoke('p2:sample:summary',request);}
    catch{return {ok:false as const,error:{code:'INTERNAL_ERROR' as const,message:'샘플 연결을 완료하지 못했습니다.',retryable:true}};}
  },
}),newsletter:Object.freeze({exportOutput:async(request:NewsletterExportRequest)=>{try{return await ipcRenderer.invoke('p2:newsletter:export',request);}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'출력 연결에 실패했습니다.',retryable:true}};}},saveJson:async(request:{readonly json:string})=>{try{return await ipcRenderer.invoke('p2:newsletter:save-json',request);}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'JSON 저장 연결을 완료하지 못했습니다.',retryable:true}};}}}),memo:Object.freeze({
  read:async()=>{try{return await ipcRenderer.invoke('p2:memo:read');}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'메모 연결을 완료하지 못했습니다.',retryable:true}};}},
  write:async(document:MemoDocument)=>{try{return await ipcRenderer.invoke('p2:memo:write',document);}catch{return {ok:false as const,error:{code:'STORAGE_ERROR' as const,message:'메모 연결을 완료하지 못했습니다.',retryable:true}};}},
})});
contextBridge.exposeInMainWorld('electronWork',work);
