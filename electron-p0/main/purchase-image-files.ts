import {IMAGE_IMPORT_LIMITS as LIMIT} from '../purchase-image-protocol.js';
const invalid=()=>{throw Error('PNG/JPEG 형식·이미지 크기 또는 손상 여부를 확인해 주세요.');};
function crc(bytes:Buffer){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
export function imageDimensions(bytes:Buffer):{width:number;height:number;format:'png'|'jpeg'}{
 if(bytes.length>LIMIT.bytes||bytes.length<24)return invalid();
 let width=0,height=0,format:'png'|'jpeg';
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  format='png';let offset=8,header=false,end=false,data=false;
  while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),kind=bytes.toString('ascii',offset+4,offset+8);if(length>LIMIT.bytes||offset+12+length>bytes.length)return invalid();
   if(crc(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))return invalid();
   if(!header){if(kind!=='IHDR'||length!==13)return invalid();width=bytes.readUInt32BE(offset+8);height=bytes.readUInt32BE(offset+12);header=true;}
   else if(kind==='IHDR'||kind==='acTL')return invalid();
   if(kind==='IDAT')data=true;offset+=length+12;if(kind==='IEND'){end=length===0&&offset===bytes.length;break;}
  }
  if(!header||!end||!data)return invalid();
 }else if(bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217){
  format='jpeg';let i=2;
  while(i<bytes.length-2){if(bytes[i++]!==255)return invalid();while(bytes[i]===255)i++;const tag=bytes[i++];if(tag===0xda)break;if(tag===0xd8||tag===0xd9||(tag>=0xd0&&tag<=0xd7))continue;if(i+2>bytes.length)return invalid();const size=bytes.readUInt16BE(i);if(size<2||i+size>bytes.length)return invalid();
   if([0xc0,0xc1,0xc2].includes(tag)){if(size<8)return invalid();height=bytes.readUInt16BE(i+3);width=bytes.readUInt16BE(i+5);break;}i+=size;
  }
 }else return invalid();
 if(width<LIMIT.minWidth||height<LIMIT.minHeight||width>LIMIT.dimension||height>LIMIT.dimension||width*height>LIMIT.pixels)return invalid();
 return {width,height,format};
}
