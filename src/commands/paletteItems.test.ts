import { describe, expect, it } from "vitest";
import { commandRegistry } from "./commandRegistry";
import { buildPaletteItems, clampPaletteActiveIndex, executePaletteItem } from "./paletteItems";
import { vi } from "vitest";

describe("command palette mixed items", () => {
  it("keeps commands before dynamic task and event results", () => {
    const items = buildPaletteItems([commandRegistry.bogunon], [], {
      status: "ready",
      items: [
        { kind: "task", id: "task-1", title: "업무", date: null, secondary: "업무 · 예정" },
        { kind: "event", id: "event-1", title: "일정", date: "2026-09-18", secondary: "일정 · 9.18" },
      ],
    });
    expect(items.map((item) => item.kind)).toEqual(["command", "task", "event"]);
  });

  it("clamps selection when asynchronous results shrink", () => {
    expect(clampPaletteActiveIndex(5, 2)).toBe(1);
    expect(clampPaletteActiveIndex(2, 0)).toBe(0);
  });

  it("executes command and dynamic results through separate handlers", async () => {
    const runCommand = vi.fn(async () => undefined);
    const runSearchResult = vi.fn(async () => undefined);
    const runFolder = vi.fn(async () => undefined);
    const task = { kind: "task", id: "task-1", title: "업무", date: null, secondary: "업무 · 예정" } as const;

    await executePaletteItem({ kind: "command", command: commandRegistry.bogunon }, { runCommand, runFolder, runSearchResult });
    await executePaletteItem(task, { runCommand, runFolder, runSearchResult });

    expect(runCommand).toHaveBeenCalledWith(commandRegistry.bogunon);
    expect(runSearchResult).toHaveBeenCalledWith(task);
  });
});
