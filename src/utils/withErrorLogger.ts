import { ApiError, logger } from '@trigger.dev/sdk'
import { DropboxResponseError } from 'dropbox'
import httpStatus from 'http-status'
import APIError from '@/errors/APIError'
import type { StatusableError } from '@/errors/BaseServerError'

// biome-ignore lint/suspicious/noExplicitAny: safe to use any in return type here.
export async function withErrorLogging<T>(args: T, fn: () => Promise<any>) {
  try {
    return await fn()
  } catch (error: unknown) {
    let status: number = (error as StatusableError).status || httpStatus.INTERNAL_SERVER_ERROR
    let message = 'Something went wrong'

    if (error instanceof DropboxResponseError) {
      status = error.status
      message = error.error.error_summary || message
    } else if (error instanceof APIError) {
      status = error.status
      message = error.message
    } else if (error instanceof ApiError) {
      status = error.status || status
      message = error.message
    } else if (error instanceof Error && error.message) {
      message = error.message
    }

    logger.error('Queue item failed', {
      item: args,
      error,
      message,
      status,
    })

    // Re-throw so Trigger.dev retries this job.
    throw error
  }
}
