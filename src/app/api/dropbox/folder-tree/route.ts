import { getFolderTree } from '@/features/dropbox/api/dropbox.controller'
import { withErrorHandler } from '@/utils/withErrorHandler'

export const GET = withErrorHandler(getFolderTree)
