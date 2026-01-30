import { getTotalFilesCount } from '@/features/sync/api/sync.controller'
import { withErrorHandler } from '@/utils/withErrorHandler'

export const maxDuration = 300 // 5 minutes. Docs: https://vercel.com/docs/functions/configuring-functions/duration#duration-limits

export const GET = withErrorHandler(getTotalFilesCount)
