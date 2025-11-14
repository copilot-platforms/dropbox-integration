'use client'

import { useAuthContext } from '@/features/auth/hooks/useAuth'

export const CheckConnection = ({ children }: { children: React.ReactNode }) => {
  const { connectionStatus } = useAuthContext()
  if (!connectionStatus) return

  return <>{children}</>
}
