import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const isServer = typeof window === "undefined";

const ssrSafeStorage = {
  getItem: (key: string) => (isServer ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => (isServer ? Promise.resolve() : AsyncStorage.setItem(key, value)),
  removeItem: (key: string) => (isServer ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.trim().length > 0 &&
  SUPABASE_ANON_KEY.trim().length > 0 &&
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 20;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ssrSafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
