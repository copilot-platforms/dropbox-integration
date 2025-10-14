import { useEffect } from 'react'
import type {
  Clickable,
  Configurable,
  SecondaryCtaPayload,
} from '@/lib/copilot/hooks/app-bridge/types'
import { ensureHttps } from '@/utils/https'
import { handlePostMessage } from '../../helpers/appBridge.helper'

export const useSecondaryCta = (secondaryCta: Clickable | null, config?: Configurable) => {
  useEffect(() => {
    const payload: SecondaryCtaPayload | Pick<SecondaryCtaPayload, 'type'> = !secondaryCta
      ? { type: 'header.secondaryCta' }
      : {
          type: 'header.secondaryCta',
          label: secondaryCta.label,
          icon: secondaryCta.icon,
          onClick: 'header.secondaryCta.onClick',
        }

    handlePostMessage(payload)
    if (config?.portalUrl) {
      window.parent.postMessage(payload, ensureHttps(config.portalUrl))
    }

    const handleMessage = (event: MessageEvent) => {
      if (
        event.data.type === 'header.secondaryCta.onClick' &&
        typeof event.data.id === 'string' &&
        secondaryCta?.onClick
      ) {
        secondaryCta.onClick()
      }
    }

    addEventListener('message', handleMessage)

    return () => {
      removeEventListener('message', handleMessage)
    }
  }, [secondaryCta, config?.portalUrl])

  useEffect(() => {
    const handleUnload = () => {
      handlePostMessage({ type: 'header.secondaryCta' })
      if (config?.portalUrl) {
        window.parent.postMessage({ type: 'header.secondaryCta' }, ensureHttps(config.portalUrl))
      }
    }
    addEventListener('beforeunload', handleUnload)
    return () => {
      removeEventListener('beforeunload', handleUnload)
    }
  }, [config?.portalUrl])
}
