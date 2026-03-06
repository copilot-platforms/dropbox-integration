import { moveFilesToCorrectPath } from '@/features/workers/move-files/api/moveFiles.controller'
import { withErrorHandler } from '@/utils/withErrorHandler'

export const maxDuration = 300

export const GET = withErrorHandler(moveFilesToCorrectPath)
