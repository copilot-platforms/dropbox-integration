'use client'

import { useAuthContext } from '@/features/auth/hooks/useAuth'
import { Overlay } from '@/features/sync/components/Overlay'

export const CheckConnection = ({ children }: { children: React.ReactNode }) => {
  const { connectionStatus } = useAuthContext()
  if (!connectionStatus) {
    return (
      <div className="relative opacity-50">
        <Overlay />
        {children}
      </div>
    )
  }

  return <>{children}</>
}
