import { expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OnboardingStore, validateOnboardingState } from '../main/onboarding';

it('stores the one-time guide marker separately from existing layout and memo data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onboarding-'));
  const layout = join(root, 'layout.json');
  await writeFile(layout, '{"synthetic":"unchanged"}');
  const store = new OnboardingStore(root);
  expect(await store.read()).toBeNull();
  await store.write(true);
  expect(await new OnboardingStore(root).read()).toEqual({ version: 1, completed: true });
  expect(await readFile(layout, 'utf8')).toBe('{"synthetic":"unchanged"}');
});

it('rejects invalid marker fields without broadening the saved settings schema', () => {
  expect(() => validateOnboardingState({ version: 1, completed: true, token: 'synthetic' })).toThrow();
  expect(() => validateOnboardingState({ version: 2, completed: false })).toThrow();
});
