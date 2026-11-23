import {createPublicKey,verify} from 'node:crypto';

export type UpdateManifest = Readonly<{
  schema:1;
  channel:'beta'|'stable';
  version:string;
  notes:string;
  url:string;
  size:number;
  sha256:string;
  signature:string;
}>;

export type UpdateFeedConfig = Readonly<{
  enabled:boolean;
  channel:'beta'|'stable';
  manifestUrl:string;
  publicKeyPem:string;
}>;

const versionPattern=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const parseVersion=(value:string):{core:bigint[];pre:string[]}|null=>{
  if(value.length>80)return null;
  const match=versionPattern.exec(value);
  if(!match)return null;
  const pre=match[4]?.split('.')??[];
  if(pre.some(part=>/^\d+$/.test(part)&&part.length>1&&part.startsWith('0')))return null;
  return {core:match.slice(1,4).map(BigInt),pre};
};

export function compareUpdateVersions(left:string,right:string):number{
  const a=parseVersion(left),b=parseVersion(right);
  if(!a||!b)throw new Error('업데이트 버전 형식이 올바르지 않습니다.');
  for(let index=0;index<3;index++)if(a.core[index]!==b.core[index])return a.core[index]>b.core[index]?1:-1;
  if(!a.pre.length||!b.pre.length)return a.pre.length===b.pre.length?0:a.pre.length?-1:1;
  for(let index=0;index<Math.max(a.pre.length,b.pre.length);index++){
    const x=a.pre[index],y=b.pre[index];
    if(x===undefined||y===undefined)return x===undefined?-1:1;
    if(x===y)continue;
    const xn=/^\d+$/.test(x),yn=/^\d+$/.test(y);
    if(xn&&yn)return BigInt(x)>BigInt(y)?1:-1;
    if(xn!==yn)return xn?-1:1;
    return x<y?-1:1;
  }
  return 0;
}

export function validateUpdateFeed(input:unknown):UpdateFeedConfig|null{
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const item=input as Record<string,unknown>;
  if(item.enabled!==true)return null;
  if(item.channel!=='beta'&&item.channel!=='stable')return null;
  if(typeof item.manifestUrl!=='string'||typeof item.publicKeyPem!=='string')return null;
  try{
    const url=new URL(item.manifestUrl);
    if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.port&&url.port!=='443')return null;
    if(createPublicKey(item.publicKeyPem).asymmetricKeyType!=='ed25519')return null;
    return {enabled:true,channel:item.channel,manifestUrl:url.href,publicKeyPem:item.publicKeyPem};
  }catch{return null;}
}

export function verifyUpdateManifest(input:unknown,feed:UpdateFeedConfig,currentVersion:string):UpdateManifest{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('업데이트 정보 형식이 올바르지 않습니다.');
  const item=input as Record<string,unknown>;
  if(Object.keys(item).sort().join(',')!=='channel,notes,schema,sha256,signature,size,url,version'||item.schema!==1||item.channel!==feed.channel||typeof item.version!=='string'||typeof item.notes!=='string'||item.notes.length>2000||typeof item.url!=='string'||typeof item.size!=='number'||!Number.isSafeInteger(item.size)||item.size<1||item.size>1024*1024*1024||typeof item.sha256!=='string'||!(/^[a-fA-F0-9]{64}$/.test(item.sha256))||typeof item.signature!=='string')throw new Error('업데이트 정보 형식이 올바르지 않습니다.');
  let target:URL;try{target=new URL(item.url);}catch{throw new Error('허용되지 않은 업데이트 파일 주소입니다.');}
  const origin=new URL(feed.manifestUrl).origin;
  if(target.protocol!=='https:'||target.origin!==origin||target.username||target.password||target.search||target.hash||!target.pathname.endsWith('.exe'))throw new Error('허용되지 않은 업데이트 파일 주소입니다.');
  const payload=JSON.stringify([item.schema,item.channel,item.version,item.notes,item.url,item.size,item.sha256.toLowerCase()]);
  const signature=Buffer.from(item.signature,'base64');
  if(signature.length!==64||!verify(null,Buffer.from(payload),feed.publicKeyPem,signature))throw new Error('업데이트 서명을 확인하지 못했습니다.');
  if(compareUpdateVersions(item.version,currentVersion)<0)throw new Error('이전 버전으로 되돌릴 수 없습니다.');
  return {schema:1,channel:item.channel as 'beta'|'stable',version:item.version,notes:item.notes,url:item.url,size:item.size,sha256:item.sha256.toLowerCase(),signature:item.signature};
}
