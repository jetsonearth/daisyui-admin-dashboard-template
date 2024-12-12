// src/app/auth.ts
import { supabase } from '../config/supabaseClient';
import { Session, AuthResponse } from '@supabase/supabase-js';

export interface AuthState {
  user: Session['user'] | null;
  session: Session | null;
}

export const authService = {
  async getCurrentUser(): Promise<AuthState> {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      user: session?.user || null,
      session: session || null
    };
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }
};

const checkAuth = async (): Promise<string | null> => {
  const PUBLIC_ROUTES = ["login", "forgot-password", "register", "documentation"];
  const isPublicPage = PUBLIC_ROUTES.some(r => window.location.href.includes(r));

  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && !isPublicPage) {
    window.location.href = '/login';
    return null;
  }
  
  return session?.access_token || null;
};

export default checkAuth;