import {isIP} from 'node:net';
import {SettingsStore} from './settings.js';
import type {OnlineHealthRoomSettings,OnlineHealthRoomOpenResult} from '../online-health-room-protocol.js';

export const defaultOnlineHealthRoomSettings=():OnlineHealthRoomSettings=>({enabled:false,url:''});

export function safeOnlineHealthRoomUrl(value:unknown):string{
  if(typeof value!=='string'||value.length>2048||value!==value.trim()||/[\u0000-\u0020\u007f\\]/.test(value)||/%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i.test(value))throw Error('공개 HTTPS 주소를 입력해 주세요. 공백·제어문자·인코딩된 경로 구분자는 사용할 수 없습니다.');
  let url:URL;try{url=new URL(value);}catch{throw Error('올바른 HTTPS 주소를 입력해 주세요.');}
  const hostname=url.hostname;
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||!hostname.includes('.')||hostname.length>253||isIP(hostname)!==0||/(?:^|\.)(?:localhost|local|internal|lan)$/.test(hostname)||hostname.split('.').some(label=>!/^([a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/.test(label))||!/^[a-z]{2,}$/.test(hostname.split('.').at(-1)??''))throw Error('공개 도메인의 HTTPS 주소만 사용할 수 있습니다. 로그인 정보·검색 매개변수·로컬 주소는 저장하지 않습니다.');
  return url.href;
}

export function validateOnlineHealthRoomSettings(value:unknown):OnlineHealthRoomSettings{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('온라인 보건실 설정 형식을 확인해 주세요.');
  const input=value as Record<string,unknown>;
  if(Object.keys(input).sort().join(',')!=='enabled,url'||typeof input.enabled!=='boolean'||typeof input.url!=='string')throw Error('온라인 보건실 사용 여부와 HTTPS 주소를 확인해 주세요.');
  return {enabled:input.enabled,url:input.url===''?'':safeOnlineHealthRoomUrl(input.url)};
}

export class OnlineHealthRoomService{
  constructor(private readonly store:Pick<SettingsStore<OnlineHealthRoomSettings>,'read'|'write'>,private readonly openExternal:(url:string)=>Promise<void>){}
  async read():Promise<OnlineHealthRoomSettings>{return await this.store.read()??defaultOnlineHealthRoomSettings();}
  async save(value:unknown):Promise<OnlineHealthRoomSettings>{const next=validateOnlineHealthRoomSettings(value);await this.store.write(next);return next;}
  async test(value:unknown):Promise<void>{await this.openExternal(safeOnlineHealthRoomUrl(value));}
  async open():Promise<OnlineHealthRoomOpenResult>{const settings=await this.read();if(!settings.enabled)return 'disabled';if(!settings.url)return 'needs-configuration';await this.openExternal(safeOnlineHealthRoomUrl(settings.url));return 'opened';}
}
