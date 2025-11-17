import { useState } from 'react'
import { useAuthContext } from '@/features/auth/hooks/useAuth'
import { useUserChannel } from '@/features/sync/hooks/useUserChannel'
import { type UserCompanySelectorInputValue, UserCompanySelectorObject } from '@/lib/copilot/types'

export const useTable = () => {
  const { user } = useAuthContext()
  const { tempMapList, setUserChannel, userChannelList } = useUserChannel()
  const [fileChannelIds, setFileChannelIds] = useState<{
    [key: number]: string
  }>()
  const [filteredValue, setFilteredValue] = useState<{ [key: number]: string | null }>()

  const onUserSelectorValueChange = (val: UserCompanySelectorInputValue[], index: number) => {
    let fileChannelId: string | undefined

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
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: prev.tempMapList.map((mapItem, i) => {
        if (i === index) {
          return {
            ...mapItem,
            fileChannelValue: val,
            fileChannelId,
          }
        }
        return mapItem
      }),
    }))
  }

  const onDropboxFolderChange = (val: string | null, index: number) => {
    setFilteredValue((prev) => ({ ...prev, [index]: val }))
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: prev.tempMapList.map((mapItem, i) => {
        if (i === index) {
          return {
            ...mapItem,
            dbxRootPath: val || '',
          }
        }
        return mapItem
      }),
    }))
  }

  const handleItemRemove = (index: number) => {
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: prev.tempMapList.filter((_, i) => i !== index),
    }))
  }

  const handleSync = async (index: number) => {
    const payload = {
      fileChannelId: fileChannelIds?.[index] || tempMapList[index].fileChannelId,
      dbxRootPath: filteredValue?.[index] || tempMapList[index].dbxRootPath,
    }

    setUserChannel((prev) => ({
      ...prev,
      tempMapList: prev.tempMapList.map((mapItem, i) => {
        if (i === index) {
          return {
            ...mapItem,
            status: null,
          }
        }
        return mapItem
      }),
    }))

    const resp = await fetch(`/api/sync?token=${user.token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    await resp.json()
  }

  return {
    onUserSelectorValueChange,
    filteredValue,
    onDropboxFolderChange,
    handleSync,
    handleItemRemove,
  }
}
