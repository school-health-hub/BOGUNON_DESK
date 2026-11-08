import type { AuthClaimsApi, VerifierDatabase } from "./supabase-adapters.js";
import {
  SqlIntentProofStore,
  SqlLiveSessionProbe,
  SupabaseAuthMfaProvider,
  SupabaseVerifiedTokenService,
} from "./supabase-adapters.js";
import { createTrustedMfaHandler, InMemoryIntentGate } from "./trusted-http.js";

type TrustedMfaRuntimeConfig = {
  readonly origin: string;
  readonly publishableKey: string;
  readonly auth: AuthClaimsApi;
  readonly database: VerifierDatabase;
  readonly fetcher?: typeof fetch;
};

export function createSupabaseTrustedMfaHandler(config: TrustedMfaRuntimeConfig) {
  const origin = new URL(config.origin).origin;
  const provider = new SupabaseAuthMfaProvider({
    origin,
    publishableKey: config.publishableKey,
    ...(config.fetcher ? { fetcher: config.fetcher } : {}),
  });
  const tokens = new SupabaseVerifiedTokenService({
    auth: config.auth,
    liveSessions: new SqlLiveSessionProbe(config.database),
    expectedIssuer: `${origin}/auth/v1`,
  });
  return createTrustedMfaHandler({
    gate: new InMemoryIntentGate(),
    createDependencies: accessToken => ({
      tokens,
      provider,
      proofs: new SqlIntentProofStore(config.database, accessToken),
    }),
    cancel: ({ accessToken, intentId }) => new SqlIntentProofStore(
      config.database,
      accessToken,
    ).cancelIntent(intentId),
  });
}
