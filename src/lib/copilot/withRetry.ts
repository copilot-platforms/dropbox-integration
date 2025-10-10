// import * as Sentry from '@sentry/nextjs'

import pRetry from 'p-retry'
import type { StatusableError } from '@/errors/BaseServerError'

export const withRetry = async <Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  args: Args,
): Promise<R> => {
  // TODO: Uncomment after Sentry integration
  // const isEventProcessorRegistered = false

  return await pRetry(
    async () => {
      // TODO: Uncomment after Sentry integration
      // try {
      //   return await fn(...args)
      // } catch (error) {
      // Hopefully now sentry doesn't report retry errors as well. We have enough triage issues as it is
      // Sentry.withScope((scope) => {
      //   if (isEventProcessorRegistered) return
      //   isEventProcessorRegistered = true
      //   scope.addEventProcessor((event) => {
      //     if (
      //       event.level === 'error' &&
      //       event.message &&
      //       event.message.includes('An error occurred during retry')
      //     ) {
      //       return null // Discard the event as it occured during retry
      //     }
      //     return event
      //   })
      // })
      // Rethrow the error so pRetry can retry
      // throw error
      // }
      return await fn(...args)
    },

    {
      retries: 3,
      minTimeout: 500,
      maxTimeout: 2000,
      factor: 2, // Exponential factor for timeout delay. Tweak this if issues still persist

      onFailedAttempt: (error: { error: unknown; attemptNumber: number; retriesLeft: number }) => {
        if (
          (error.error as StatusableError).status !== 429 &&
          (error.error as StatusableError).status !== 500
        ) {
          return
        }
        console.warn(
          `CopilotAPI#withRetry | Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left. Error:`,
          error,
        )
      },
      shouldRetry: (error: unknown) => {
        // Typecasting because Copilot doesn't export an error class
        const err = error as StatusableError
        // Retry only if statusCode indicates a ratelimit or Internal Server Error
        return err.status === 429 || err.status === 500
      },
    },
  )
}
