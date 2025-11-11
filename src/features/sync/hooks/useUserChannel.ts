import { useContext } from 'react'
import { UserChannelContext } from '../context/UserChannelContext'

export const useUserChannel = () => {
  const context = useContext(UserChannelContext)
  if (!context)
    throw new Error(
      'ClientSideError :: useUserChannel must be used within UserChannelContextProvider',
    )

  return context
}
