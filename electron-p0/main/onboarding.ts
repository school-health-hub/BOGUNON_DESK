import { SettingsStore } from './settings.js';

export type OnboardingState = Readonly<{ version: 1; completed: boolean }>;

export function validateOnboardingState(value: unknown): OnboardingState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid onboarding state');
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).length !== 2 || candidate.version !== 1 || typeof candidate.completed !== 'boolean') throw new Error('Invalid onboarding state');
  return { version: 1, completed: candidate.completed };
}

export class OnboardingStore {
  private readonly store: SettingsStore<OnboardingState>;
  constructor(root: string) { this.store = new SettingsStore(root, 'onboarding.json', validateOnboardingState); }
  read(): Promise<OnboardingState | null> { return this.store.read(); }
  write(completed: boolean): Promise<void> { return this.store.write({ version: 1, completed }); }
  flush(): Promise<void> { return this.store.flush(); }
}
