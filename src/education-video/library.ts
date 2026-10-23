import {invoke,isTauri} from '@tauri-apps/api/core';
import {FinderInputError} from './model';
import {parseLibraryV2,mergeLibraryV2,type LibraryEntry,type LibraryV2,type ProviderData} from './libraryV2';
export {parseLibrary,mergeLibrary} from './legacyLibrary';
const browserKey='bogunon.education-video.browser-qa.v2';
const legacyKey='bogunon.education-video.browser-qa.v1';
const emptyLibrary:LibraryV2={version:2,entries:[]};
export type LoadedLibrary={readonly library:LibraryV2;readonly recovered:boolean};
export const nativeLibrary=isTauri();
const parseLoaded=(value:unknown):LoadedLibrary=>{
 if(typeof value!=='object'||value===null||!('library'in value)||!('recovered'in value)||typeof value.recovered!=='boolean')throw new FinderInputError('라이브러리 응답을 확인하지 못했습니다.');
 return {library:parseLibraryV2(JSON.stringify(value.library)),recovered:value.recovered};
};
const readBrowser=():LibraryV2=>{
 const backup=localStorage.getItem(`${browserKey}.backup`);
 if(backup){try{localStorage.setItem(`${browserKey}.backup`,JSON.stringify(parseLibraryV2(backup)));}catch(error){if(!(error instanceof FinderInputError))throw error;}}
 const json=localStorage.getItem(browserKey);if(json){const library=parseLibraryV2(json);localStorage.setItem(browserKey,JSON.stringify(library));return library;}
 const legacy=localStorage.getItem(legacyKey);if(!legacy)return emptyLibrary;
 const migrated=parseLibraryV2(legacy);
 if(localStorage.getItem(`${browserKey}.v1-backup`)===null)localStorage.setItem(`${browserKey}.v1-backup`,legacy);
 localStorage.setItem(browserKey,JSON.stringify(migrated));return migrated;
};
const persistBrowser=(library:LibraryV2,purgeVideoId?:string):LoadedLibrary=>{
 const normalized=parseLibraryV2(JSON.stringify(library));const previous=localStorage.getItem(browserKey);
 if(previous){const sanitized=parseLibraryV2(previous);const snapshot=purgeVideoId?{version:2,entries:sanitized.entries.map(entry=>entry.videoId===purgeVideoId?{...entry,provider:null,ai:undefined}:entry)}:sanitized;localStorage.setItem(`${browserKey}.backup`,JSON.stringify(snapshot));}
 localStorage.setItem(browserKey,JSON.stringify(normalized));return {library:normalized,recovered:false};
};
export const libraryRepository={
 load:async():Promise<LoadedLibrary>=>nativeLibrary?parseLoaded(await invoke<unknown>('education_video_library_load')):{library:readBrowser(),recovered:false},
 save:async(entry:LibraryEntry):Promise<LoadedLibrary>=>{
  if(nativeLibrary)return parseLoaded(await invoke<unknown>('education_video_library_save',{entry}));
  const current=readBrowser();const previous=current.entries.find(row=>row.videoId===entry.videoId);const saved={...entry,...(entry.ai===undefined&&previous?.ai?{ai:previous.ai}:{}),...(entry.candidateRecord===undefined&&previous?.candidateRecord?{candidateRecord:previous.candidateRecord}:{}),...(entry.recommendationReason===undefined&&previous?.recommendationReason?{recommendationReason:previous.recommendationReason}:{})};return persistBrowser({version:2,entries:[...current.entries.filter(row=>row.videoId!==entry.videoId),saved]});
 },
 import:async(json:string):Promise<LoadedLibrary>=>{
  const incoming=parseLibraryV2(json);
  return nativeLibrary?parseLoaded(await invoke<unknown>('education_video_library_import',{json:JSON.stringify(incoming)})):persistBrowser(mergeLibraryV2(readBrowser(),incoming));
 },
 export:async():Promise<string>=>nativeLibrary?JSON.stringify(parseLibraryV2(await invoke<string>('education_video_library_export')),null,2):JSON.stringify(readBrowser(),null,2),
 recover:async():Promise<LoadedLibrary>=>{
  if(nativeLibrary)return parseLoaded(await invoke<unknown>('education_video_library_recover'));
  const backup=localStorage.getItem(`${browserKey}.backup`);if(!backup)throw new FinderInputError('복구할 백업이 없습니다.');
  const library=parseLibraryV2(backup);localStorage.setItem(browserKey,JSON.stringify(library));return {library,recovered:true};
 },
 deleteMetadata:async(videoId:string):Promise<LoadedLibrary>=>nativeLibrary?parseLoaded(await invoke<unknown>('education_video_library_metadata_delete',{videoId})):persistBrowser({version:2,entries:readBrowser().entries.map(entry=>entry.videoId===videoId?{...entry,provider:null,ai:undefined}:entry)},videoId),
 refreshMetadata:async(videoId:string,provider:ProviderData):Promise<LoadedLibrary>=>nativeLibrary?parseLoaded(await invoke<unknown>('education_video_library_metadata_refresh',{videoId,provider})):persistBrowser({version:2,entries:readBrowser().entries.map(entry=>entry.videoId===videoId?{...entry,provider}:entry)}),
};
