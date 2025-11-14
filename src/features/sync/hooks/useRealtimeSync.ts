import camelcaseKeys from 'camelcase-keys'
import type { ChannelSyncSelectType } from '@/db/schema/channelSync.schema'
import type { ClientUser } from '@/lib/copilot/models/ClientUser.model'
import { useRealtime } from '@/lib/supabase/hooks/useRealtime'
import { useUserChannel } from './useUserChannel'

export const useRealtimeSync = (user: ClientUser) => {
  const { setUserChannel } = useUserChannel()

  return useRealtime<ChannelSyncSelectType>(
    user.portalId,
    'channel_sync',
    `portal_id=eq.${user.portalId}`,
    'UPDATE',
    (payload) => {
      const newPayload = camelcaseKeys(payload.new) as ChannelSyncSelectType

      setUserChannel((prev) => ({
        ...prev,
        tempMapList: prev.tempMapList.map((mapItem) => {
          if (
            mapItem.dbxRootPath === newPayload.dbxRootPath &&
            mapItem.fileChannelId === newPayload.assemblyChannelId
          ) {
            return {
              ...mapItem,
              status: newPayload.status,
              id: newPayload.id,
            }
          }
          return mapItem
        }),
      }))
    },
  )
}
