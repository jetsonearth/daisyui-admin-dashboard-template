import { supabase } from '../config/supabaseClient'

const checkAuth = async () => {
  const PUBLIC_ROUTES = ["login", "forgot-password", "register", "documentation"]
  const isPublicPage = PUBLIC_ROUTES.some(r => window.location.href.includes(r))

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session && !isPublicPage) {
    window.location.href = '/login'
    return null
  }
  
  return session?.access_token
}

export default checkAuth