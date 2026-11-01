import {it,expect} from 'vitest';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {desktopDefaults,validateDesktop,fitBounds} from '../main/desktop';
import {SettingsStore} from '../main/settings';
it('corrects removed monitor, negative coordinates, reduced work area and DPI-sized areas',()=>{
 const primary={x:0,y:0,width:1920,height:1040},left={x:-1280,y:0,width:1280,height:720};
 expect(fitBounds({x:-1200,y:20,width:1000,height:700},[primary,left])).toEqual({x:-1200,y:20,width:1000,height:700});
 expect(fitBounds({x:-1200,y:20,width:1000,height:700},[primary])).toEqual({x:0,y:20,width:1000,height:700});
 expect(fitBounds({x:1800,y:900,width:1440,height:900},[{x:0,y:0,width:800,height:600}])).toEqual({x:0,y:0,width:800,height:600});
 expect(fitBounds(undefined,[left]).width).toBe(1280);
});
it('keeps desktop state separate, validates and restores with safe defaults on read failure',async()=>{
 const root=await mkdtemp(join(tmpdir(),'p1b-'));
 await writeFile(join(root,'layout.json'),'untouched');
 const store=new SettingsStore(root,'desktop.json',validateDesktop);
 const state={...desktopDefaults(),closeBehavior:'tray' as const,bounds:{x:20,y:30,width:1100,height:760}};
 await store.write(state);expect(await new SettingsStore(root,'desktop.json',validateDesktop).read()).toEqual(state);
 expect(()=>store.write({...state,bounds:{...state.bounds,width:NaN}})).toThrow();
 expect(await readFile(join(root,'layout.json'),'utf8')).toBe('untouched');
 await writeFile(join(root,'desktop.json'),'corrupt');
 expect(await store.read().catch(()=>desktopDefaults())).toEqual(desktopDefaults());
});
