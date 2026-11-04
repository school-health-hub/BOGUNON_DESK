import {access,lstat,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,join,parse,resolve,win32,isAbsolute,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {StoredWorkFolder,WorkFoldersDocument} from '../work-folders-protocol.js';
import {SettingsStore} from './settings.js';

export class FolderError extends Error{constructor(readonly code:'INVALID_INPUT'|'STORAGE_ERROR'|'CONFLICT'|'NOT_FOUND'|'FORBIDDEN'|'INTERNAL_ERROR',message:string){super(message);}}
export const folderId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,96}$/.test(v);
export function folderName(value:unknown):string{
 if(typeof value!=='string'||!value.trim()||[...value.trim()].length>40||/[\u0000-\u001f\u007f]/.test(value))throw new FolderError('INVALID_INPUT','폴더 이름은 1~40자로 입력해 주세요.');
 return value.trim();
}
// No shell namespace, device, UNC or shortcut path. Windows is validated independently of the host OS.
export function localFolderPath(value:unknown,platform=process.platform):string{
 if(typeof value!=='string'||!value||value.length>2048||/[\u0000-\u001f\u007f]/.test(value))throw new FolderError('INVALID_INPUT','로컬 폴더 경로를 확인해 주세요.');
 if(platform==='win32'){
  if(!/^[A-Za-z]:\\/.test(value)||value.includes('/')||value.slice(2).includes(':')||value.split('\\').slice(1).some(p=>p==='.'||p==='..'||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||win32.normalize(value)!==value)throw new FolderError('FORBIDDEN','UNC·네트워크 공유·장치·특수 경로는 등록할 수 없습니다.');
 }else if(!isAbsolute(value)||value.startsWith('//')||resolve(value)!==value||value.includes('\\'))throw new FolderError('FORBIDDEN','일반 로컬 폴더만 등록할 수 있습니다.');
 if(/\.(lnk|url)$/i.test(value))throw new FolderError('FORBIDDEN','바로가기 대신 실제 로컬 폴더를 선택해 주세요.');
 return value;
}
export async function inspectLocalFolder(value:string):Promise<string>{
 const path=localFolderPath(value);
 try{
  for(let p=path;;p=dirname(p)){
   const s=await lstat(p);if(s.isSymbolicLink()||!s.isDirectory())throw new FolderError('FORBIDDEN','일반 폴더만 열 수 있습니다. 링크·junction·파일은 지원하지 않습니다.');
   if(p===parse(p).root)break;
  }
  await access(path,constants.R_OK|constants.X_OK);
  const canonical=localFolderPath(await realpath(path));
  const key=(s:string)=>process.platform==='win32'?s.toLowerCase():s;
  if(key(canonical)!==key(path))throw new FolderError('FORBIDDEN','폴더 경로가 변경됐습니다. 실제 폴더를 다시 등록해 주세요.');
  return canonical;
 }catch(e){if(e instanceof FolderError)throw e;const code=(e as NodeJS.ErrnoException).code;throw new FolderError(code==='ENOENT'||code==='ENOTDIR'?'NOT_FOUND':'FORBIDDEN',code==='ENOENT'||code==='ENOTDIR'?'폴더를 찾을 수 없습니다. 이동·삭제 또는 외장 드라이브 연결을 확인해 주세요.':'폴더 접근이 거부됐습니다. 권한과 로컬 드라이브 연결을 확인해 주세요.');}
}
export function validateWorkFolders(value:unknown):WorkFoldersDocument{
 const bad=()=>{throw new FolderError('STORAGE_ERROR','업무 폴더 저장 형식·버전을 읽지 못했습니다. 원본을 보존합니다.');};
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();const d=value as WorkFoldersDocument;
 if(Object.keys(d).sort().join(',')!=='favorites,revision,version'||d.version!==1||!Number.isSafeInteger(d.revision)||d.revision<0||d.revision>=Number.MAX_SAFE_INTEGER||!Array.isArray(d.favorites)||d.favorites.length>12||Buffer.byteLength(JSON.stringify(d))>65536)return bad();
 const ids=new Set<string>(),paths=new Set<string>();
 for(const f of d.favorites){
  if(!f||typeof f!=='object'||Object.keys(f).sort().join(',')!=='id,name,path'||!folderId(f.id)||ids.has(f.id))return bad();
  try{if(folderName(f.name)!==f.name) return bad();localFolderPath(f.path);}catch{return bad();}
  const key=process.platform==='win32'?f.path.toLowerCase():f.path;if(paths.has(key))return bad();ids.add(f.id);paths.add(key);
 }
 return structuredClone(d);
}
export class WorkFoldersStore{
 private queue:Promise<void>=Promise.resolve();
 private primary:SettingsStore<WorkFoldersDocument>;private backup:SettingsStore<WorkFoldersDocument>;
 constructor(private readonly root:string,private readonly writePrimary?:(d:WorkFoldersDocument)=>Promise<void>){this.primary=new SettingsStore(root,'favorites.json',validateWorkFolders);this.backup=new SettingsStore(root,'favorites.backup.json',validateWorkFolders);}
 private async safe(){
  for(let p=this.root;p!==parse(p).root;p=dirname(p)){try{const s=await lstat(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new FolderError('STORAGE_ERROR','업무 폴더 저장 위치를 안전하게 사용할 수 없습니다.');}}
  for(const name of ['favorites.json','favorites.backup.json']){try{const s=await lstat(join(this.root,name));if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new FolderError('STORAGE_ERROR','업무 폴더 저장 파일을 안전하게 사용할 수 없습니다.');}}
 }
 async load(){
  await this.safe();
  try{const d=await this.primary.read();if(d)return {document:d,recovered:false};const backup=await this.backup.read();return backup?{document:backup,recovered:true}:{document:{version:1 as const,revision:0,favorites:[]},recovered:false};}
  catch{const backup=await this.backup.read();if(backup)return {document:backup,recovered:true};throw new FolderError('STORAGE_ERROR','업무 폴더 파일이 손상됐거나 지원하지 않는 버전입니다. 원본을 보존합니다.');}
 }
 mutate(revision:number,change:(folders:readonly StoredWorkFolder[])=>Promise<readonly StoredWorkFolder[]>|readonly StoredWorkFolder[]){
  const pending=this.queue.then(async()=>{
   const current=await this.load();if(current.recovered)throw new FolderError('STORAGE_ERROR','백업을 읽기 전용으로 표시합니다. 원본을 덮어쓰지 않습니다.');
   if(current.document.revision!==revision)throw new FolderError('CONFLICT','업무 폴더가 변경됐습니다. 다시 불러온 뒤 확인해 주세요.');
   const next=validateWorkFolders({...current.document,revision:revision+1,favorites:await change(current.document.favorites)});
   if(current.document.revision>0)await this.backup.write(current.document);
   await (this.writePrimary?this.writePrimary(next):this.primary.write(next));return {document:next,recovered:false};
  });this.queue=pending.then(()=>{},()=>{});return pending;
 }
 flush(){return this.queue;}
}
export const newFolder=(path:string):StoredWorkFolder=>({id:`folder-${randomUUID()}`,name:folderName(basename(path)),path});
export const displayFolderPath=(path:string)=>{const parts=path.split(/[\\/]/).filter(Boolean);return parts.length<=3?path:`…${process.platform==='win32'?'\\':'/'}${parts.slice(-3).join(process.platform==='win32'?'\\':'/')}`;};
