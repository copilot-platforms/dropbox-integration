'use client'

import { useAuthContext } from '@/features/auth/hooks/useAuth'
import { postMessageParentDashboard } from '@/lib/copilot/hooks/app-bridge/postParentMessage'

export const CheckConnection = ({ children }: { children: React.ReactNode }) => {
  const { connectionStatus } = useAuthContext()
  if (!connectionStatus) {
    postMessageParentDashboard({ type: 'header.actionsMenu', items: [] })
    postMessageParentDashboard({ type: 'header.primaryCta' })
    return
  } //remove app bridge functionality when app is disconnected.

  return <>{children}</>
}
