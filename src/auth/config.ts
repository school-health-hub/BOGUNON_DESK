import productionSupabase from "../../config/production-supabase.json";

export type SupabaseAuthConfig = {
  readonly url: string;
  readonly publishableKey: string;
};

export const PRODUCTION_SUPABASE_ORIGIN = productionSupabase.origin;

export class AuthConfigurationError extends Error {
  constructor() {
    super("계정 연결 설정이 아직 준비되지 않았습니다.");
    this.name = "AuthConfigurationError";
  }
}

const decodeLegacyKeyRole = (key: string): string | null => {
  const payload = key.split(".")[1];
  if (payload === undefined) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { readonly role?: unknown };
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
};

const isPublicClientKey = (key: string): boolean =>
  key.startsWith("sb_publishable_") || decodeLegacyKeyRole(key) === "anon";

export const parseSupabaseAuthConfig = (
  urlValue: string | undefined,
  keyValue: string | undefined,
): SupabaseAuthConfig => {
  const key = keyValue?.trim() ?? "";
  let url: URL;
  try {
    url = new URL(urlValue?.trim() ?? "");
  } catch {
    throw new AuthConfigurationError();
  }

  if (
    url.protocol !== "https:"
    || url.origin !== PRODUCTION_SUPABASE_ORIGIN
    || key === ""
    || !isPublicClientKey(key)
  ) {
    throw new AuthConfigurationError();
  }

  return { url: url.origin, publishableKey: key };
};

export const getSupabaseAuthConfig = (): SupabaseAuthConfig =>
  parseSupabaseAuthConfig(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );

export const hasSupabaseAuthConfig = (): boolean => {
  try {
    getSupabaseAuthConfig();
    return true;
  } catch {
    return false;
  }
};
