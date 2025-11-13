'use client'

import { useRealtimeSync } from '@sync/hooks/useRealtimeSync'
import type { ClientUser } from '@/lib/copilot/models/ClientUser.model'

interface RealtimeSyncProps {
  user: ClientUser
}

export const RealtimeSync = ({ user }: RealtimeSyncProps) => {
  useRealtimeSync(user)
  return null
}
