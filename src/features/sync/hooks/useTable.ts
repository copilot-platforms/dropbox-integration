import { useState } from 'react'
import { useAuthContext } from '@/features/auth/hooks/useAuth'
import type { UserCompanySelectorInputValue } from '@/lib/copilot/types'
import { getCompanySelectorValue } from '../helper/sync.helper'
import { useUserChannel } from './useUserChannel'

export const useTable = () => {
  const { user } = useAuthContext()
  const { tempMapList, setUserChannel, userChannelList } = useUserChannel()
  const [userSelectorValue, setUserSelectorValue] = useState<{
    [key: number]: UserCompanySelectorInputValue[]
  }>()
  const [filteredValue, setFilteredValue] = useState<{ [key: number]: string | null }>()

  const onUserSelectorValueChange = (val: UserCompanySelectorInputValue[], index: number) => {
    setUserSelectorValue((prev) => ({ ...prev, [index]: val }))
    const localTempMapList = tempMapList.map((mapItem, i) => {
      if (i === index) {
        return {
          ...mapItem,
          fileChannelValue: val,
          fileChannelDetail: getCompanySelectorValue(userChannelList, val[0]),
        }
      }
      return mapItem
    })
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: localTempMapList,
    }))
  }

  const onDropboxFolderChange = (val: string | null, index: number) => {
    setFilteredValue((prev) => ({ ...prev, [index]: val }))
    const localTempMapList = tempMapList.map((mapItem, i) => {
      if (i === index) {
        return {
          ...mapItem,
          dbxRoothPath: val || '',
        }
      }
      return mapItem
    })
    setUserChannel((prev) => ({
      ...prev,
      tempMapList: localTempMapList,
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
      user: userSelectorValue?.[index] || tempMapList[index].fileChannelValue,
      dbxRootPath: filteredValue?.[index] || tempMapList[index].dbxRoothPath,
    }

    // TODO: create separate state to describte sync status
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
    userSelectorValue,
    setUserSelectorValue,
    onUserSelectorValueChange,
    filteredValue,
    onDropboxFolderChange,
    handleSync,
    handleItemRemove,
  }
}
