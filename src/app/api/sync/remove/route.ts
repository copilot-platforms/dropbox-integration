import { removeChannelSyncMapping } from '@/features/sync/api/sync.controller'
import { withErrorHandler } from '@/utils/withErrorHandler'

export const DELETE = withErrorHandler(removeChannelSyncMapping)
