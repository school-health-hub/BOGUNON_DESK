'use strict';
// Loaded by both the owned Node child and inherited worker threads before OCR code.
const denied=()=>{throw new Error('OCR network and subprocess access is disabled');};
globalThis.fetch=async()=>denied();
for(const name of ['http','https']){const module=require(name);module.request=denied;module.get=denied;}
require('net').Socket.prototype.connect=denied;
for(const name of ['lookup','resolve','resolve4','resolve6'])require('dns')[name]=denied;
for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])require('child_process')[name]=denied;
const Memory=WebAssembly.Memory;
WebAssembly.Memory=class BoundedMemory extends Memory {constructor(desc){if(desc.initial>8192)throw Error('OCR memory limit');super({...desc,maximum:Math.min(desc.maximum??8192,8192)});}};
