'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { hasRole } from '@/lib/utils/auth-utils';
import type { User } from '@supabase/supabase-js';

interface UseUserReturn {
  user: User | null;
  isMod: boolean;
  isAdmin: boolean;
  loading: boolean;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMod, setIsMod] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();

    // Get initial user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        setIsMod(hasRole(user, 'mod'));
        setIsAdmin(hasRole(user, 'admin'));
      } else {
        setIsMod(false);
        setIsAdmin(false);
      }
      
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setIsMod(hasRole(session.user, 'mod'));
          setIsAdmin(hasRole(session.user, 'admin'));
        } else {
          setIsMod(false);
          setIsAdmin(false);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, isMod, isAdmin, loading };
}
