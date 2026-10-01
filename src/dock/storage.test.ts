import { describe, expect, it } from "vitest";
import { parseDockLayoutValue } from "./storage";

describe("Dock persistence compatibility", () => {
  it("keeps top-level preferences while removing legacy detailed tools", () => {
    expect(parseDockLayoutValue({
      version: 2,
      items: [
        { id: "settings", visible: false },
        { id: "aed-check", visible: true },
        { id: "home", visible: true },
        { id: "record-helper", visible: true },
        { id: "toolbox", visible: false },
        { id: "checkup-tools", visible: true },
      ],
    })).toEqual({
      version: 2,
      items: [
        { id: "settings", visible: false },
        { id: "home", visible: true },
        { id: "toolbox", visible: false },
        { id: "online-health-room", visible: true },
        { id: "bogunon", visible: true },
        { id: "work-folder", visible: true },
        { id: "quick-memo", visible: true },
        { id: "official-document", visible: false },
      ],
    });
  });

  it("preserves an enabled optional official document item across reloads", () => {
    expect(parseDockLayoutValue({
      version: 2,
      items: [
        { id: "official-document", visible: true },
        { id: "home", visible: true },
      ],
    })?.items.slice(0, 2)).toEqual([
      { id: "official-document", visible: true },
      { id: "home", visible: true },
    ]);
  });
});
