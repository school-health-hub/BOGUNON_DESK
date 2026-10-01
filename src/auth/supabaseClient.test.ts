import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: { auth: {} },
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("./config", () => ({
  getSupabaseAuthConfig: () => ({
    publishableKey: "sb_publishable_example",
    url: "https://xxownwxxajzrviuvvfiu.supabase.co",
  }),
}));
vi.mock("./secureSessionStorage", () => ({ secureSessionStorage: { getItem: vi.fn() } }));

describe("getSupabaseClient", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createClient.mockReset().mockReturnValue(mocks.client);
  });

  it("enables correlated PKCE callback flow identifiers", async () => {
    const { getSupabaseClient } = await import("./supabaseClient");

    expect(getSupabaseClient()).toBe(mocks.client);
    expect(getSupabaseClient()).toBe(mocks.client);
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://xxownwxxajzrviuvvfiu.supabase.co",
      "sb_publishable_example",
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          experimental: { appendPkceFlowIdToRedirects: true },
          flowType: "pkce",
          persistSession: true,
          storage: expect.any(Object),
        },
      },
    );
  });
});
