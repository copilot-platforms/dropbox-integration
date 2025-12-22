'use client'

import { createContext, type ReactNode, useState } from 'react'
import type { Folder, MapList, SelectorClientsCompanies } from '@/features/sync/types'

export type UserChannelContextType = {
  userChannelList: SelectorClientsCompanies
  mapList: MapList[]
  tempMapList: MapList[]
  syncedPercentage?: { [key: string]: number }
  folders?: Folder[]
  tempFolders?: Folder[]
}

export const UserChannelContext = createContext<
  | (UserChannelContextType & {
      setUserChannel: React.Dispatch<React.SetStateAction<UserChannelContextType>>
      updateChannel: (state: Partial<UserChannelContextType>) => void
    })
  | null
>(null)

export const UserChannelContextProvider = ({
  userChannelList,
  mapList,
  tempMapList,
  children,
}: UserChannelContextType & { children: ReactNode }) => {
  const [userChannel, setUserChannel] = useState<UserChannelContextType>({
    userChannelList,
    mapList,
    tempMapList,
    syncedPercentage: {},
    folders: [],
    tempFolders: [],
  })

  return (
    <UserChannelContext.Provider
      value={{
        ...userChannel,
        setUserChannel,
        updateChannel: (state) => setUserChannel((prev) => ({ ...prev, ...state })),
      }}
    >
      {children}
    </UserChannelContext.Provider>
  )
}
