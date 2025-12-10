'use client'

import { useEffect, useState } from 'react'
import { useAuthContext } from '@/features/auth/hooks/useAuth'
import { useSubHeader } from '@/features/sync/hooks/useSubHeader'
import { useActionsMenu, usePrimaryCta } from '@/lib/copilot/hooks/app-bridge'
import { type AppBridgeProps, Icons } from '@/lib/copilot/hooks/app-bridge/types'

export const AppBridge = ({ portalUrl, handleDropboxDisconnection }: AppBridgeProps) => {
  const [_awake, setAwake] = useState(false)
  const { connectionStatus } = useAuthContext()

  useEffect(() => {
    setTimeout(() => {
      setAwake(true)
    }, 0)
  }, [])

  const { handleAddRule } = useSubHeader()

  const primaryCta = connectionStatus
    ? {
        label: 'Add',
        icon: Icons.PLUS,
        onClick: handleAddRule,
      }
    : null

  const actionsMenu = connectionStatus
    ? [
        {
          label: 'Disconnect account',
          icon: Icons.DISCONNECT,
          onClick: handleDropboxDisconnection,
        },
      ]
    : []

  usePrimaryCta(primaryCta, { portalUrl })
  useActionsMenu(actionsMenu, { portalUrl })

  return null
}
