// src/services/authService.ts
import { supabase } from '../config/supabaseClient';
import { AuthResponse, User } from '@supabase/supabase-js';

export const authService = {
  async signUp(email: string, password: string): Promise<AuthResponse> {
    return await supabase.auth.signUp({
      email,
      password,
    });
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  async signOut() {
    return await supabase.auth.signOut();
  },

  async getCurrentUser() {
    return supabase.auth.getUser();
  },

  async resetPasswordRequest(email: string) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  },

  async updatePassword(newPassword: string) {
    return await supabase.auth.updateUser({
      password: newPassword
    });
  }
};