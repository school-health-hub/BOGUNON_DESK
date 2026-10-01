import type { DesktopSettings } from "./types";

const DESKTOP_SETTINGS_KEY = "school-health-desk.desktop-settings.v1";
const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = { closeToTray: true, onboardingVersion: 0 };

const parseOnboardingVersion = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;

export const loadDesktopSettings = (): DesktopSettings => {
  try {
    const raw = localStorage.getItem(DESKTOP_SETTINGS_KEY);
    if (raw === null) return DEFAULT_DESKTOP_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object"
      && parsed !== null
      && "closeToTray" in parsed
      && typeof parsed.closeToTray === "boolean"
    ) {
      return {
        closeToTray: parsed.closeToTray,
        onboardingVersion: "onboardingVersion" in parsed
          ? parseOnboardingVersion(parsed.onboardingVersion)
          : 0,
      };
    }
    return DEFAULT_DESKTOP_SETTINGS;
  } catch (error) {
    if (error instanceof SyntaxError) return DEFAULT_DESKTOP_SETTINGS;
    throw error;
  }
};

export const saveDesktopSettings = (settings: DesktopSettings): void => {
  localStorage.setItem(DESKTOP_SETTINGS_KEY, JSON.stringify(settings));
};

export const saveCloseToTraySetting = (closeToTray: boolean): void => {
  saveDesktopSettings({ ...loadDesktopSettings(), closeToTray });
};

export const saveOnboardingVersion = (onboardingVersion: number): void => {
  saveDesktopSettings({ ...loadDesktopSettings(), onboardingVersion });
};
