import camelcaseKeys from 'camelcase-keys'
import type { ChannelSyncSelectType } from '@/db/schema/channelSync.schema'
import type { ClientUser } from '@/lib/copilot/models/ClientUser.model'
import { useRealtime } from '@/lib/supabase/hooks/useRealtime'
import { useUserChannel } from './useUserChannel'

export const useRealtimeSync = (user: ClientUser) => {
  const { setUserChannel, tempMapList } = useUserChannel()

  return useRealtime<ChannelSyncSelectType>(
    user.portalId,
    'channel_sync',
    `portal_id=eq.${user.portalId}`,
    'UPDATE',
    (payload) => {
      const newPayload = camelcaseKeys(payload.new) as ChannelSyncSelectType

      setUserChannel((prev) => ({
        ...prev,
        tempMapList: tempMapList.map((mapItem) => {
          if (
            mapItem.dbxRoothPath === newPayload.dbxRootPath &&
            mapItem.fileChannelId === newPayload.assemblyChannelId
          ) {
            return {
              ...mapItem,
              status: newPayload.status,
            }
          }
          return mapItem
        }),
      }))
    },
  )
}
