'use client'

import { useEffect, useState } from 'react'
import { useSubHeader } from '@/features/sync/hooks/useSubHeader'
import { useActionsMenu, usePrimaryCta } from '@/lib/copilot/hooks/app-bridge'
import { type AppBridgeProps, Icons } from '@/lib/copilot/hooks/app-bridge/types'

export const AppBridge = ({ portalUrl, handleDropboxDisconnection }: AppBridgeProps) => {
  const [_awake, setAwake] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setAwake(true)
    }, 0)
  }, [])

  const { handleAddRule } = useSubHeader()

  usePrimaryCta(
    {
      label: 'Add',
      icon: Icons.PLUS,
      onClick: handleAddRule,
    },
    { portalUrl },
  )

  useActionsMenu(
    [
      {
        label: 'Disconnect account',
        icon: Icons.DISCONNECT,
        onClick: handleDropboxDisconnection,
      },
    ],
    { portalUrl },
  )

  return null
}
