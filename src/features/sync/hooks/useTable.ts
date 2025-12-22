import { useCallback, useState } from 'react'
import { useAuthContext } from '@/features/auth/hooks/useAuth'
import { useUserChannel } from '@/features/sync/hooks/useUserChannel'
import type { MapList } from '@/features/sync/types'
import { postFetcher } from '@/helper/fetcher.helper'
import { getFreshFolders } from '@/helper/table.helper'
import { type UserCompanySelectorInputValue, UserCompanySelectorObject } from '@/lib/copilot/types'

export const useTable = () => {
  const { user } = useAuthContext()
  const { tempMapList, setUserChannel, userChannelList, folders } = useUserChannel()
  const [fileChannelIds, setFileChannelIds] = useState<{
    [key: number]: string
  }>()
  const [filteredValue, setFilteredValue] = useState<{ [key: number]: string | null }>()

  const updateTempMapListState = (index: number, option: Partial<MapList>) => {
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: prev.tempMapList.map((mapItem, i) => {
        if (i === index) {
          return {
            ...mapItem,
            ...option,
          }
        }
        return mapItem
      }),
    }))
  }

  const onUserSelectorValueChange = (val: UserCompanySelectorInputValue[], index: number) => {
    let fileChannelId: string | undefined

    if (!val.length) return

    if (val[0].object === UserCompanySelectorObject.COMPANY) {
      fileChannelId = userChannelList.companies?.find(
        (company) => company.value === val[0].id,
      )?.fileChannelId
    } else if (val[0].object === UserCompanySelectorObject.CLIENT) {
      fileChannelId = userChannelList.clients?.find(
        (client) => client.value === val[0].id && client.companyId === val[0].companyId,
      )?.fileChannelId
    }

    if (!fileChannelId) return

    setFileChannelIds((prev) => ({ ...prev, [index]: fileChannelId }))
    updateTempMapListState(index, { fileChannelValue: val, fileChannelId })
  }

  const onDropboxFolderChange = (val: string | null, index: number) => {
    setFilteredValue((prev) => ({ ...prev, [index]: val }))
    updateTempMapListState(index, { dbxRootPath: val || '' })
  }

  const handleItemRemove = (index: number) => {
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: prev.tempMapList.filter((_, i) => i !== index),
      tempFolders: getFreshFolders(
        prev.tempMapList.filter((_, i) => i !== index),
        folders,
      ),
    }))
    setFilteredValue((prev) => ({ ...prev, [index]: null }))
  }

  const handleSync = async (index: number) => {
    const payload = {
      fileChannelId: fileChannelIds?.[index] || tempMapList[index].fileChannelId,
      dbxRootPath: filteredValue?.[index] || tempMapList[index].dbxRootPath,
    }
    updateTempMapListState(index, { status: null })

    try {
      await postFetcher(
        `/api/sync?token=${user.token}`,
        {},
        {
          body: JSON.stringify(payload),
        },
      )
    } catch (error: unknown) {
      console.error(error)
      updateTempMapListState(index, { status: false })
    }
  }

  const handleSyncStatusChange = async (index: number) => {
    const payload = {
      status: !tempMapList[index].status,
      assemblyChannelId: tempMapList[index].fileChannelId,
      dbxRootPath: filteredValue?.[index] || tempMapList[index].dbxRootPath,
    }

    updateTempMapListState(index, { status: !tempMapList[index].status })

    try {
      await postFetcher(
        `/api/sync/update-status?token=${user.token}`,
        {},
        {
          body: JSON.stringify(payload),
        },
      )
    } catch (error: unknown) {
      console.error(error)
      updateTempMapListState(index, { status: !tempMapList[index].status })
    }
  }

  return {
    onUserSelectorValueChange,
    filteredValue,
    onDropboxFolderChange,
    handleSync,
    handleItemRemove,
    handleSyncStatusChange,
  }
}

export const useUpdateUserList = () => {
  const { userChannelList, tempMapList } = useUserChannel()
  const selectedChannelIds = tempMapList.map((map) => map.fileChannelId)

  const getNewChannelList = useCallback(() => {
    const newClientList = userChannelList.clients?.filter(
      (client) => client.fileChannelId && !selectedChannelIds.includes(client.fileChannelId),
    )
    const newCompanyList = userChannelList.companies?.filter(
      (company) => company.fileChannelId && !selectedChannelIds.includes(company.fileChannelId),
    )
    const newChannelList = { clients: newClientList, companies: newCompanyList }

    return newChannelList
  }, [userChannelList, selectedChannelIds])

  return { unselectedChannelList: getNewChannelList() }
}
