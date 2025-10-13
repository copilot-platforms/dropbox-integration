import { AuthContext } from '@auth/context/AuthContext'
import { useContext } from 'react'

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context)
    throw new Error('ClientSideError :: useAuth must be used within AuthContextProvider')

  return context
}
