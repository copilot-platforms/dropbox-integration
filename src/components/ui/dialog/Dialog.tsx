import { Button } from 'copilot-design-system'
import type React from 'react'
import Divider from '@/components/layouts/Divider'
import { useDialog } from '@/components/ui/dialog/useDialog'

interface DialogProps {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  title: string
  description: string
  cancel: () => void
  confirm: () => void
}

export const Dialog: React.FC<DialogProps> = ({
  open = false,
  setOpen,
  title,
  description,
  cancel,
  confirm,
}) => {
  const { containerRef } = useDialog({ isOpen: open, setIsOpen: setOpen })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="w-full max-w-md transform overflow-hidden rounded-sm bg-white text-left align-middle shadow-xl transition-all"
      >
        <div className="px-7 py-4">
          <h3 className="font-medium text-[15px] leading-6">{title}</h3>
        </div>
        <Divider />
        <div className="px-7 py-4">
          <p className="text-[13px]">{description}</p>
        </div>

        <Divider />
        <div className="flex justify-end space-x-4 px-7 py-4">
          <Button label="Cancel" variant="secondary" size="sm" onClick={cancel} />
          <Button label="Confirm" variant="primary" size="sm" onClick={confirm} />
        </div>
      </div>
    </div>
  )
}
