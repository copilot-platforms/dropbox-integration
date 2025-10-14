import { DASHBOARD_DOMAIN } from '@/constants/domains'

export const handlePostMessage = (payload: object) => {
  DASHBOARD_DOMAIN.forEach((domain) => {
    window.parent.postMessage(payload, domain)
  })
}
