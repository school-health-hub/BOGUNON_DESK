import { loadDesktopSettings, saveOnboardingVersion } from "../desktop/storage";

export const ONBOARDING_VERSION = 1;

type OnboardingRepository = {
  readonly loadVersion: () => number;
  readonly saveVersion: (version: number) => void;
};

export const createOnboardingService = (repository: OnboardingRepository) => ({
  shouldShow: (): boolean => repository.loadVersion() < ONBOARDING_VERSION,
  complete: (): void => repository.saveVersion(ONBOARDING_VERSION),
});

export const onboardingService = createOnboardingService({
  loadVersion: () => loadDesktopSettings().onboardingVersion,
  saveVersion: saveOnboardingVersion,
});
