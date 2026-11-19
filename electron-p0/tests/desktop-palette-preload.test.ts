import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

it('exposes a purpose-limited palette bridge and never the business bridge',async()=>{
  const source=await readFile(join(process.cwd(),'electron-p0/preload/palette-preload.cts'),'utf8');
  expect(source).toContain("exposeInMainWorld('electronPalette'");
  expect(source).not.toContain("exposeInMainWorld('electronWork'");
  for(const forbidden of ['p2:account','p2:finance','p2:inventory','p2:newsletter','p2:official-document'])expect(source).not.toContain(forbidden);
});
