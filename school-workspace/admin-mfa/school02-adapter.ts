import { z } from "zod";
import type {
  AdminMfaAttempt,
  SchoolAdminMfaPort,
} from "../school02/core/controller.js";
import { TrustedMfaClient } from "./trusted-client.js";

const AttemptSchema = z.object({
  intentId: z.string().uuid(),
  factorId: z.string().uuid(),
  schoolId: z.string().uuid(),
  purpose: z.enum(["propose", "accept"]),
  expiresAt: z.number().int().positive(),
}).strict();

export interface TrustedAdminMfaBackend {
  begin(
    accessToken: string,
    input: Readonly<{
      schoolId: string;
      purpose: "propose" | "accept";
      targetId: string;
      mode?: string;
      version?: number;
    }>,
    signal: AbortSignal,
  ): Promise<unknown>;
  execute(accessToken: string, attempt: AdminMfaAttempt, signal: AbortSignal): Promise<void>;
}

export interface AuthorizedSession {
  authorized<T>(operation: (accessToken: string, signal: AbortSignal) => Promise<T>): Promise<T>;
}

function ownedSignal(signal: AbortSignal, authSignal: AbortSignal) {
  return AbortSignal.any([signal, authSignal]);
}

export function createSchoolAdminMfaPort(
  auth: AuthorizedSession,
  trustedClient: TrustedMfaClient,
  backend: TrustedAdminMfaBackend,
): SchoolAdminMfaPort {
  return {
    start: (input, signal) => auth.authorized((accessToken, authSignal) => backend.begin(
      accessToken,
      input,
      ownedSignal(signal, authSignal),
    ).then(rawAttempt => AttemptSchema.parse(rawAttempt))),
    verify: (attempt, code, signal) => auth.authorized(async (accessToken, authSignal) => {
      await trustedClient.verify({
        accessToken,
        intentId: attempt.intentId,
        factorId: attempt.factorId,
        code,
      }, ownedSignal(signal, authSignal));
      return { verified: true as const };
    }),
    execute: (attempt, signal) => auth.authorized((accessToken, authSignal) => backend.execute(
      accessToken,
      attempt,
      ownedSignal(signal, authSignal),
    )),
    cancel: (attempt, signal) => auth.authorized(async (accessToken, authSignal) => {
      await trustedClient.cancel({ accessToken, intentId: attempt.intentId }, ownedSignal(signal, authSignal));
    }),
  };
}
