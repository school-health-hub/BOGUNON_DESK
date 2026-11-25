import {describe,expect,it,vi} from 'vitest';
import {OnlineHealthRoomService,safeOnlineHealthRoomUrl,validateOnlineHealthRoomSettings} from '../main/online-health-room.js';
import type {OnlineHealthRoomSettings} from '../online-health-room-protocol.js';
import {onlineHealthRoomDock} from '../renderer/online-health-room-dock.js';
import {createDefaultDockLayout} from '../../src/dock/storage.js';

describe('online health room link',()=>{
  it('changes only the online icon visibility without reordering saved Dock items',()=>{
    const layout=createDefaultDockLayout(),off=onlineHealthRoomDock(layout,false),on=onlineHealthRoomDock(layout,true);
    expect(on.items.map(item=>item.id)).toEqual(layout.items.map(item=>item.id));
    expect(off.items.filter(item=>item.visible).map(item=>item.id)).not.toContain('online-health-room');
    expect(on.items.find(item=>item.id==='online-health-room')?.visible).toBe(true);
    expect(on.items.filter(item=>item.id!=='online-health-room')).toEqual(layout.items.filter(item=>item.id!=='online-health-room'));
  });
  it.each(['http://school.edu.kr/','https://localhost/','https://127.0.0.1/','https://10.0.0.1/','https://[::1]/','https://user:pass@school.edu.kr/','javascript:alert(1)','https://school.edu.kr/?token=secret','https://school.edu.kr:8443/','https://school.local/','https://school.edu.kr/%2fadmin'])('rejects unsafe address %s',value=>{expect(()=>safeOnlineHealthRoomUrl(value)).toThrow();});
  it('accepts a school-specific public HTTPS path without storing credentials',()=>{expect(safeOnlineHealthRoomUrl('https://health.school.edu.kr/room')).toBe('https://health.school.edu.kr/room');expect(validateOnlineHealthRoomSettings({enabled:true,url:''})).toEqual({enabled:true,url:''});});
  it('separates disabled, missing, and browser-opened states and revalidates on every launch',async()=>{
    let stored:OnlineHealthRoomSettings|null=null;
    const read=vi.fn(async()=>stored),write=vi.fn(async(value:OnlineHealthRoomSettings)=>{stored=value;}),openExternal=vi.fn(async()=>{});
    const service=new OnlineHealthRoomService({read,write},openExternal);
    expect(await service.open()).toBe('disabled');
    await service.save({enabled:true,url:''});expect(await service.open()).toBe('needs-configuration');
    await service.save({enabled:true,url:'https://health.school.edu.kr/room'});expect(await service.open()).toBe('opened');expect(openExternal).toHaveBeenCalledWith('https://health.school.edu.kr/room');
    stored={enabled:true,url:'https://127.0.0.1/'};await expect(service.open()).rejects.toThrow();expect(openExternal).toHaveBeenCalledTimes(1);
  });
  it('does not persist a failed browser test or a rejected setting',async()=>{
    const write=vi.fn(async()=>{}),openExternal=vi.fn(async()=>{throw Error('browser failed');});
    const service=new OnlineHealthRoomService({read:async()=>null,write},openExternal);
    await expect(service.test('https://school.edu.kr/')).rejects.toThrow('browser failed');
    await expect(service.save({enabled:true,url:'http://school.edu.kr/'})).rejects.toThrow();expect(write).not.toHaveBeenCalled();
  });
});
