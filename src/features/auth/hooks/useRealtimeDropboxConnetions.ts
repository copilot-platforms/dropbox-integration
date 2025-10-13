import { useAuthContext } from '@auth/hooks/useAuth'
import type { DropboxConnection } from '@/db/schema/dropboxConnections.schema'
import type { ClientUser } from '@/lib/copilot/models/ClientUser.model'
import { useRealtime } from '@/lib/supabase/hooks/useRealtime'

export const useRealtimeDropboxConnections = (user: ClientUser) => {
  const { updateAuth } = useAuthContext()

  return useRealtime<DropboxConnection>(
    user.portalId,
    'dropbox_connections',
    `portal_id=eq.${user.portalId}`,
    'UPDATE',
    (payload) => {
      const newPayload = payload.new as DropboxConnection
      updateAuth({ connectionStatus: newPayload.status })
    },
  )
}
