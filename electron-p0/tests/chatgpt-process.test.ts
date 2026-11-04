import {it,expect} from 'vitest';
import {ChatGptProcess,validChatGptAuthorize} from '../main/chatgpt-process';
function url(){const u=new URL('https://auth.openai.com/api/accounts/authorize');for(const [k,v] of Object.entries({client_id:'dynamic_agent_client',response_type:'code',redirect_uri:'http://127.0.0.1:12345/auth/callback',resource:'https://api.openai.com/v1',scope:'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',code_challenge_method:'S256',state:'a'.repeat(43),nonce:'b'.repeat(43),code_challenge:'c'.repeat(43)}))u.searchParams.set(k,v);return u;}
it('only opens the official browser endpoint with PKCE and exact loopback callback',()=>{expect(validChatGptAuthorize(url().href)).toBe(true);for(const [k,v] of [['redirect_uri','http://evil.invalid/auth/callback'],['redirect_uri','http://localhost:12345/auth/callback'],['client_id','other-app'],['code_challenge_method','plain'],['token','synthetic']]){const u=url();u.searchParams.set(k,v);expect(validChatGptAuthorize(u.href)).toBe(false);}const duplicate=url();duplicate.searchParams.append('state','other');expect(validChatGptAuthorize(duplicate.href)).toBe(false);});
it('does not spawn or use a plaintext fallback on unsupported platforms',async()=>{const p=new ChatGptProcess('/missing','/tmp/synthetic',async()=>{},'linux');await expect(p.run({action:'signIn'},new AbortController().signal)).rejects.toThrow('unsupportedPlatform');p.dispose();await p.flush();});

// Real owned child processes and loopback sockets, synthetic protocol only. No OAuth/API calls.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createConnection} from 'node:net';
const wire=(value:unknown)=>JSON.stringify(value);
async function fixture(source:string,work:(p:ChatGptProcess)=>Promise<void>,open=async(_url:string)=>{},timeout=1000){const root=await mkdtemp(join(tmpdir(),'chatgpt-wire-'));const file=join(root,'synthetic-helper');await writeFile(file,'#!/usr/bin/env node\n'+source,{mode:0o700});const p=new ChatGptProcess(file,root,open,'win32',timeout);try{await work(p);}finally{p.dispose();await p.flush();await rm(root,{recursive:true,force:true});}}
it('returns validated one-shot protocol replies and rejects missing/duplicate/malformed replies',async()=>{
 await fixture(`process.stdin.resume();process.stdin.on('data',()=>{process.stdout.write(${wire(JSON.stringify({ok:true,data:{text:'합성'}})+'\n')});process.exit(0);});`,async p=>expect(await p.run({action:'state'},new AbortController().signal)).toEqual({text:'합성'}));
 for(const output of ['invalid\n','',JSON.stringify({ok:true,data:{}})+'\n'+JSON.stringify({ok:true,data:{}})+'\n'])await fixture(`process.stdin.resume();process.stdin.on('data',()=>{process.stdout.write(${wire(output)});process.exit(0);});`,async p=>{await expect(p.run({action:'state'},new AbortController().signal)).rejects.toThrow();});
});
it('times out and reaps only its owned helper',async()=>{await fixture('process.stdin.resume();setInterval(()=>{},100);',async p=>{await expect(p.run({action:'models'},new AbortController().signal)).rejects.toThrow('timeout');await p.flush();},undefined,75);});
it('cancels an actual pending callback listener and closes its loopback socket',async()=>{
 const authorize=url();let port=0,opened!:()=>void;const observed=new Promise<void>(resolve=>{opened=resolve;});
 await fixture(`const net=require('node:net');const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const u=new URL(${wire(authorize.href)});u.searchParams.set('redirect_uri','http://127.0.0.1:'+server.address().port+'/auth/callback');process.stdout.write(JSON.stringify({event:'authorize',url:u.href})+'\\n');});process.stdin.resume();`,async p=>{
  const controller=new AbortController();const result=p.run({action:'signIn'},controller.signal);await observed;controller.abort();await expect(result).rejects.toThrow('cancelled');await p.flush();
  const connected=await new Promise<boolean>(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));});expect(connected).toBe(false);
 },async address=>{port=Number(new URL(new URL(address).searchParams.get('redirect_uri')!).port);opened();});
});
it('rejects oversized stdout and never exposes unexpected stderr',async()=>{await fixture(`process.stdin.resume();process.stdin.on('data',()=>{process.stderr.write('DO_NOT_EXPOSE');process.stdout.write('x'.repeat(1048577));});`,async p=>{await expect(p.run({action:'state'},new AbortController().signal)).rejects.toThrow('invalidResponse');});});
