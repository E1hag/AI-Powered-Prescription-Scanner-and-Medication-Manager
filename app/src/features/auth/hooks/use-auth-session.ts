import { useEffect, useState } from 'react';

import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

type AuthSessionState = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
};

export function useAuthSession() {
  const [state, setState] = useState<AuthSessionState>({
    isConfigured: isSupabaseConfigured,
    isLoading: isSupabaseConfigured,
    session: null,
    user: null,
  });

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setState({
        isConfigured: false,
        isLoading: false,
        session: null,
        user: null,
      });
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setState({
          isConfigured: true,
          isLoading: false,
          session: data.session ?? null,
          user: data.session?.user ?? null,
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setState({
          isConfigured: true,
          isLoading: false,
          session: null,
          user: null,
        });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setState({
        isConfigured: true,
        isLoading: false,
        session: session ?? null,
        user: session?.user ?? null,
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
