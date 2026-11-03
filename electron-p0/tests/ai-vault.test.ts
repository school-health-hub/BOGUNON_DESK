import {it,expect} from 'vitest';
import {mkdtemp,readFile,readdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {EncryptedAiVault} from '../main/ai-vault';
const credential={provider:'openai' as const,key:'synthetic-only-key',model:'gpt-synthetic'};
it('stores ciphertext only, restores in Main and deletes only the separate Electron credential',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ai-vault-')),key=randomBytes(32);
 const vault=new EncryptedAiVault(root,{available:true,encrypt:text=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(text),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);},decrypt:bytes=>{const cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString();}});
 try{await vault.write(credential);const bytes=await readFile(join(root,'api-credential.bin'));expect(bytes.includes(Buffer.from(credential.key))).toBe(false);expect(await vault.read()).toEqual(credential);expect(await readdir(root)).toEqual(['api-credential.bin']);await writeFile(join(root,'unrelated.txt'),'synthetic');await vault.clear();expect(await vault.exists()).toBe(false);expect(await readFile(join(root,'unrelated.txt'),'utf8')).toBe('synthetic');}finally{await rm(root,{recursive:true,force:true});}
});
it('fails closed without encryption and preserves corrupt ciphertext and symlink targets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ai-vault-deny-')),vault=new EncryptedAiVault(root,{available:false,encrypt:()=>{throw Error('must not encrypt');},decrypt:()=>{throw Error('must not decrypt');}});
 try{await expect(vault.write(credential)).rejects.toThrow('unavailable');expect(await readdir(root)).toEqual([]);const file=join(root,'api-credential.bin');await writeFile(file,'synthetic ciphertext');await expect(vault.read()).rejects.toThrow('unavailable');expect(await readFile(file,'utf8')).toBe('synthetic ciphertext');await rm(file);const target=join(root,'other');await writeFile(target,'preserve');await symlink(target,file);await expect(vault.read()).rejects.toThrow();await expect(vault.write(credential)).rejects.toThrow();expect(await readFile(target,'utf8')).toBe('preserve');}finally{await rm(root,{recursive:true,force:true});}
});
