import {it,expect} from 'vitest';import {readFileSync,readdirSync} from 'node:fs';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import postcss from 'postcss';
const root=resolve('electron-p0/renderer/inventory-preview');
it('preserves selected B pure dependencies and the workflow UI byte-for-byte',()=>{const hashes=JSON.parse(readFileSync(join(root,'source-hashes.json'),'utf8')) as Record<string,string>;for(const [file,hash] of Object.entries(hashes)){const source=readFileSync(join(root,'source',file),'utf8').replace(/\r\n/g,'\n');expect(createHash('sha256').update(source).digest('hex')).toBe(hash);}});
it('does not import transport/auth or introduce network/storage/IPC into the synthetic view',()=>{
 for(const folder of [root,join(root,'source')])for(const file of readdirSync(folder).filter(f=>/\.tsx?$/.test(f))){const code=readFileSync(join(folder,file),'utf8');expect(code).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|localStorage|indexedDB|electronWork|service_role)\b|@supabase|@tauri|connection\/|process\.env|import\.meta\.env/);}
});
it('scopes all CSS selectors, including media queries, so the local Inventory stays independent',()=>{
 let rules=0;postcss.parse(readFileSync(join(root,'preview.css'),'utf8')).walkRules(rule=>{for(const selector of rule.selectors)expect(selector).toMatch(/^\.inventory-(preview|local-mode)(?:\s|$)/);rules++;});expect(rules).toBeGreaterThan(40);
});
