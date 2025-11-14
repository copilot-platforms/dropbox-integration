import {
  handleWebhookEvents,
  handleWebhookUrlVerification,
} from '@/features/webhook/dropbox/api/webhook.controller'
import { withErrorHandler } from '@/utils/withErrorHandler'

/**
 * not used withErrorHander() as this is a sync function and has included its separate try catch block
 */
export const GET = handleWebhookUrlVerification
export const POST = withErrorHandler(handleWebhookEvents)
