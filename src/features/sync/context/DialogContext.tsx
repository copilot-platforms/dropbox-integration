'use client'

import { createContext, type ReactNode, useState } from 'react'

export type DialogContextType = {
  isOpen: boolean
  title: string
  description: string
  onCancel: () => void
  onConfirm?: () => void
}

type ToggleDialogType = (value?: boolean) => void

export const DialogContext = createContext<
  | (DialogContextType & {
      setDialogAttributes: React.Dispatch<React.SetStateAction<DialogContextType>>
      toggleDialog: ToggleDialogType
    })
  | null
>(null)

export const DialogContextProvider = ({ children }: { children: ReactNode }) => {
  const toggleDialog: ToggleDialogType = (value) =>
    setDialogAttributes((prev) => ({ ...prev, isOpen: value === undefined ? !prev.isOpen : value }))

  const [dialogAttributes, setDialogAttributes] = useState<DialogContextType>({
    isOpen: false,
    title: '',
    description: '',
    onCancel: () => toggleDialog(false),
  })

  return (
    <DialogContext.Provider
      value={{
        ...dialogAttributes,
        setDialogAttributes,
        toggleDialog,
      }}
    >
      {children}
    </DialogContext.Provider>
  )
}
