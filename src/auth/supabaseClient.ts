import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthConfig } from "./config";
import { secureSessionStorage } from "./secureSessionStorage";

let client: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (client !== null) return client;
  const { publishableKey, url } = getSupabaseAuthConfig();
  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      experimental: { appendPkceFlowIdToRedirects: true },
      flowType: "pkce",
      persistSession: true,
      storage: secureSessionStorage,
    },
  });
  return client;
};
