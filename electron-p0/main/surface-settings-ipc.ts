import { assertSender } from './policy.js';
import type { SurfaceSettingsAuthority } from './surface-settings-authority.js';
import { validateSettings } from './settings.js';

type Sender = Parameters<typeof assertSender>[0];
type Actor = Readonly<{ contents: Parameters<typeof assertSender>[1]; url: string }>;

export function createSurfaceSettingsHandlers(actors: readonly Actor[], authority: SurfaceSettingsAuthority) {
  const authorize = (event: Sender): void => {
    const actor = actors.find(item => item.contents === event.sender);
    if (!actor) throw new Error('Settings sender is not allowed');
    assertSender(event, actor.contents, actor.url);
  };
  return {
    read: async (event: Sender, ...args: readonly unknown[]) => {
      authorize(event);
      if (args.length) throw new Error('Invalid settings read');
      return authority.read();
    },
    write: async (event: Sender, ...args: readonly unknown[]) => {
      authorize(event);
      const request = args[0];
      if (args.length !== 1 || typeof request !== 'object' || request === null || !('revision' in request) || !('value' in request)
        || Object.keys(request).some(key => key !== 'revision' && key !== 'value') || typeof request.revision !== 'number') throw new Error('Invalid settings change');
      // The persistence boundary validates the existing versioned document.
      return authority.write({ revision: request.revision, value: validateSettings(request.value) });
    },
  };
}
