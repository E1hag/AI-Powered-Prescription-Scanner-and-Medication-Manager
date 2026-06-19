import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const isServer = typeof window === "undefined";

const ssrSafeStorage = {
  getItem: (key: string) => (isServer ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => (isServer ? Promise.resolve() : AsyncStorage.setItem(key, value)),
  removeItem: (key: string) => (isServer ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL. Please add it to your .env file.",
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Please add it to your .env file.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ssrSafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
