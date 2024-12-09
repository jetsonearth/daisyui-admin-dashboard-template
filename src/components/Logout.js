import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabaseClient'
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline'

function Logout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Error logging out:', error)
        return
      }
      
      // Redirect to login page after logout
      navigate('/login')
    } catch (error) {
      console.error('Unexpected error during logout:', error)
    }
  }

  return (
    <li>
      <button 
        onClick={handleLogout} 
        className="flex items-center text-error hover:bg-error/10"
      >
        <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2" />
        Logout
      </button>
    </li>
  )
}

export default Logout