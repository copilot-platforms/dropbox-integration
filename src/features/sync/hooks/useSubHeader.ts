import { useUserChannel } from '@/features/sync/hooks/useUserChannel'

export const useSubHeader = () => {
  const { setUserChannel } = useUserChannel()

  const handleAddRule = () => {
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: [
        ...prev.tempMapList,
        {
          dbxRootPath: '',
          fileChannelValue: [],
          status: false,
          fileChannelId: '',
          lastSyncedAt: null,
        },
      ],
    }))
  }

  return { handleAddRule }
}
