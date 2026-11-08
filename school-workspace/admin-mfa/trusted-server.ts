import { z } from "zod";

const UserIdSchema = z.string().uuid().brand("UserId");
const SessionIdSchema = z.string().uuid().brand("SessionId");
const IntentIdSchema = z.string().uuid().brand("IntentId");
const FactorIdSchema = z.string().uuid().brand("FactorId");
const ChallengeIdSchema = z.string().uuid().brand("ChallengeId");
const AccessTokenSchema = z.string().min(1).brand("AccessToken");

const AdminMfaRequestSchema = z.object({
  accessToken: AccessTokenSchema,
  intentId: IntentIdSchema,
  factorId: FactorIdSchema,
  code: z.string().regex(/^\d{6}$/),
}).strict();

const VerifiedClaimsSchema = z.object({
  sub: UserIdSchema,
  session_id: SessionIdSchema,
  aal: z.enum(["aal1", "aal2"]),
  aud: z.literal("authenticated"),
  iss: z.string().url(),
  exp: z.number().int().positive(),
}).passthrough();

const ChallengeResponseSchema = z.object({ id: ChallengeIdSchema }).strict();
const VerifyResponseSchema = z.object({ accessToken: AccessTokenSchema }).strict();

type AccessToken = z.infer<typeof AccessTokenSchema>;
type UserId = z.infer<typeof UserIdSchema>;
type SessionId = z.infer<typeof SessionIdSchema>;
type IntentId = z.infer<typeof IntentIdSchema>;
type FactorId = z.infer<typeof FactorIdSchema>;
type ChallengeId = z.infer<typeof ChallengeIdSchema>;

type BoundProof = {
  readonly intentId: IntentId;
  readonly userId: UserId;
  readonly sessionId: SessionId;
  readonly factorId: FactorId;
  readonly challengeId: ChallengeId;
};

interface VerifiedTokenService {
  readonly expectedIssuer: string;
  verify(accessToken: AccessToken): Promise<unknown>;
}

interface MfaProvider {
  challenge(input: { readonly accessToken: AccessToken; readonly factorId: FactorId }): Promise<unknown>;
  verify(input: {
    readonly accessToken: AccessToken;
    readonly factorId: FactorId;
    readonly challengeId: ChallengeId;
    readonly code: string;
  }): Promise<unknown>;
}

interface IntentProofStore {
  bind(proof: BoundProof): Promise<void>;
  attest(proof: BoundProof): Promise<void>;
  reject(proof: BoundProof): Promise<void>;
}

type TrustedServerDependencies = {
  readonly tokens: VerifiedTokenService;
  readonly provider: MfaProvider;
  readonly proofs: IntentProofStore;
};

const ERROR_CODES = [
  "TOKEN_EXPIRED",
  "ISSUER_MISMATCH",
  "USER_MISMATCH",
  "SESSION_MISMATCH",
  "AAL2_REQUIRED",
  "PROOF_REJECTION_FAILED",
] as const;
type AdminMfaContractErrorCode = (typeof ERROR_CODES)[number];

export class AdminMfaContractError extends Error {
  readonly name = "AdminMfaContractError";

  constructor(readonly code: AdminMfaContractErrorCode, options?: ErrorOptions) {
    super(code, options);
  }
}

function verifyClaims(rawClaims: unknown, expectedIssuer: string) {
  const claims = VerifiedClaimsSchema.parse(rawClaims);
  if (claims.exp <= Math.floor(Date.now() / 1000)) throw new AdminMfaContractError("TOKEN_EXPIRED");
  if (claims.iss !== expectedIssuer) throw new AdminMfaContractError("ISSUER_MISMATCH");
  return claims;
}

export async function completeAdminMfa(
  rawRequest: unknown,
  dependencies: TrustedServerDependencies,
): Promise<{ readonly accessToken: AccessToken }> {
  const request = AdminMfaRequestSchema.parse(rawRequest);
  const initialClaims = verifyClaims(
    await dependencies.tokens.verify(request.accessToken),
    dependencies.tokens.expectedIssuer,
  );
  const challenge = ChallengeResponseSchema.parse(await dependencies.provider.challenge({
    accessToken: request.accessToken,
    factorId: request.factorId,
  }));
  const proof = {
    intentId: request.intentId,
    userId: initialClaims.sub,
    sessionId: initialClaims.session_id,
    factorId: request.factorId,
    challengeId: challenge.id,
  } satisfies BoundProof;

  await dependencies.proofs.bind(proof);
  try {
    const verified = VerifyResponseSchema.parse(await dependencies.provider.verify({
      accessToken: request.accessToken,
      factorId: request.factorId,
      challengeId: challenge.id,
      code: request.code,
    }));
    const verifiedClaims = verifyClaims(
      await dependencies.tokens.verify(verified.accessToken),
      dependencies.tokens.expectedIssuer,
    );
    if (verifiedClaims.sub !== initialClaims.sub) throw new AdminMfaContractError("USER_MISMATCH");
    if (verifiedClaims.session_id !== initialClaims.session_id) {
      throw new AdminMfaContractError("SESSION_MISMATCH");
    }
    if (verifiedClaims.aal !== "aal2") throw new AdminMfaContractError("AAL2_REQUIRED");
    await dependencies.proofs.attest(proof);
    return { accessToken: verified.accessToken };
  } catch (error) {
    try {
      await dependencies.proofs.reject(proof);
    } catch (rejectionError) {
      throw new AdminMfaContractError("PROOF_REJECTION_FAILED", { cause: rejectionError });
    }
    throw error;
  }
}
