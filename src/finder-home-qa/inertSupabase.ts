import { FinderQaBlockedError } from './inertConnections';

// Pure library validation imports searchService; never bundle its real auth client.
export function getSupabaseClient(): never {
  throw new FinderQaBlockedError();
}
