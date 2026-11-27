import {expect,it} from 'vitest';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DesktopSurfaceModeStore} from '../main/desktop-surface-mode';
import {reconcileDesktopProfiles,moveWidgetOwnership,selectDockProfile,projectLayoutInsideWorkArea,writeProfileLayout} from '../main/desktop-surface-domain';

it('treats only an absent sidecar as the palette default without writing',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-mode-'));
  const store=new DesktopSurfaceModeStore(root);
  expect(await store.read()).toMatchObject({version:2,mode:'palette',profiles:{},dockProfileKey:null,boardPlacement:{preset:'shared',target:null,iconSpace:25}});
  await expect(readFile(join(root,'desktop-surface.json'))).rejects.toMatchObject({code:'ENOENT'});
});

it('preserves corrupt bytes and does not misclassify read failure as first run',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-corrupt-'));
  const file=join(root,'desktop-surface.json');
  await writeFile(file,'SYNTHETIC CORRUPT');
  const store=new DesktopSurfaceModeStore(root);
  await expect(store.read()).rejects.toThrow('preserved');
  expect(await readFile(file,'utf8')).toBe('SYNTHETIC CORRUPT');
});

it('persists an explicit palette choice independently from layout settings',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-write-'));
  const store=new DesktopSurfaceModeStore(root);
  const document=await store.read();
  await store.write({...document,mode:'window'});
  expect((await new DesktopSurfaceModeStore(root).read()).mode).toBe('window');
});

const displays=[
  {id:11,label:'Primary',primary:true,workArea:{x:0,y:0,width:1920,height:1040},scaleFactor:1},
  {id:22,label:'Secondary',primary:false,workArea:{x:-1920,y:0,width:1920,height:1040},scaleFactor:1.25},
] as const;

it('starts a new primary profile with only the compact core widgets and keeps a new secondary empty',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-topology-'));
  const layout={version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[
    {id:'widget-clock',type:'clock',x:8,y:0,w:2,h:2,visible:true},
    {id:'widget-today-summary',type:'today-summary',x:8,y:10,w:4,h:2,visible:true},
    {id:'widget-quick-memo',type:'quick-memo',x:0,y:9,w:5,h:3,visible:true},
    ...Array.from({length:10},(_,index)=>({id:`widget-extra-${index}`,type:'clock',x:index%12,y:index+12,w:2,h:2,visible:true})),
  ]};
  const reconciled=reconcileDesktopProfiles(await new DesktopSurfaceModeStore(root).read(),displays,layout,'2026-11-19T00:00:00.000Z');
  const primary=reconciled.displayProfiles.get(11),secondary=reconciled.displayProfiles.get(22);
  expect(primary?.ownedWidgetIds).toEqual(['widget-clock','widget-today-summary','widget-quick-memo']);
  const primaryWidgets=(primary?.layout as typeof layout).widgets;
  expect(primaryWidgets.find(widget=>widget.id==='widget-clock')).toMatchObject({x:10,y:0,w:2,h:2,visible:true});
  expect(primaryWidgets.find(widget=>widget.id==='widget-today-summary')).toMatchObject({x:6,y:0,w:4,h:2,visible:true});
  expect(primaryWidgets.find(widget=>widget.id==='widget-quick-memo')).toMatchObject({x:9,y:2,w:3,h:2,visible:true});
  expect(primaryWidgets.filter(widget=>widget.visible).map(widget=>widget.id)).toEqual(['widget-clock','widget-today-summary','widget-quick-memo']);
  expect(secondary?.ownedWidgetIds).toEqual([]);
  expect(reconciled.document.dockProfileKey).toBe(primary?.profileKey);
});

