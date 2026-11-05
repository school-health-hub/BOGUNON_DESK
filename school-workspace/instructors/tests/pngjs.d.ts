// The existing pngjs dev dependency has no bundled declarations; fixture API used here only.
declare module 'pngjs' {
 import {Buffer} from 'node:buffer';
 export class PNG {
  constructor(options:{width:number;height:number});
  width:number;height:number;data:Buffer;
  static sync:{write(image:PNG):Buffer;read(bytes:Buffer):PNG};
 }
}
