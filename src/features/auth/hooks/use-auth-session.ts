import { isSupabaseConfigured, supabase } from "@/src/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type AuthSessionState = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
};

export function useAuthSession() {
  const [state, setState] = useState<AuthSessionState>({
    isConfigured: isSupabaseConfigured,
    isLoading: true,
    session: null,
    user: null,
  });

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setState({
            isConfigured: false,
            isLoading: false,
            session: null,
            user: null,
          });
        }

        return;
      }

      const { data } = await supabase.auth.getSession();

      if (mounted) {
        setState({
          isConfigured: true,
          isLoading: false,
          session: data.session,
          user: data.session?.user ?? null,
        });
      }
    }

    loadSession();

    if (!isSupabaseConfigured) {
      return () => {
        mounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setState({
          isConfigured: true,
          isLoading: false,
          session,
          user: session?.user ?? null,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
