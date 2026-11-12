import type { P0Info, P0Settings } from './protocol.js';

export const desktopModuleIds = ['official-document','purchase-helper','education-video-finder','personal-inventory','finance','newsletter','school-workspace'] as const;
export type DesktopModuleId = typeof desktopModuleIds[number];
// Transport mirrors existing Desktop action IDs without importing renderer source into Main.
export const desktopActionIds = ['home','today-tasks','inbox','calculator','purchase-helper','official-document','online-health-room','bogunon','toolbox','aed-check','record-helper','bogunon-school-settings','checkup-tools','work-folder','work-portal','quick-memo','settings'] as const;
export type DesktopActionRequestId = typeof desktopActionIds[number];
export type DesktopEntry = Readonly<{kind:'module';moduleId:DesktopModuleId}> | Readonly<{kind:'action';actionId:DesktopActionRequestId}>;
export const settingsSectionIds = ['account','school','appearance','dock','ai','device','about'] as const;
export type SettingsSectionId = typeof settingsSectionIds[number];
export interface SurfaceSettingsSnapshot { readonly revision:number; readonly value:P0Settings|null; }
export interface SurfaceSettingsWrite { readonly revision:number; readonly value:P0Settings; }
export interface SurfaceSettingsBridge {
 readonly read:()=>Promise<SurfaceSettingsSnapshot>;
 readonly write:(request:SurfaceSettingsWrite)=>Promise<SurfaceSettingsSnapshot>;
 readonly subscribe:(listener:(snapshot:SurfaceSettingsSnapshot)=>void)=>()=>void;
 readonly onFlush?:(listener:()=>Promise<void>)=>()=>void;
 readonly onResume?:(listener:()=>void)=>()=>void;
}
export interface WorkspaceNavigationBridge {
 readonly ready:()=>Promise<void>;
 readonly onEntry:(listener:(entry:DesktopEntry)=>void)=>()=>void;
 readonly openSettings:(section?:SettingsSectionId)=>Promise<void>;
}
export interface SettingsWindowBridge {
 readonly info:()=>Promise<P0Info>;
 readonly ready:()=>Promise<void>;
 readonly onSection:(listener:(section:SettingsSectionId)=>void)=>()=>void;
 readonly close:()=>Promise<void>;
 readonly openWorkspace:()=>Promise<void>;
}