it('preserves every saved coordinate, size, visibility and ownership for existing monitor profiles',()=>{
  const layout={version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[
    {id:'widget-clock',type:'clock',x:1,y:4,w:5,h:3,visible:false},
    {id:'widget-monthly-calendar',type:'monthly-calendar',x:6,y:7,w:6,h:8,visible:true},
  ]};
  const initial=reconcileDesktopProfiles({version:2,mode:'palette',dockProfileKey:null,profiles:{}},[displays[0]],layout,'2026-11-19T00:00:00.000Z');
  const profileKey=initial.displayProfiles.get(11)?.profileKey;if(!profileKey)throw new Error('Missing primary profile');
  const saved={...initial.document,profiles:{...initial.document.profiles,[profileKey]:{...initial.document.profiles[profileKey]!,ownedWidgetIds:['widget-clock','widget-monthly-calendar'],layout}}};
  const reconciled=reconcileDesktopProfiles(saved,[displays[0]],layout,'2026-11-19T00:01:00.000Z');
  expect(reconciled.document.profiles[profileKey]?.ownedWidgetIds).toEqual(['widget-clock','widget-monthly-calendar']);
  expect(reconciled.document.profiles[profileKey]?.layout).toEqual(layout);
});

it('uses the same compact starter contract when an empty primary profile receives its first layout',()=>{
  const layout={version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[
    {id:'widget-clock',type:'clock',x:0,y:8,w:3,h:2,visible:true},
    {id:'widget-today-summary',type:'today-summary',x:3,y:8,w:5,h:2,visible:true},
    {id:'widget-quick-memo',type:'quick-memo',x:0,y:10,w:4,h:3,visible:true},
    {id:'widget-monthly-calendar',type:'monthly-calendar',x:4,y:10,w:8,h:7,visible:true},
  ]};
  const profileKey='monitor:primary';
  const document={version:2 as const,mode:'palette' as const,dockProfileKey:profileKey,profiles:{[profileKey]:{visible:true,layout:null,ownedWidgetIds:[],monitor:{fingerprint:'primary',label:'Primary',lastDisplayId:11,workArea:{x:0,y:0,width:1920,height:1040},scaleFactor:1},dormant:false,updatedAt:'2026-11-19T00:00:00.000Z'}}};
  const written=writeProfileLayout(document,profileKey,layout,'2026-11-19T00:01:00.000Z');
  expect(written.profiles[profileKey]?.ownedWidgetIds).toEqual(['widget-clock','widget-today-summary','widget-quick-memo']);
  expect((written.profiles[profileKey]?.layout as typeof layout).widgets.filter(widget=>widget.visible).map(widget=>widget.id)).toEqual(['widget-clock','widget-today-summary','widget-quick-memo']);
});

it('moves ownership without duplicating a widget and preserves dormant profiles',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-move-'));
  const first=reconcileDesktopProfiles(await new DesktopSurfaceModeStore(root).read(),displays,{version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[{id:'widget-clock',type:'clock',x:0,y:0,w:2,h:2,visible:true}]},'2026-11-19T00:00:00.000Z');
  const primary=first.displayProfiles.get(11),secondary=first.displayProfiles.get(22);
  if(!primary||!secondary)throw new Error('Missing synthetic profiles');
  const moved=moveWidgetOwnership(first.document,'widget-clock',secondary.profileKey,'2026-11-19T00:01:00.000Z');
  expect(moved.profiles[primary.profileKey]?.ownedWidgetIds).not.toContain('widget-clock');
  expect(moved.profiles[secondary.profileKey]?.ownedWidgetIds).toContain('widget-clock');
  expect(moved.profiles[secondary.profileKey]?.layout).not.toBeNull();
  const disconnected=reconcileDesktopProfiles(moved,[displays[0]],null,'2026-11-19T00:02:00.000Z');
  expect(disconnected.document.profiles[secondary.profileKey]?.dormant).toBe(true);
  const reconnected=reconcileDesktopProfiles(disconnected.document,displays,null,'2026-11-19T00:03:00.000Z');
  expect(reconnected.displayProfiles.get(22)?.ownedWidgetIds).toContain('widget-clock');
});

it('keeps hidden widget state while moving another widget between monitors',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-hidden-'));
  const layout={version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[
    {id:'widget-clock',type:'clock',x:0,y:0,w:2,h:2,visible:true},
    {id:'widget-memo',type:'memo',x:2,y:0,w:3,h:2,visible:false},
  ]};
  const first=reconcileDesktopProfiles(await new DesktopSurfaceModeStore(root).read(),displays,layout,'2026-11-19T00:00:00.000Z');
  const secondary=first.displayProfiles.get(22);if(!secondary)throw new Error('Missing secondary profile');
  const moved=moveWidgetOwnership(first.document,'widget-clock',secondary.profileKey,'2026-11-19T00:01:00.000Z');
  const primaryProfile=Object.values(moved.profiles).find(value=>value.monitor.lastDisplayId===11);
  expect((primaryProfile?.layout as typeof layout).widgets.find(widget=>widget.id==='widget-memo')?.visible).toBe(false);
});

