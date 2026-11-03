import {replaceSettingsFile} from './settings.js';
import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {InventoryDocument} from '../protocol.js';

const MAX_BYTES=2*1024*1024,record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const keys=(value:Record<string,unknown>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key));
const text=(value:unknown,max=200)=>typeof value==='string'&&value.length>0&&value.length<=max&&!value.includes('\0');
const date=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
export function validateInventoryDocument(value:unknown):InventoryDocument{
 if(!record(value)||!keys(value,['version','updatedAt','items','lots','movements'])||value.version!==1||!text(value.updatedAt)||!Array.isArray(value.items)||!Array.isArray(value.lots)||!Array.isArray(value.movements)||value.items.length>500||value.lots.length>5000||value.movements.length>10000)throw Error('Invalid inventory document');
 const ids=new Set<string>();for(const item of value.items){if(!record(item)||!keys(item,['itemId','name','baseUnit','recommendedStock'])||!text(item.itemId)||!text(item.name)||!text(item.baseUnit,30)||typeof item.recommendedStock!=='number'||!Number.isSafeInteger(item.recommendedStock)||item.recommendedStock<0||ids.has(item.itemId as string))throw Error('Invalid inventory item');ids.add(item.itemId as string);}
 const lotIds=new Set<string>();for(const lot of value.lots){if(!record(lot)||!keys(lot,['lotId','itemId','balance','expirationDate','status'])||!text(lot.lotId)||lotIds.has(lot.lotId as string)||!text(lot.itemId)||!ids.has(lot.itemId as string)||typeof lot.balance!=='number'||!Number.isSafeInteger(lot.balance)||lot.balance<0||!date(lot.expirationDate)||!['usable','quarantined'].includes(String(lot.status)))throw Error('Invalid inventory lot');lotIds.add(lot.lotId as string);}
 for(const itemId of ids){if(!Number.isSafeInteger(value.lots.filter(l=>l.itemId===itemId).reduce((sum,l)=>sum+l.balance,0)))throw Error('Inventory stock overflow');}
 const movementIds=new Set<string>();for(const movement of value.movements){if(!record(movement)||!keys(movement,['movementId','kind','itemId','quantity','reason','createdAt','expirationDate'])||!text(movement.movementId)||movementIds.has(movement.movementId as string)||!ids.has(String(movement.itemId))||!['receive','use','dispose'].includes(String(movement.kind))||typeof movement.quantity!=='number'||!Number.isSafeInteger(movement.quantity)||movement.quantity<=0||!text(movement.reason,500)||!text(movement.createdAt)||Number.isNaN(Date.parse(String(movement.createdAt)))||(movement.expirationDate!==undefined&&!date(movement.expirationDate)))throw Error('Invalid inventory movement');movementIds.add(movement.movementId as string);}
 const safe=structuredClone(value) as InventoryDocument;if(Buffer.byteLength(JSON.stringify(safe))>MAX_BYTES)throw Error('Oversized inventory document');return safe;
}
export class InventoryConflict extends Error{}
export class InventoryStore{
 private queue:Promise<void>=Promise.resolve();constructor(private readonly root:string,private readonly commit:(temp:string,target:string)=>Promise<void>=replaceSettingsFile){}
 private path(name:string){return join(this.root,name)}
 private async read(name:string){const bytes=await readFile(this.path(name));if(bytes.length>MAX_BYTES)throw Error('Oversized inventory document');return validateInventoryDocument(JSON.parse(bytes.toString('utf8')));}
 async load():Promise<{document:InventoryDocument|null;recovered:boolean}>{try{return {document:await this.read('inventory.json'),recovered:false};}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'){try{return {document:await this.read('inventory.backup.json'),recovered:true};}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {document:null,recovered:false};throw Error('Inventory backup unreadable');}}try{return {document:await this.read('inventory.backup.json'),recovered:true};}catch{throw Error('Inventory could not be read; original files preserved');}}}
 private async write(name:string,document:InventoryDocument){await mkdir(this.root,{recursive:true,mode:0o700});const temp=this.path(`${name}-${randomUUID()}.tmp`);try{const file=await open(temp,'wx',0o600);try{await file.writeFile(JSON.stringify(document));await file.sync();}finally{await file.close()}await this.commit(temp,this.path(name));}catch{await unlink(temp).catch(()=>{});throw Error('Inventory was not saved');}}
 save(value:unknown,expectedUpdatedAt?:string|null){const document=validateInventoryDocument(value);if(expectedUpdatedAt!==undefined&&expectedUpdatedAt!==null&&!text(expectedUpdatedAt))throw Error('Invalid inventory revision');
  const operation=this.queue.then(async()=>{const current=await this.load();if(current.recovered)throw Error('Recovered inventory is read only');
   if(expectedUpdatedAt!==undefined&&(current.document?.updatedAt??null)!==expectedUpdatedAt)throw new InventoryConflict();
   if(expectedUpdatedAt!==undefined&&current.document){const before=current.document.movements;if(document.movements.length<before.length||before.some((m,i)=>Object.keys({...m,...document.movements[i]}).some(key=>m[key as keyof typeof m]!==document.movements[i][key as keyof typeof m])))throw Error('Inventory history is append only');}
   const next=expectedUpdatedAt===undefined?document:{...document,updatedAt:new Date(Math.max(Date.now(),(Date.parse(current.document?.updatedAt??'')||0)+1)).toISOString()};
   if(current.document)await this.write('inventory.backup.json',current.document);await this.write('inventory.json',next);return {document:next,recovered:false as const};});this.queue=operation.then(()=>{},()=>{});return operation;}
 flush(){return this.queue;}
}
