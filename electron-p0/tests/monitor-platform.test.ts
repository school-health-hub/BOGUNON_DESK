import {afterEach,expect,it,vi} from 'vitest';
import {observeMonitors,parseNativeMonitors} from '../main/windows-monitor-identity';
import {recoverSurface} from '../main/recover-surface';
import {TopologyReconciler} from '../main/topology-reconciler';
const display=(id=1,x=0,y=0,scaleFactor=1)=>({id,label:'Synthetic display',bounds:{x,y,width:1920,height:1080},workArea:{x,y,width:1920,height:1032},scaleFactor});
const native=(x=0,y=0,width=1920,height=1080)=>({path:'\\\\?\\DISPLAY#SYN1234#LOCAL-PORT-A',label:'Synthetic',x,y,width,height});
afterEach(()=>vi.useRealTimers());
it('keeps composite device identity across ID, primary, position, resolution and DPI changes',()=>{
 // Given native physical bounds paired with Electron DIP bounds.
 const a=observeMonitors([display()],1,[native()],p=>p,'qa-machine')[0];
 const b=observeMonitors([display(88,-1920,-1080,1.5)],99,[native(-2880,-1620,2880,1620)],p=>({x:p.x*1.5,y:p.y*1.5}),'qa-machine')[0];
 // When observation changes, geometry is current but identity is not coordinate/ID based.
 expect(b?.identityKey).toBe(a?.identityKey);expect(b?.primary).toBe(false);expect(b?.bounds.x).toBe(-1920);
 expect(observeMonitors([display()],1,[native()],p=>p,'another-machine')[0]?.identityKey).not.toBe(a?.identityKey);
});
it('does not guess when native mapping is missing or duplicated',()=>{
 expect(observeMonitors([display()],1,[],p=>p)[0]?.identityKind).toBe('uncertain');
 expect(observeMonitors([display()],1,[native(),native()],p=>p)[0]?.identityKey).toBeNull();
 expect(()=>parseNativeMonitors([{path:'x'}])).toThrow();
});
it.each([{x:-1920,y:0,width:1600,height:900},{x:0,y:-1200,width:1000,height:700},{x:0,y:0,width:640,height:480}])('recovers hidden Workspace or Settings into available DIP workArea %j',area=>{
 const setBounds=vi.fn(),setMinimumSize=vi.fn();
 recoverSurface({getNormalBounds:()=>({x:5000,y:5000,width:1440,height:900}),setBounds,setMinimumSize},[area],[720,560]);
 const bounds=setBounds.mock.calls[0]?.[0];expect(bounds.width).toBe(Math.min(1440,area.width));expect(bounds.height).toBe(Math.min(900,area.height));expect(bounds.x).toBeGreaterThanOrEqual(area.x);expect(bounds.x+bounds.width).toBeLessThanOrEqual(area.x+area.width);expect(bounds.y).toBeGreaterThanOrEqual(area.y);expect(bounds.y+bounds.height).toBeLessThanOrEqual(area.y+area.height);
 expect(setMinimumSize).toHaveBeenCalledWith(Math.min(720,area.width),Math.min(560,area.height));
});
it('serializes native probes and applies only the newest burst snapshot; quit blocks late recreation',async()=>{
 vi.useFakeTimers();let release:((value:number)=>void)|undefined;const read=vi.fn().mockImplementationOnce(()=>new Promise<number>(resolve=>{release=resolve;})).mockResolvedValue(2);const apply=vi.fn().mockResolvedValue(undefined),failed=vi.fn();
 const pump=new TopologyReconciler<number>(read,apply,failed,10);const initial=pump.start();pump.schedule();pump.schedule();release?.(1);await initial;
 expect(read).toHaveBeenCalledTimes(2);expect(apply).toHaveBeenCalledExactlyOnceWith(2,expect.any(Function));pump.stop();await vi.runAllTimersAsync();expect(read).toHaveBeenCalledTimes(2);expect(failed).not.toHaveBeenCalled();
});
it('does not mutate windows from superseded topology while profile persistence is pending',async()=>{
 let release:(()=>void)|undefined;const windows=vi.fn(),read=vi.fn().mockResolvedValueOnce(1).mockResolvedValue(2);
 const pump=new TopologyReconciler<number>(read,async(value,current)=>{if(value===1)await new Promise<void>(resolve=>{release=resolve;});if(current())windows(value);},()=>{});
 const run=pump.start();await Promise.resolve();pump.schedule();release?.();await run;expect(windows).toHaveBeenCalledExactlyOnceWith(2);pump.stop();
});
