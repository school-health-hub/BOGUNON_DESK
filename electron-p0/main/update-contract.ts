import {createPublicKey,verify} from 'node:crypto';

export type UpdateManifest = Readonly<{
  schema:1|2;
  channel:'beta'|'stable';
  version:string;
  notes:string;
  url:string;
  size:number;
  sha256:string;
  signature:string;
  issuedAt?:string;
  expiresAt?:string;
}>;

export type UpdateFeedConfig = Readonly<{
  enabled:boolean;
  channel:'beta'|'stable';
  manifestUrl:string;
  publicKeyPem:string;
  nextPublicKeyPem?:string;
  publisherSubject?:string;
}>;

const versionPattern=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const githubFeedPath=/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/releases\/download\/updates-(beta|stable)\/bogunon-update\.json$/;
export function githubUpdateRepository(feed:UpdateFeedConfig):Readonly<{owner:string;repo:string}>|null{
  const url=new URL(feed.manifestUrl);
  if(url.hostname!=='github.com')return null;
  const match=githubFeedPath.exec(url.pathname);
  return match?{owner:match[1],repo:match[2]}:null;
}
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
  if(item.nextPublicKeyPem!==undefined&&typeof item.nextPublicKeyPem!=='string')return null;
  if(item.publisherSubject!==undefined&&(typeof item.publisherSubject!=='string'||!/^CN=[^\r\n\u0000-\u001f]{3,250}$/.test(item.publisherSubject)))return null;
  try{
    const url=new URL(item.manifestUrl);
    if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.port&&url.port!=='443')return null;
    if(url.hostname==='github.com'&&(!githubFeedPath.test(url.pathname)||!url.pathname.includes(`/updates-${item.channel}/`)))return null;
    if(createPublicKey(item.publicKeyPem).asymmetricKeyType!=='ed25519')return null;
    if(typeof item.nextPublicKeyPem==='string'&&(item.nextPublicKeyPem===item.publicKeyPem||createPublicKey(item.nextPublicKeyPem).asymmetricKeyType!=='ed25519'))return null;
    return {enabled:true,channel:item.channel,manifestUrl:url.href,publicKeyPem:item.publicKeyPem,...(typeof item.nextPublicKeyPem==='string'?{nextPublicKeyPem:item.nextPublicKeyPem}:{}),...(typeof item.publisherSubject==='string'?{publisherSubject:item.publisherSubject}:{})};
  }catch{return null;}
}

export function verifyUpdateManifest(input:unknown,feed:UpdateFeedConfig,currentVersion:string):UpdateManifest{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('업데이트 정보 형식이 올바르지 않습니다.');
  const item=input as Record<string,unknown>;
  const v2=item.schema===2;
  const keys=Object.keys(item).sort().join(',');
  if((v2?keys!=='channel,expiresAt,issuedAt,notes,schema,sha256,signature,size,url,version':keys!=='channel,notes,schema,sha256,signature,size,url,version')||item.schema!==1&&item.schema!==2||item.channel!==feed.channel||typeof item.version!=='string'||typeof item.notes!=='string'||item.notes.length>2000||typeof item.url!=='string'||typeof item.size!=='number'||!Number.isSafeInteger(item.size)||item.size<1||item.size>1024*1024*1024||typeof item.sha256!=='string'||!(/^[a-fA-F0-9]{64}$/.test(item.sha256))||typeof item.signature!=='string')throw new Error('업데이트 정보 형식이 올바르지 않습니다.');
  if(v2){
    const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    if(typeof item.issuedAt!=='string'||typeof item.expiresAt!=='string'||!iso.test(item.issuedAt)||!iso.test(item.expiresAt))throw new Error('업데이트 유효 기간 형식이 올바르지 않습니다.');
    const issued=Date.parse(item.issuedAt),expires=Date.parse(item.expiresAt),now=Date.now();
    if(!Number.isFinite(issued)||!Number.isFinite(expires)||expires<=issued||expires-issued>30*24*60*60*1000||issued>now+5*60*1000||expires<=now)throw new Error('업데이트 정보가 만료됐거나 발행 시간이 올바르지 않습니다.');
  }
  let target:URL;try{target=new URL(item.url);}catch{throw new Error('허용되지 않은 업데이트 파일 주소입니다.');}
  const origin=new URL(feed.manifestUrl).origin;
  if(target.protocol!=='https:'||target.origin!==origin||target.username||target.password||target.search||target.hash||!target.pathname.endsWith('.exe'))throw new Error('허용되지 않은 업데이트 파일 주소입니다.');
  const github=githubUpdateRepository(feed);
  if(github&&target.pathname!==`/${github.owner}/${github.repo}/releases/download/v${item.version}/BOGUNON-DESK-Setup-${item.version}-x64.exe`)throw new Error('허용되지 않은 업데이트 파일 주소입니다.');
  const payload=JSON.stringify([item.schema,item.channel,item.version,item.notes,item.url,item.size,item.sha256.toLowerCase(),...(v2?[item.issuedAt,item.expiresAt]:[])]);
  const signature=Buffer.from(item.signature,'base64');
  if(signature.length!==64||![feed.publicKeyPem,feed.nextPublicKeyPem].filter((key):key is string=>typeof key==='string').some(key=>verify(null,Buffer.from(payload),key,signature)))throw new Error('업데이트 서명을 확인하지 못했습니다.');
  if(compareUpdateVersions(item.version,currentVersion)<0)throw new Error('이전 버전으로 되돌릴 수 없습니다.');
  return {schema:item.schema,channel:item.channel as 'beta'|'stable',version:item.version,notes:item.notes,url:item.url,size:item.size,sha256:item.sha256.toLowerCase(),signature:item.signature,...(v2?{issuedAt:item.issuedAt as string,expiresAt:item.expiresAt as string}:{})};
}
