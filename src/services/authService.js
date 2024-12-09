import { supabase } from '../config/supabaseClient'

export const authService = {
  async signUp(email, password) {
    return await supabase.auth.signUp({
      email,
      password,
    })
  },

  async signIn(email, password) {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    })
  },

  async signOut() {
    return await supabase.auth.signOut()
  },

  async getCurrentUser() {
    return supabase.auth.getUser()
  },

  async resetPasswordRequest(email) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  },

  async updatePassword(newPassword) {
    return await supabase.auth.updateUser({
      password: newPassword
    })
  }
}