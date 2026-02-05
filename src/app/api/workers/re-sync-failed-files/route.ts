import { resyncFailedFiles } from '@/features/workers/resync-failed-files/api/resync-failed-files.controller'
import { withErrorHandler } from '@/utils/withErrorHandler'

export const maxDuration = 300

export const GET = withErrorHandler(resyncFailedFiles)
