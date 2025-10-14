import { useEffect, useMemo } from 'react'
import { handlePostMessage } from '@/lib/copilot/helpers/appBridge.helper'
import type {
  ActionsMenuPayload,
  Clickable,
  Configurable,
} from '@/lib/copilot/hooks/app-bridge/types'
import { ensureHttps } from '@/utils/https'

const getActionMenuItemId = (idx: number) => `header.actionsMenu.${idx}`

export const useActionsMenu = (actions: Clickable[], config?: Configurable) => {
  const callbackRefs = useMemo(() => {
    return actions.reduce<Record<string, () => void>>((acc, { onClick }, idx) => {
      if (onClick) acc[getActionMenuItemId(idx)] = onClick
      return acc
    }, {})
  }, [actions])

  useEffect(() => {
    const payload: ActionsMenuPayload = {
      type: 'header.actionsMenu',
      items: actions.map(({ label, onClick, icon, color }, idx) => ({
        onClick: onClick ? getActionMenuItemId(idx) : '',
        label,
        icon,
        color,
      })),
    }

    handlePostMessage(payload)
    if (config?.portalUrl) {
      window.parent.postMessage(payload, ensureHttps(config.portalUrl))
    }

    const handleMessage = (event: MessageEvent) => {
      if (
        event.data.type === 'header.actionsMenu.onClick' &&
        typeof event.data.id === 'string' &&
        callbackRefs[event.data.id]
      ) {
        callbackRefs[event.data.id]()
      }
    }

    addEventListener('message', handleMessage)

    return () => {
      removeEventListener('message', handleMessage)
    }
  }, [actions, callbackRefs, config?.portalUrl])

  useEffect(() => {
    const handleUnload = () => {
      handlePostMessage({ type: 'header.actionsMenu', items: [] })
    }
    addEventListener('beforeunload', handleUnload)
    return () => {
      removeEventListener('beforeunload', handleUnload)
    }
  }, [])
}
