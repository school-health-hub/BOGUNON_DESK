import { describe, expect, it, vi } from "vitest";
import { createOnboardingService, ONBOARDING_VERSION } from "./onboardingService";

describe("onboarding service", () => {
  it("shows onboarding when this PC has not completed the current version", () => {
    const service = createOnboardingService({
      loadVersion: vi.fn(() => 0),
      saveVersion: vi.fn(),
    });

    expect(service.shouldShow()).toBe(true);
  });

  it("keeps onboarding dismissed after completing the current version", () => {
    let storedVersion = 0;
    const service = createOnboardingService({
      loadVersion: () => storedVersion,
      saveVersion: (version) => { storedVersion = version; },
    });

    service.complete();

    expect(storedVersion).toBe(ONBOARDING_VERSION);
    expect(service.shouldShow()).toBe(false);
  });
});