it('supports one, two, and three displays without duplicating widget ownership',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-counts-'));
  const layout={version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[
    {id:'widget-clock',type:'clock',x:0,y:0,w:2,h:2,visible:true},
    {id:'widget-today-summary',type:'today-summary',x:2,y:0,w:4,h:2,visible:true},
    {id:'widget-quick-memo',type:'quick-memo',x:6,y:0,w:3,h:2,visible:true},
    ...Array.from({length:10},(_,index)=>({id:`widget-extra-${index}`,type:'clock',x:0,y:index+2,w:2,h:2,visible:true})),
  ]};
  const third={id:33,label:'Portrait',primary:false,workArea:{x:1920,y:-200,width:1200,height:1800},scaleFactor:1.5} as const;
  for(const topology of [[displays[0]],displays,[...displays,third]]){
    const result=reconcileDesktopProfiles(await new DesktopSurfaceModeStore(root).read(),topology,layout,'2026-11-19T00:00:00.000Z');
    const ids=[...result.displayProfiles.values()].flatMap(value=>value.ownedWidgetIds);
    expect(ids).toHaveLength(3);expect(new Set(ids)).toHaveLength(3);
    expect([...result.displayProfiles.values()].filter(value=>value.dockVisible)).toHaveLength(1);
  }
});

it('keeps the same monitor profile when DPI metrics change',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-dpi-'));
  const layout={version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[{id:'widget-clock',type:'clock',x:0,y:0,w:2,h:2,visible:true}]};
  const first=reconcileDesktopProfiles(await new DesktopSurfaceModeStore(root).read(),[displays[0]],layout,'2026-11-19T00:00:00.000Z');
  const firstKey=first.displayProfiles.get(11)?.profileKey;if(!firstKey)throw new Error('Missing primary profile');
  const changed=reconcileDesktopProfiles(first.document,[{...displays[0],workArea:{x:0,y:0,width:1536,height:832},scaleFactor:1.25}],layout,'2026-11-19T00:01:00.000Z');
  expect(changed.displayProfiles.get(11)?.profileKey).toBe(firstKey);
  expect(changed.document.profiles[firstKey]?.monitor.scaleFactor).toBe(1.25);
});

it('keeps one Dock and temporarily projects inaccessible widgets without rewriting stored geometry',()=>{
  const root=selectDockProfile({preferredProfileKey:'missing',connectedProfileKeys:['primary','secondary'],primaryProfileKey:'primary'});
  expect(root).toEqual({activeProfileKey:'primary',preferredProfileKey:'missing'});
  const stored={id:'widget-upcoming-schedule',type:'upcoming-schedule',x:9,y:38,w:3,h:4,visible:true};
  const projected=projectLayoutInsideWorkArea([stored],{maxRows:12,dockRows:2});
  expect(projected[0]).toMatchObject({id:stored.id,y:6});
  expect(stored.y).toBe(38);
});

it('keeps an existing sidecar without placement on the legacy layout and preserves a saved dedicated target',async()=>{
  const root=await mkdtemp(join(tmpdir(),'surface-existing-'));
  const store=new DesktopSurfaceModeStore(root);
  const layout={version:1,appearance:{background:'blue-gray',cardStyle:'default',cornerStyle:'soft'},widgets:[]};
  const initial={version:2,mode:'palette',profiles:{},dockProfileKey:null} as const;
  const existing=reconcileDesktopProfiles(initial,displays,layout,'2026-11-19T00:00:00.000Z').document;
  await store.write(existing);
  expect(await store.read()).toEqual(existing);
  expect((await store.read()).boardPlacement).toBeUndefined();
  const dedicated={...existing,boardPlacement:{preset:'dedicated',target:existing.dockProfileKey,iconSpace:21}} as const;
  await store.write(dedicated);
  expect(await new DesktopSurfaceModeStore(root).read()).toEqual(dedicated);
});
