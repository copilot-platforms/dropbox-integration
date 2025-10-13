'use client'

import { createContext, type ReactNode, useState } from 'react'
import type { ClientUser } from '@/lib/copilot/models/ClientUser.model'

export type AuthContextType = {
  user: ClientUser
  connectionStatus: boolean
}

export const AuthContext = createContext<
  | (AuthContextType & {
      setAuth: React.Dispatch<React.SetStateAction<AuthContextType>>
      updateAuth: (state: Partial<AuthContextType>) => void
    })
  | null
>(null)

export const AuthContextProvider = ({
  user,
  connectionStatus,
  children,
}: AuthContextType & { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthContextType>({
    user,
    connectionStatus,
  })
  return (
    <AuthContext.Provider
      value={{
        ...auth,
        setAuth,
        updateAuth: (state) => setAuth((prev) => ({ ...prev, ...state })),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
