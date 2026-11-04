import {constants} from 'node:fs';import {lstat,open,realpath} from 'node:fs/promises';import {basename,dirname,extname,parse} from 'node:path';import {createHash} from 'node:crypto';
import {localFolderPath} from './work-folders.js';
import {inflateRawSync} from 'node:zlib';
import type {DropKind} from '../file-drop-protocol.js';
const formats=new Set(['csv','xls','xlsx','pdf','png','jpg','jpeg','odt','hwpx','hwp','docx']);
export type DropStamp=Readonly<{dev:number;ino:number;size:number;mtime:number;ctime:number;prefix:string}>;
export const sameStamp=(a:DropStamp,b:DropStamp)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtime===b.mtime&&a.ctime===b.ctime&&a.prefix===b.prefix;
/** Bounded metadata probe only: no extraction, document parser, image decoder or OCR. */
export async function probeDropFile(path:string):Promise<{name:string;kind:DropKind;stamp:DropStamp}>{
 localFolderPath(path);const name=basename(path),kind=extname(path).slice(1).toLowerCase() as DropKind;
 if(!formats.has(kind)||!name||name.length>200||/[\x00-\x1f\x7f\\:]/.test(name))throw Error('지원하지 않는 파일 이름·형식입니다.');
 for(let p=dirname(path);;p=dirname(p)){const s=await lstat(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('폴더 링크는 지원하지 않습니다.');if(p===parse(p).root)break;}
 const canonical=localFolderPath(await realpath(path));if(process.platform==='win32'?canonical.toLowerCase()!==path.toLowerCase():canonical!==path)throw Error('변경된 경로는 다시 선택해 주세요.');
 const selected=await lstat(path),limit=['png','jpg','jpeg'].includes(kind)?10*1024*1024:15*1024*1024;
 if(!selected.isFile()||selected.isSymbolicLink()||selected.nlink!==1||selected.size<1||selected.size>limit)throw Error('일반 파일·크기 제한을 확인해 주세요.');
 const f=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{
  const before=await f.stat();if(before.dev!==selected.dev||before.ino!==selected.ino||before.size!==selected.size)throw Error('변경된 파일입니다.');
  const read=async(offset:number,length:number)=>{if(offset<0||offset+length>before.size)throw Error('손상 파일입니다.');const b=Buffer.alloc(length);const {bytesRead}=await f.read(b,0,length,offset);if(bytesRead!==length)throw Error('파일을 읽지 못했습니다.');return b;};
  const head=await read(0,Math.min(65536,before.size));
  if(kind==='pdf'){if(head.toString('ascii',0,5)!=='%PDF-')throw Error('PDF 형식이 아닙니다.');}
  else if(['xlsx','hwpx','docx','odt'].includes(kind)){
   if(head.readUInt32LE(0)!==0x04034b50)throw Error('문서 압축 형식이 아닙니다.');
   const tail=await read(Math.max(0,before.size-65557),Math.min(65557,before.size));let e=-1;
   for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){e=i;break;}
   if(e<0||tail.readUInt16LE(e+4)||tail.readUInt16LE(e+6))throw Error('ZIP 형식을 확인해 주세요.');
   const count=tail.readUInt16LE(e+10),size=tail.readUInt32LE(e+12),offset=tail.readUInt32LE(e+16);
   if(!count||count>1024||size>256*1024||offset+size>before.size-22)throw Error('압축 문서 제한을 초과했습니다.');
   const directory=await read(offset,size),names=new Set<string>();let i=0,total=0,mime='';
   for(let n=0;n<count;n++){
    if(i+46>size||directory.readUInt32LE(i)!==0x02014b50||directory.readUInt16LE(i+8)&1)throw Error('암호화·손상 문서는 지원하지 않습니다.');
    const length=directory.readUInt16LE(i+28),extra=directory.readUInt16LE(i+30),comment=directory.readUInt16LE(i+32);if(i+46+length+extra+comment>size)throw Error();
    const entry=directory.toString('utf8',i+46,i+46+length);if(/(^\/|\\|\0|(^|\/)\.\.(\/|$)|:)/.test(entry)||names.has(entry))throw Error('안전하지 않은 압축 경로입니다.');
    if(kind==='odt'&&entry==='mimetype'){
     const compressed=directory.readUInt32LE(i+20),local=directory.readUInt32LE(i+42),method=directory.readUInt16LE(i+10);if(compressed>256||directory.readUInt32LE(i+24)>256||![0,8].includes(method))throw Error();const header=await read(local,30);if(header.readUInt32LE(0)!==0x04034b50)throw Error();const bytes=await read(local+30+header.readUInt16LE(26)+header.readUInt16LE(28),compressed);mime=(method===0?bytes:inflateRawSync(bytes,{maxOutputLength:256})).toString('ascii');
    }
    names.add(entry);total+=directory.readUInt32LE(i+24);if(total>50*1024*1024)throw Error('압축 해제 크기 제한을 초과했습니다.');i+=46+length+extra+comment;
   }
   const required=kind==='xlsx'?'xl/workbook.xml':kind==='docx'?'word/document.xml':kind==='hwpx'?'Contents/section0.xml':'content.xml';
   if(i!==size||!names.has(required)||(kind==='odt'&&mime!=='application/vnd.oasis.opendocument.text'))throw Error('확장자와 실제 문서 종류가 다릅니다.');
  }else if(kind==='hwp'||kind==='xls'){
   if(!head.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex')))throw Error('문서 형식이 아닙니다.');
   const shift=head.readUInt16LE(30);if(shift!==9&&shift!==12)throw Error();const sector=1<<shift,names:string[]=[],seen=new Set<number>();let index=head.readUInt32LE(48);
   for(let n=0;n<16&&index!==0xfffffffe;n++){
    if(seen.has(index))throw Error();seen.add(index);const dir=await read((index+1)*sector,sector);
    for(let i=0;i+128<=dir.length;i+=128){const length=dir.readUInt16LE(i+64);if(length>=2&&length<=64)names.push(dir.toString('utf16le',i,i+length-2));}
    const fatIndex=Math.floor(index/(sector/4));if(fatIndex>=109)throw Error('문서 디렉터리 제한을 초과했습니다.');const fat=head.readUInt32LE(76+fatIndex*4),entry=await read((fat+1)*sector+(index%(sector/4))*4,4);index=entry.readUInt32LE(0);
   }
   if(!(kind==='hwp'?names.includes('FileHeader'):names.includes('Workbook')||names.includes('Book')))throw Error('확장자와 실제 문서 종류가 다릅니다.');
  }else if(kind==='csv'){
   let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(head,{stream:true});}catch{text=new TextDecoder('euc-kr',{fatal:true}).decode(head,{stream:true});}
   if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))throw Error('텍스트 CSV가 아닙니다.');
  }else{
   if(kind==='png'){if(!head.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))||head.toString('ascii',12,16)!=='IHDR')throw Error('PNG 형식이 아닙니다.');const w=head.readUInt32BE(16),h=head.readUInt32BE(20);if(w<256||h<128||w>8192||h>8192||w*h>12000000)throw Error('이미지 크기 제한을 확인해 주세요.');}
   else{
    if(head[0]!==255||head[1]!==216||head[2]!==255||!(await read(before.size-2,2)).equals(Buffer.from([255,217])))throw Error('JPEG 형식이 아닙니다.');
    let i=2,width=0,height=0;
    while(i<head.length-4){if(head[i++]!==255)throw Error();while(head[i]===255)i++;const tag=head[i++];if(tag===0xda)break;if(tag===0xd8||tag===0xd9||tag>=0xd0&&tag<=0xd7)continue;const size=head.readUInt16BE(i);if(size<2||i+size>head.length)throw Error('JPEG 헤더 제한을 초과했습니다.');if([0xc0,0xc1,0xc2].includes(tag)){height=head.readUInt16BE(i+3);width=head.readUInt16BE(i+5);break;}i+=size;}
    if(width<256||height<128||width>8192||height>8192||width*height>12000000)throw Error('이미지 크기 제한을 확인해 주세요.');
   }
  }
  const after=await f.stat();if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw Error('확인 중 파일이 변경됐습니다.');
  return {name,kind,stamp:{dev:before.dev,ino:before.ino,size:before.size,mtime:before.mtimeMs,ctime:before.ctimeMs,prefix:createHash('sha256').update(head).digest('hex')}};
 }finally{await f.close();}
}
