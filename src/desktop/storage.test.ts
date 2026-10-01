import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadDesktopSettings,
  saveCloseToTraySetting,
  saveOnboardingVersion,
} from "./storage";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  });
});

describe("desktop device settings storage", () => {
  it("loads legacy close-to-tray data with onboarding incomplete", () => {
    values.set("school-health-desk.desktop-settings.v1", JSON.stringify({ closeToTray: false }));

    expect(loadDesktopSettings()).toEqual({ closeToTray: false, onboardingVersion: 0 });
  });

  it("preserves close-to-tray when onboarding completion is saved", () => {
    values.set("school-health-desk.desktop-settings.v1", JSON.stringify({ closeToTray: false }));

    saveOnboardingVersion(1);

    expect(loadDesktopSettings()).toEqual({ closeToTray: false, onboardingVersion: 1 });
  });

  it("preserves onboarding completion when close-to-tray changes", () => {
    values.set("school-health-desk.desktop-settings.v1", JSON.stringify({ closeToTray: true, onboardingVersion: 1 }));

    saveCloseToTraySetting(false);

    expect(loadDesktopSettings()).toEqual({ closeToTray: false, onboardingVersion: 1 });
  });
});
