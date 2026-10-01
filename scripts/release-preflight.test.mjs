import { describe, expect, it } from "vitest";
import {
  parseCargoVersion,
  parseDotEnv,
  validateReleaseConfiguration,
} from "./release-preflight.mjs";

const validVersions = {
  packageVersion: "0.1.0",
  tauriVersion: "0.1.0",
  cargoVersion: "0.1.0",
};

const productionOrigin = "https://xxownwxxajzrviuvvfiu.supabase.co";
const validConfiguration = {
  ...validVersions,
  supabaseUrl: productionOrigin,
  supabaseKey: "sb_publishable_example",
  expectedSupabaseOrigin: productionOrigin,
  cspConnectSrc: `'self' ${productionOrigin}`,
  devCspConnectSrc: `'self' ws://localhost:1420 ${productionOrigin}`,
};

describe("release preflight", () => {
  it("accepts matching versions and public Supabase configuration", () => {
    expect(() => validateReleaseConfiguration({
      ...validConfiguration,
    })).not.toThrow();
  });

  it("accepts a legacy anon JWT", () => {
    const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
    expect(() => validateReleaseConfiguration({
      ...validConfiguration,
      supabaseKey: `header.${payload}.signature`,
    })).not.toThrow();
  });

  it("rejects version drift", () => {
    expect(() => validateReleaseConfiguration({
      ...validVersions,
      ...validConfiguration,
      cargoVersion: "0.1.1",
    })).toThrow("버전이 일치하지 않습니다");
  });

  it.each([
    ["missing config", "", ""],
    ["non-https URL", "http://xxownwxxajzrviuvvfiu.supabase.co", "sb_publishable_example"],
    ["wrong project URL", "https://another-project.supabase.co", "sb_publishable_example"],
    ["secret key", productionOrigin, "sb_secret_example"],
    ["unknown key format", productionOrigin, "arbitrary-key"],
  ])("rejects %s", (_label, supabaseUrl, supabaseKey) => {
    expect(() => validateReleaseConfiguration({
      ...validConfiguration,
      supabaseUrl,
      supabaseKey,
    })).toThrow();
  });

  it("rejects a legacy service-role JWT without exposing it", () => {
    const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    const key = `header.${payload}.signature`;
    expect(() => validateReleaseConfiguration({
      ...validConfiguration,
      supabaseKey: key,
    })).toThrow("secret/service_role");
  });

  it("rejects CSP drift from the pinned production project", () => {
    expect(() => validateReleaseConfiguration({
      ...validConfiguration,
      cspConnectSrc: "'self' https://another-project.supabase.co",
    })).toThrow("Tauri CSP");
    expect(() => validateReleaseConfiguration({
      ...validConfiguration,
      devCspConnectSrc: `'self' ${productionOrigin} https://another-project.supabase.co`,
    })).toThrow("Tauri CSP");
    expect(() => validateReleaseConfiguration({
      ...validConfiguration,
      cspConnectSrc: `'self' ${productionOrigin}.evil.example`,
    })).toThrow("Tauri CSP");
  });

  it("reports wrong-project release configuration explicitly", () => {
    expect(() => validateReleaseConfiguration({
      ...validConfiguration,
      supabaseUrl: "https://another-project.supabase.co",
    })).toThrow("Supabase project origin");
  });

  it("parses Cargo package version without reading dependency versions", () => {
    expect(parseCargoVersion('[package]\nname = "desk"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1"')).toBe("0.1.0");
  });

  it("parses only named dotenv entries", () => {
    expect(parseDotEnv('VITE_SUPABASE_URL=https://example.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY="public-key"\n')).toEqual({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
    });
  });
});
