'use client'

import { useRealtimeDropboxConnections } from '@auth/hooks/useRealtimeDropboxConnetions'
import type { ClientUser } from '@/lib/copilot/models/ClientUser.model'

interface RealtimeDropboxConnectionsProps {
  user: ClientUser
}

export const RealtimeDropboxConnections = ({ user }: RealtimeDropboxConnectionsProps) => {
  useRealtimeDropboxConnections(user)
  return null
}
