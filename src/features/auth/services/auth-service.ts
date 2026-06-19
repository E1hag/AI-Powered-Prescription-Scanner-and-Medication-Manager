import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export const authService = {
  async signInWithPassword(email: string, password: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured in the app environment.');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  },

  async signOut() {
    if (!isSupabaseConfigured()) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },
};
