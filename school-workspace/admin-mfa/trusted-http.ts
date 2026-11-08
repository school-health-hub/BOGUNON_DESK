import { z } from "zod";
import {
  AdminMfaContractError,
  completeAdminMfa,
  type TrustedServerDependencies,
} from "./trusted-server.js";

const MAX_BODY_BYTES = 2_048;
const VerifyBodySchema = z.object({
  intentId: z.string().uuid(),
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
}).strict();
const CancelBodySchema = z.object({ intentId: z.string().uuid() }).strict();

type CancelInput = {
  readonly accessToken: string;
  readonly intentId: string;
};

type TrustedMfaHttpDependencies = {
  readonly createDependencies: (accessToken: string) => TrustedServerDependencies;
  readonly cancel: (input: CancelInput) => Promise<void>;
  readonly gate: InMemoryIntentGate;
};

class HttpBoundaryError extends Error {
  readonly name = "HttpBoundaryError";

  constructor(readonly status: number, readonly code: string, options?: ErrorOptions) {
    super(code, options);
  }
}

export class InMemoryIntentGate {
  private readonly active = new Set<string>();

  async run<T>(intentId: string, action: () => Promise<T>): Promise<T> {
    if (this.active.has(intentId)) throw new HttpBoundaryError(409, "REQUEST_IN_FLIGHT");
    this.active.add(intentId);
    try {
      return await action();
    } finally {
      this.active.delete(intentId);
    }
  }
}

function json(status: number, code: string, extra?: Readonly<Record<string, string>>) {
  return Response.json({ code, ...extra }, { status });
}

function bearer(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? "");
  if (!match?.[1]) throw new HttpBoundaryError(401, "UNAUTHORIZED");
  return match[1];
}

async function body(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpBoundaryError(415, "JSON_REQUIRED");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new HttpBoundaryError(413, "BODY_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpBoundaryError(413, "BODY_TOO_LARGE");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) throw new HttpBoundaryError(400, "INVALID_JSON");
    throw error;
  }
}

export function createTrustedMfaHandler(dependencies: TrustedMfaHttpDependencies) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      if (request.method !== "POST") throw new HttpBoundaryError(405, "METHOD_NOT_ALLOWED");
      const accessToken = bearer(request);
      if (url.pathname === "/trusted-mfa/v1/cancel") {
        const parsed = CancelBodySchema.parse(await body(request));
        try {
          await dependencies.cancel({ accessToken, intentId: parsed.intentId });
        } catch (error) {
          throw new HttpBoundaryError(503, "CANCEL_FAILED", { cause: error });
        }
        return new Response(null, { status: 204 });
      }
      if (url.pathname !== "/trusted-mfa/v1/verify") throw new HttpBoundaryError(404, "NOT_FOUND");
      const parsed = VerifyBodySchema.parse(await body(request));
      const result = await dependencies.gate.run(parsed.intentId, () => completeAdminMfa({
        accessToken,
        intentId: parsed.intentId,
        factorId: parsed.factorId,
        code: parsed.code,
      }, dependencies.createDependencies(accessToken)));
      return Response.json({ accessToken: result.accessToken });
    } catch (error) {
      if (error instanceof HttpBoundaryError) return json(error.status, error.code);
      if (error instanceof z.ZodError) return json(400, "INVALID_REQUEST");
      if (error instanceof AdminMfaContractError) return json(401, error.code);
      return json(401, "MFA_VERIFICATION_FAILED");
    }
  };
}
