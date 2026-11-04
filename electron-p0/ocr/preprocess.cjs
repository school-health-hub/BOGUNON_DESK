'use strict';
const {PNG}=require('./node_modules/pngjs');
const DEFAULT={rotation:0,enhance:false,layout:'block'};
function options(value=DEFAULT){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='enhance,layout,rotation'||![0,90,180,270].includes(value.rotation)||typeof value.enhance!=='boolean'||!['block','sparse'].includes(value.layout))throw Error('Invalid OCR settings');
 return {rotation:value.rotation,enhance:value.enhance,layout:value.layout};
}
function prepare(bytes,input){
 const setting=options(input),width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){if(setting.rotation||setting.enhance)throw Error('Preprocessing requires owned normalized PNG');return {bytes,map:b=>b};}
 if(width<1||height<1||width>8192||height>8192||width*height>12_000_000)throw Error('Image bounds');
 if(!setting.rotation&&!setting.enhance)return {bytes,map:b=>b};
 const source=PNG.sync.read(bytes,{checkCRC:true}),rotatedWidth=setting.rotation%180?height:width,rotatedHeight=setting.rotation%180?width:height;
 const scale=setting.enhance&&rotatedWidth*rotatedHeight<=3_000_000&&Math.max(rotatedWidth,rotatedHeight)<=4096?2:1;
 const w=rotatedWidth*scale,h=rotatedHeight*scale,out=new PNG({width:w,height:h}),hist=new Uint32Array(256);
 let low=0,high=255;
 if(setting.enhance){for(let i=0;i<source.data.length;i+=4){const alpha=source.data[i+3]/255;hist[Math.round((.299*source.data[i]+.587*source.data[i+1]+.114*source.data[i+2])*alpha+255*(1-alpha))]++;}let count=0;for(let i=0;i<256;i++){count+=hist[i];if(count>=width*height*.02){low=i;break;}}count=0;for(let i=255;i>=0;i--){count+=hist[i];if(count>=width*height*.02){high=i;break;}}if(high-low<32){low=0;high=255;}}
 const pixel=(x,y,c)=>source.data[(Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*4+c];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const rx=(x+.5)/scale-.5,ry=(y+.5)/scale-.5;let sx=rx,sy=ry;
  if(setting.rotation===90){sx=ry;sy=height-1-rx;}else if(setting.rotation===180){sx=width-1-rx;sy=height-1-ry;}else if(setting.rotation===270){sx=width-1-ry;sy=rx;}
  const x0=Math.floor(sx),y0=Math.floor(sy),dx=sx-x0,dy=sy-y0,rgba=[];
  for(let c=0;c<4;c++)rgba.push(pixel(x0,y0,c)*(1-dx)*(1-dy)+pixel(x0+1,y0,c)*dx*(1-dy)+pixel(x0,y0+1,c)*(1-dx)*dy+pixel(x0+1,y0+1,c)*dx*dy);
  const offset=(y*w+x)*4;if(setting.enhance){const a=rgba[3]/255,v=Math.round(Math.max(0,Math.min(255,((.299*rgba[0]+.587*rgba[1]+.114*rgba[2])*a+255*(1-a)-low)*255/(high-low))));out.data[offset]=out.data[offset+1]=out.data[offset+2]=v;out.data[offset+3]=255;}else for(let c=0;c<4;c++)out.data[offset+c]=Math.round(rgba[c]);
 }
 const map=box=>{let [x0,y0,x1,y1]=box.map(n=>n/scale),b=[x0,y0,x1,y1];if(setting.rotation===90)b=[y0,height-x1,y1,height-x0];else if(setting.rotation===180)b=[width-x1,height-y1,width-x0,height-y0];else if(setting.rotation===270)b=[width-y1,x0,width-y0,x1];return b.map((n,i)=>Math.max(0,Math.min(i%2?height:width,i<2?Math.floor(n):Math.ceil(n))));};
 return {bytes:PNG.sync.write(out),map};
}
module.exports={options,prepare};
