// src/services/authService.ts
import { supabase } from '../config/supabaseClient';
import { AuthResponse, User } from '@supabase/supabase-js';

export const authService = {
  async signUp(email: string, password: string): Promise<AuthResponse> {
    const authResponse = await supabase.auth.signUp({
      email,
      password,
    });

    // If signup successful, create user settings
    if (authResponse.data?.user) {
      const now = new Date().toISOString();
      await supabase
        .from('user_settings')
        .insert([
          {
            user_id: authResponse.data.user.id,
            account_creation_date: now,
            created_at: now,
            updated_at: now
          }
        ]);
    }

    return authResponse;
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