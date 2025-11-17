import { handleWebhookEvent } from '@/features/webhook/assembly/api/webhook.controller'
import { withErrorHandler } from '@/utils/withErrorHandler'

export const POST = withErrorHandler(handleWebhookEvent)
