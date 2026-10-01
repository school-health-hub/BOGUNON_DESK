import { describe, expect, it } from "vitest";
import { STARTUP_UPDATE_CHECK_INTERVAL_MS, shouldRunStartupCheck } from "./updaterCheckPolicy";

describe("startup updater check policy", () => {
  it("skips the native check when the previous attempt is less than 24 hours old", () => {
    const now = Date.UTC(2026, 8, 29, 13, 0);

    expect(shouldRunStartupCheck(now - STARTUP_UPDATE_CHECK_INTERVAL_MS + 1, now)).toBe(false);
  });

  it("runs the native check at the 24-hour boundary", () => {
    const now = Date.UTC(2026, 8, 29, 13, 0);

    expect(shouldRunStartupCheck(now - STARTUP_UPDATE_CHECK_INTERVAL_MS, now)).toBe(true);
    expect(shouldRunStartupCheck(null, now)).toBe(true);
  });
});
