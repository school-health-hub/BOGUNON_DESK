export type Bounds = {x:number;y:number;width:number;height:number};
export type DesktopState = {version:1;closeBehavior:'quit'|'tray';bounds?:Bounds;maximized:boolean};
export const desktopDefaults = ():DesktopState=>({version:1,closeBehavior:'quit',maximized:false});
export function validateDesktop(value:unknown):DesktopState {
 const v=value as DesktopState;
 if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['version','closeBehavior','bounds','maximized'].includes(k))||v.version!==1||!['quit','tray'].includes(v.closeBehavior)||typeof v.maximized!=='boolean')throw Error('Invalid desktop settings');
 if(v.bounds!==undefined){const b=v.bounds;if(!b||typeof b!=='object'||Object.keys(b).sort().join(',')!=='height,width,x,y'||!Object.values(b).every(n=>Number.isInteger(n)&&Math.abs(n)<=100000)||b.width<320||b.height<240)throw Error('Invalid window bounds');}
 return structuredClone(v);
}
// Electron screen/workArea and BrowserWindow bounds use DIP, including mixed DPI displays.
export function fitBounds(bounds:Bounds|undefined,areas:Bounds[]):Bounds {
 if(!areas.length)throw Error('No available display');
 const b=bounds??{x:areas[0].x,y:areas[0].y,width:1440,height:900};
 const overlap=(a:Bounds)=>Math.max(0,Math.min(b.x+b.width,a.x+a.width)-Math.max(b.x,a.x))*Math.max(0,Math.min(b.y+b.height,a.y+a.height)-Math.max(b.y,a.y));
 const area=areas.reduce((a,n)=>overlap(n)>overlap(a)?n:a,areas[0]);
 const width=Math.min(b.width,area.width),height=Math.min(b.height,area.height);
 return {x:Math.max(area.x,Math.min(b.x,area.x+area.width-width)),y:Math.max(area.y,Math.min(b.y,area.y+area.height-height)),width,height};
}
