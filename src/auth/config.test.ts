import { describe, expect, it } from "vitest";
import {
  AuthConfigurationError,
  PRODUCTION_SUPABASE_ORIGIN,
  parseSupabaseAuthConfig,
} from "./config";

describe("parseSupabaseAuthConfig", () => {
  it("accepts an https project URL and publishable key", () => {
    expect(parseSupabaseAuthConfig(`${PRODUCTION_SUPABASE_ORIGIN}/`, "sb_publishable_example"))
      .toEqual({ url: PRODUCTION_SUPABASE_ORIGIN, publishableKey: "sb_publishable_example" });
  });

  it("accepts a legacy anon JWT", () => {
    const payload = btoa(JSON.stringify({ role: "anon" })).replace(/=/g, "");
    const key = `header.${payload}.signature`;
    expect(parseSupabaseAuthConfig(PRODUCTION_SUPABASE_ORIGIN, key))
      .toEqual({ url: PRODUCTION_SUPABASE_ORIGIN, publishableKey: key });
  });

  it("rejects a different Supabase project origin", () => {
    expect(() => parseSupabaseAuthConfig("https://other-project.supabase.co", "sb_publishable_example"))
      .toThrow(AuthConfigurationError);
  });

  it("rejects missing config and secret keys", () => {
    expect(() => parseSupabaseAuthConfig(undefined, undefined)).toThrow(AuthConfigurationError);
    expect(() => parseSupabaseAuthConfig(PRODUCTION_SUPABASE_ORIGIN, "sb_secret_example"))
      .toThrow(AuthConfigurationError);
    expect(() => parseSupabaseAuthConfig(PRODUCTION_SUPABASE_ORIGIN, "arbitrary-key"))
      .toThrow(AuthConfigurationError);
  });

  it("rejects legacy service-role JWTs", () => {
    const payload = btoa(JSON.stringify({ role: "service_role" })).replace(/=/g, "");
    expect(() => parseSupabaseAuthConfig(PRODUCTION_SUPABASE_ORIGIN, `header.${payload}.signature`))
      .toThrow(AuthConfigurationError);
  });
});
