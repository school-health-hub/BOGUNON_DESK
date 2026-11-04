import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const styleSheet = readFileSync(
  resolve(repositoryRoot, "electron-p0", "renderer", "soft-rose.css"),
  "utf8",
);
const designStandard = readFileSync(resolve(repositoryRoot, "DESIGN.md"), "utf8");

describe("TD2 Soft Rose Glass design contract", () => {
  it("keeps the approved glass material and desktop tokens", () => {
    expect(styleSheet).toContain("--rose-blur:18px");
    expect(styleSheet).toContain("--rose-desktop:");
    expect(styleSheet).toContain("--rose-glass:linear-gradient");
    expect(styleSheet).toContain("--rose-top-highlight:");
    expect(styleSheet).toContain("backdrop-filter:blur(20px) saturate(135%)");
  });

  it("keeps the approved 1280 by 800 overflow protections", () => {
    expect(styleSheet).toContain(
      "@media(max-width:1300px) and (min-width:901px) and (max-height:820px)",
    );
    expect(styleSheet).toContain(
      "[data-widget-type=monthly-calendar] .calendar-panel{overflow:hidden}",
    );
    expect(styleSheet).toContain(
      "[data-widget-type=quick-memo] fieldset{box-sizing:border-box;height:auto!important;overflow:visible!important}",
    );
    expect(styleSheet).toContain(
      "[data-widget-type=quick-launcher] .quick-launcher{overflow:hidden;padding-block:4px}",
    );
    expect(styleSheet).toContain(
      ".quick-launcher__folders{flex-shrink:0;overflow:visible;padding-top:0}",
    );
  });

  it("records the approved standard and prohibited regressions", () => {
    expect(designStandard).toContain(
      "TD2 Soft Rose Glass — approved Electron P0 standard",
    );
    expect(designStandard).toContain("Prohibited visual regressions");
    expect(designStandard).toContain("Windows Portable or OS-level DPI approval");
  });
});
