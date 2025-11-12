import {
  handleWebhookEvents,
  handleWebhookUrlVerification,
} from '@/features/webhook/lib/dropbox/webhook.service'

/**
 * not used withErrorHander() as this is a sync function and has included its separate try catch block
 */
export const GET = handleWebhookUrlVerification
export const POST = handleWebhookEvents
