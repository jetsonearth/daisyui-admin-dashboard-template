// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check active session
    const checkUser = async () => {
      const startTime = performance.now();
      
      // First check local storage for cached session
      const cachedSession = localStorage.getItem('supabase_auth_session');
      if (cachedSession) {
        const session = JSON.parse(cachedSession);
        const now = new Date().getTime();
        const expiresAt = new Date(session.expires_at).getTime();
        
        // Use cached session if not expired
        if (now < expiresAt) {
          setUser(session.user);
          setLoading(false);
          console.log('Auth: Used cached session in', performance.now() - startTime, 'ms');
          return;
        }
      }

      // If no valid cached session, fetch from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        localStorage.setItem('supabase_auth_session', JSON.stringify(session));
      }
      setUser(session?.user || null);
      setLoading(false);
      console.log('Auth: Fetched new session in', performance.now() - startTime, 'ms');
    };

    checkUser();

    // Listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          localStorage.setItem('supabase_auth_session', JSON.stringify(session));
        } else {
          localStorage.removeItem('supabase_auth_session');
        }
        setUser(session?.user || null);
      }
    );

    // Cleanup subscription
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}