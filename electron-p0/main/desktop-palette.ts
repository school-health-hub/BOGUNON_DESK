import type { Rectangle } from 'electron';
export function ensureDesktopAccess(state:Readonly<{ready:boolean;quitting:boolean;trayAvailable:boolean;paletteAvailable:boolean}>,showWorkspace:()=>void):void {
  if(state.ready&&!state.quitting&&!state.trayAvailable&&!state.paletteAvailable)showWorkspace();
}

type PaletteWindow = {
  readonly isDestroyed: () => boolean;
  readonly isVisible: () => boolean;
  readonly showInactive: () => void;
  readonly hide: () => void;
  readonly setIgnoreMouseEvents: (ignore: boolean, options?: { readonly forward: boolean }) => void;
  readonly destroy: () => void;
};

export const desktopPaletteOptions = (workArea: Rectangle) => ({
  ...workArea,
  transparent: true,
  frame: false,
  skipTaskbar: true,
  alwaysOnTop: false,
  show: false,
  backgroundColor: '#00000000',
  hasShadow: false,
  focusable: true,
  resizable: false,
  movable: false,
} as const);

export class DesktopPaletteLifecycle {
  private quitting = false;
  private interactive = false;
  constructor(private readonly window: PaletteWindow) {}
  show(): void {
    if (this.quitting || this.window.isDestroyed()) return;
    this.interactive = false;
    this.window.setIgnoreMouseEvents(true, { forward: true });
    this.window.showInactive();
  }
  hide(): void {
    if (this.quitting || this.window.isDestroyed()) return;
    this.interactive = false;
    this.window.setIgnoreMouseEvents(true, { forward: true });
    this.window.hide();
  }
  setInteractive(interactive: boolean): void {
    if (this.quitting || this.window.isDestroyed()) return;
    if (this.interactive === interactive) return;
    this.interactive = interactive;
    if (interactive) this.window.setIgnoreMouseEvents(false);
    else this.window.setIgnoreMouseEvents(true, { forward: true });
  }
  beginQuit(): void {
    if (this.quitting) return;
    this.quitting = true;
    if (!this.window.isDestroyed()) this.window.destroy();
  }
}
