import { describe, expect, it, vi } from 'vitest';
import { DesktopPaletteLifecycle, desktopPaletteOptions } from '../main/desktop-palette';

describe('Desktop palette window contract', () => {
  it('uses the primary display workArea without becoming a taskbar or always-on-top window', () => {
    expect(desktopPaletteOptions({ x: -1200, y: 40, width: 1200, height: 760 })).toMatchObject({
      x: -1200, y: 40, width: 1200, height: 760,
      transparent: true, frame: false, skipTaskbar: true, alwaysOnTop: false, show: false,
    });
  });

  it('keeps one palette, resets passthrough on show, and becomes inert during quit', () => {
    const window = {
      isDestroyed: vi.fn(() => false), isVisible: vi.fn(() => false),
      showInactive: vi.fn(), hide: vi.fn(), setIgnoreMouseEvents: vi.fn(), destroy: vi.fn(),
    };
    const lifecycle = new DesktopPaletteLifecycle(window);
    lifecycle.show(); lifecycle.show();
    expect(window.showInactive).toHaveBeenCalledTimes(2);
    expect(window.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
    lifecycle.setInteractive(true);
    expect(window.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
    lifecycle.hide();
    expect(window.hide).toHaveBeenCalledOnce();
    lifecycle.beginQuit(); lifecycle.show();
    expect(window.destroy).toHaveBeenCalledOnce();
    expect(window.showInactive).toHaveBeenCalledTimes(2);
  });
});
