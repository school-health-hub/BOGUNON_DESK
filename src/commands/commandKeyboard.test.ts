import { describe, expect, it, vi } from "vitest";
import {
  handleCommandPaletteShortcut,
  isCommandPaletteShortcut,
  resolveCommandKey,
  updateCommandQuery,
} from "./commandKeyboard";

describe("command palette keyboard", () => {
  it("recognizes Ctrl+K without accepting unrelated modifiers", () => {
    expect(isCommandPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
    expect(isCommandPaletteShortcut({ key: "K", ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
    expect(isCommandPaletteShortcut({ key: "k", ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
    expect(isCommandPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: true })).toBe(false);
  });

  it("prevents the browser shortcut and opens or refocuses the palette", () => {
    const preventDefault = vi.fn();
    const onOpen = vi.fn();
    const onFocus = vi.fn();
    const event = { key: "k", ctrlKey: true, metaKey: false, altKey: false, preventDefault };

    expect(handleCommandPaletteShortcut(event, { isOpen: false, onOpen, onFocus })).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();
    handleCommandPaletteShortcut(event, { isOpen: true, onOpen, onFocus });
    expect(onFocus).toHaveBeenCalledOnce();
  });

  it("resets the active result when the query changes", () => {
    expect(updateCommandQuery("추가")).toEqual({ query: "추가", activeIndex: 0 });
  });

  it("closes on Escape and wraps ArrowDown/ArrowUp", () => {
    expect(resolveCommandKey("Escape", 0, 4)).toEqual({ type: "close" });
    expect(resolveCommandKey("ArrowDown", 3, 4)).toEqual({ type: "move", index: 0 });
    expect(resolveCommandKey("ArrowUp", 0, 4)).toEqual({ type: "move", index: 3 });
  });

  it("executes the active result on Enter and ignores Enter with no results", () => {
    expect(resolveCommandKey("Enter", 2, 4)).toEqual({ type: "execute", index: 2 });
    expect(resolveCommandKey("Enter", 0, 0)).toEqual({ type: "none" });
  });
});
