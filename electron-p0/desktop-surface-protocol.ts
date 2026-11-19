export type DesktopSurfaceMode='window'|'palette';
export type MonitorIdentity=Readonly<{fingerprint:string;label:string;lastDisplayId:number;workArea:Readonly<{x:number;y:number;width:number;height:number}>;scaleFactor:number}>;
export type DesktopSurfaceProfile=Readonly<{visible:boolean;layout:unknown|null;ownedWidgetIds:readonly string[];monitor:MonitorIdentity;dormant:boolean;updatedAt:string}>;
export type DesktopSurfaceDocument=Readonly<{version:2;mode:DesktopSurfaceMode;profiles:Readonly<Record<string,DesktopSurfaceProfile>>;dockProfileKey:string|null}>;
export interface DesktopSurfaceBridge {
  read():Promise<DesktopSurfaceDocument>;
  write(mode:DesktopSurfaceMode):Promise<DesktopSurfaceDocument>;
}
