import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const FALLBACK_SUPABASE_URL = "https://example.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "temporary-placeholder-key";

export const isSupabaseConfigured =
  typeof SUPABASE_URL === "string" &&
  SUPABASE_URL.startsWith("https://") &&
  typeof SUPABASE_ANON_KEY === "string" &&
  SUPABASE_ANON_KEY.length > 20;

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase is not configured correctly. Please check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your root .env file.",
  );
}

export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL! : FALLBACK_SUPABASE_URL,
  isSupabaseConfigured ? SUPABASE_ANON_KEY! : FALLBACK_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
