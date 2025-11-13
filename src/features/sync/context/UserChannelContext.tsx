'use client'

import { createContext, type ReactNode, useState } from 'react'
import type { Folder, MapList, SelectorClientsCompanies } from '../types'

export type UserChannelContextType = {
  userChannelList: SelectorClientsCompanies
  folderTree: Folder[]
  mapList: MapList[]
  tempMapList: MapList[]
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
  folderTree,
  mapList,
  tempMapList,
  children,
}: UserChannelContextType & { children: ReactNode }) => {
  const [userChannel, setUserChannel] = useState<UserChannelContextType>({
    userChannelList,
    folderTree,
    mapList,
    tempMapList,
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
