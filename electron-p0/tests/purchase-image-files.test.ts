import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {crc32} from 'node:zlib';
import {imageDimensions} from '../main/purchase-image-files';
const png=readFileSync('electron-p0/tests/fixtures/purchase-image/synthetic-cart.png'),jpg=readFileSync('electron-p0/tests/fixtures/purchase-image/synthetic-cart.jpg');
function dimensions(width:number,height:number){const b=Buffer.from(png);b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);b.writeUInt32BE(crc32(b.subarray(12,29)),29);return b;}
it('validates actual PNG/JPEG signatures and dimensions',()=>{expect(imageDimensions(png)).toEqual({width:1800,height:750,format:'png'});expect(imageDimensions(jpg).format).toBe('jpeg');});
it('rejects spoofed, corrupt, truncated, tiny and oversized-pixel images before decoding',()=>{for(const b of [Buffer.alloc(100),png.subarray(0,40),Buffer.from('<svg/>'),Buffer.concat([png,Buffer.from('junk')]),dimensions(100,80),dimensions(8193,1000),dimensions(7000,7000),Buffer.alloc(10*1024*1024+1)])expect(()=>imageDimensions(b)).toThrow();const b=Buffer.from(png);b[40]^=1;expect(()=>imageDimensions(b)).toThrow();expect(()=>imageDimensions(jpg.subarray(0,jpg.length-2))).toThrow();});
