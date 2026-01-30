import { useContext } from 'react'
import { DialogContext } from '@/features/sync/context/DialogContext'

export const useDialogContext = () => {
  const context = useContext(DialogContext)
  if (!context)
    throw new Error('ClientSideError :: useDialog must be used within DialogContextProvider')

  return context
}
