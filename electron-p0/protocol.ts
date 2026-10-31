export const APP_ID = 'kr.sungandi.schoolhealthdesk.electronp0';
export const PRODUCT_NAME = 'BOGUNON DESK ELECTRON P0';
export const PROFILE_NAME = 'BOGUNON-DESK-ELECTRON-P0';
export type P0Settings = Readonly<{ version: 1; dashboard: unknown; dock: unknown }>;
export type P0Info = Readonly<{ appId: string; productName: string; userData: string; sourceSha: string; electron: string }>;
export interface P0Bridge {
  info(): Promise<P0Info>;
  readSettings(): Promise<P0Settings | null>;
  writeSettings(settings: P0Settings): Promise<void>;
}
