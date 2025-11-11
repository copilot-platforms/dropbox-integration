import { useUserChannel } from './useUserChannel'

export const useSubHeader = () => {
  const { setUserChannel } = useUserChannel()

  const handleAddRule = () => {
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: [
        ...prev.tempMapList,
        {
          dbxRoothPath: '',
          fileChannelDetail: [],
          fileChannelValue: [],
          status: false,
          fileChannelId: '',
        },
      ],
    }))
  }

  return { handleAddRule }
}
