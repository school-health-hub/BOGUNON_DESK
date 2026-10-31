import { describe,it,expect } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertSender, resourceAllowed, CHANNELS } from '../main/policy';
describe('PoC IPC and resource boundary',()=>{
 it('permits only exact owned main frame and URL',()=>{
  const frame={},wc={mainFrame:frame,getURL:()=> 'file:///p0/index.html'};
  expect(()=>assertSender({sender:wc,senderFrame:frame},wc,'file:///p0/index.html')).not.toThrow();
  for(const e of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{}},{sender:wc,senderFrame:null}])expect(()=>assertSender(e,wc,'file:///p0/index.html')).toThrow();
  expect(()=>assertSender({sender:wc,senderFrame:frame},wc,'https://evil.invalid')).toThrow();
  expect(CHANNELS).toEqual(['p0:info','p0:read-settings','p0:write-settings']);
 });
 it('rejects network, file escape, unrelated local services and unknown schemes',()=>{
  const root=join(process.cwd(),'build/electron-p0-app/renderer');
  expect(resourceAllowed(pathToFileURL(join(root,'assets/a.js')).href,root)).toBe(true);
  for(const url of ['https://example.invalid','http://127.0.0.1:1420/','javascript:alert(1)','data:text/plain,test',pathToFileURL(join(root,'../secrets')).href])expect(resourceAllowed(url,root)).toBe(false);
  expect(resourceAllowed('http://127.0.0.1:5174/assets/a.js',root,'http://127.0.0.1:5174')).toBe(true);
  expect(resourceAllowed('http://localhost:5174/',root,'http://127.0.0.1:5174')).toBe(false);
 });
});
