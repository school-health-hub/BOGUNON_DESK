import { z } from "zod";
import type {
  BoundProof,
  IntentProofStore,
  MfaProvider,
  VerifiedTokenService,
} from "./trusted-server.js";

const ClaimsIdentitySchema = z.object({
  sub: z.string().uuid(),
  session_id: z.string().uuid(),
}).passthrough();
const ChallengeSchema = z.object({ id: z.string().uuid() }).passthrough();
const VerifySchema = z.object({ access_token: z.string().min(1) }).passthrough();

export class SupabaseMfaAdapterError extends Error {
  readonly name = "SupabaseMfaAdapterError";

  constructor(readonly code: "AUTH_PROVIDER_REJECTED" | "TOKEN_VERIFICATION_FAILED" | "SESSION_NOT_LIVE") {
    super(code);
  }
}

type MfaProviderConfig = {
  readonly origin: string;
  readonly publishableKey: string;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
};

export class SupabaseAuthMfaProvider implements MfaProvider {
  private readonly origin: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: MfaProviderConfig) {
    this.origin = new URL(config.origin).origin;
    this.fetcher = config.fetcher ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  private async post(path: string, accessToken: string, payload: Readonly<Record<string, string>>) {
    const response = await this.fetcher(`${this.origin}${path}`, {
      method: "POST",
      headers: {
        apikey: this.config.publishableKey,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new SupabaseMfaAdapterError("AUTH_PROVIDER_REJECTED");
    return response.json();
  }

  async challenge(input: { readonly accessToken: string; readonly factorId: string }) {
    return ChallengeSchema.parse(await this.post(
      `/auth/v1/factors/${encodeURIComponent(input.factorId)}/challenge`,
      input.accessToken,
      { factorId: input.factorId },
    ));
  }

  async verify(input: {
    readonly accessToken: string;
    readonly factorId: string;
    readonly challengeId: string;
    readonly code: string;
  }) {
    const result = VerifySchema.parse(await this.post(
      `/auth/v1/factors/${encodeURIComponent(input.factorId)}/verify`,
      input.accessToken,
      { challenge_id: input.challengeId, code: input.code },
    ));
    return { accessToken: result.access_token };
  }
}

export interface AuthClaimsApi {
  getClaims(jwt: string): Promise<{ readonly data: { readonly claims?: unknown } | null; readonly error: unknown | null }>;
  getUser(jwt: string): Promise<{
    readonly data: { readonly user: { readonly id: string } | null };
    readonly error: unknown | null;
  }>;
}

export interface LiveSessionProbe {
  isLive(input: { readonly userId: string; readonly sessionId: string }): Promise<boolean>;
}

type VerifiedTokenConfig = {
  readonly auth: AuthClaimsApi;
  readonly liveSessions: LiveSessionProbe;
  readonly expectedIssuer: string;
};

export class SupabaseVerifiedTokenService implements VerifiedTokenService {
  readonly expectedIssuer: string;

  constructor(private readonly config: VerifiedTokenConfig) {
    this.expectedIssuer = config.expectedIssuer;
  }

  async verify(accessToken: string) {
    const [{ data: claimsData, error: claimsError }, { data: userData, error: userError }] = await Promise.all([
      this.config.auth.getClaims(accessToken),
      this.config.auth.getUser(accessToken),
    ]);
    if (claimsError || userError || !claimsData?.claims || !userData.user) {
      throw new SupabaseMfaAdapterError("TOKEN_VERIFICATION_FAILED");
    }
    const claims = ClaimsIdentitySchema.parse(claimsData.claims);
    if (claims.sub !== userData.user.id) throw new SupabaseMfaAdapterError("TOKEN_VERIFICATION_FAILED");
    if (!await this.config.liveSessions.isLive({ userId: claims.sub, sessionId: claims.session_id })) {
      throw new SupabaseMfaAdapterError("SESSION_NOT_LIVE");
    }
    return claimsData.claims;
  }
}

export type ParameterizedQuery = {
  readonly text: string;
  readonly values: readonly string[];
};

export interface VerifierDatabase {
  executeVerifier(query: ParameterizedQuery): Promise<void>;
  executeUser(query: ParameterizedQuery, accessToken: string): Promise<void>;
  queryBoolean(query: ParameterizedQuery): Promise<boolean>;
}

export class SqlLiveSessionProbe implements LiveSessionProbe {
  constructor(private readonly database: VerifierDatabase) {}

  isLive(input: { readonly userId: string; readonly sessionId: string }) {
    return this.database.queryBoolean({
      text: "SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id=$1::uuid AND user_id=$2::uuid AND (not_after IS NULL OR not_after>statement_timestamp()))",
      values: [input.sessionId, input.userId],
    });
  }
}

export class SqlIntentProofStore implements IntentProofStore {
  constructor(private readonly database: VerifierDatabase, private readonly accessToken: string) {}

  bind(proof: BoundProof) {
    return this.database.executeVerifier({
      text: "SELECT workspace_admin_mfa.bind_factor($1::uuid,$2::uuid,$3::uuid,$4::uuid)",
      values: [proof.intentId, proof.userId, proof.sessionId, proof.challengeId],
    });
  }

  attest(proof: BoundProof) {
    return this.database.executeVerifier({
      text: "SELECT workspace_admin_mfa.attest_factor($1::uuid,$2::uuid,$3::uuid,$4::uuid)",
      values: [proof.intentId, proof.userId, proof.sessionId, proof.challengeId],
    });
  }

  reject(proof: BoundProof) {
    return this.cancelIntent(proof.intentId);
  }

  cancelIntent(intentId: string) {
    return this.database.executeUser({
      text: "SELECT workspace_admin_mfa.cancel_intent($1::uuid)",
      values: [intentId],
    }, this.accessToken);
  }
}
