import type { P0Bridge, WorkBridge } from '../protocol';
import type { PaletteBridge } from '../palette-protocol';
import type { SurfaceSettingsBridge, WorkspaceNavigationBridge, SettingsWindowBridge } from '../desktop-surface-protocol';
declare global { interface Window { electronP0: P0Bridge; electronWork: WorkBridge; electronPalette: PaletteBridge; electronSurfaceSettings: SurfaceSettingsBridge; electronDesktopNavigation: WorkspaceNavigationBridge; electronSettingsWindow: SettingsWindowBridge } }
