// src/lib/supabase.ts
import type { SupabaseClient } from "@supabase/supabase-js";

const IS_MOCK = process.env.EXPO_PUBLIC_USE_MOCKS === "true";

let supabase: SupabaseClient;

if (IS_MOCK) {
  // Lazy import to avoid bundling mock code in production
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMockClient } = require("@lib/mock");
  supabase = createMockClient();
} else {
  // Real Supabase client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { secureStoreAdapter } = require("@lib/secure-store-adapter");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppState } = require("react-native");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file.",
    );
  }

  supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  AppState.addEventListener("change", (state: string) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export { supabase };
