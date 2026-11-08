import { z } from "zod";

const VerifyInputSchema = z.object({
  accessToken: z.string().min(1),
  intentId: z.string().uuid(),
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
}).strict();
const CancelInputSchema = z.object({
  accessToken: z.string().min(1),
  intentId: z.string().uuid(),
}).strict();
const VerifyResponseSchema = z.object({ accessToken: z.string().min(1) }).strict();

type TrustedMfaClientConfig = {
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
};

export class TrustedMfaClientError extends Error {
  readonly name = "TrustedMfaClientError";

  constructor(readonly status: number, options?: ErrorOptions) {
    super("TRUSTED_MFA_REQUEST_FAILED", options);
  }
}

export class TrustedMfaClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: TrustedMfaClientConfig) {
    this.baseUrl = new URL(config.baseUrl).origin;
    this.fetcher = config.fetcher ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  private async post(path: string, accessToken: string, payload: Readonly<Record<string, string>>) {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new TrustedMfaClientError(response.status);
    return response;
  }

  async verify(rawInput: unknown) {
    const input = VerifyInputSchema.parse(rawInput);
    const response = await this.post("/trusted-mfa/v1/verify", input.accessToken, {
      intentId: input.intentId,
      factorId: input.factorId,
      code: input.code,
    });
    return VerifyResponseSchema.parse(await response.json());
  }

  async cancel(rawInput: unknown) {
    const input = CancelInputSchema.parse(rawInput);
    await this.post("/trusted-mfa/v1/cancel", input.accessToken, { intentId: input.intentId });
  }
}
