import { getFolderTree } from '@/features/dropbox/api/dropbox.controller'
import { withErrorHandler } from '@/utils/withErrorHandler'

export const maxDuration = 800 // 13 minutes. Docs: https://vercel.com/docs/functions/configuring-functions/duration#duration-limits

export const GET = withErrorHandler(getFolderTree)
