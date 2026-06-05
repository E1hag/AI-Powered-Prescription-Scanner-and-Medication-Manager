import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nduuftwbydnwssjrqvrg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Mbyjhe7Z1o5A--OfIiwt9w_vCEcVeLU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
