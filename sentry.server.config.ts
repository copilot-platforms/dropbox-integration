// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import z from 'zod'

const dsn =
  process.env.VERCEL_ENV === 'production'
    ? z.string().min(1).parse(process.env.NEXT_PUBLIC_SENTRY_DSN)
    : ''

Sentry.init({
  dsn,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',
  ignoreErrors: [/fetch failed/i],
  beforeSend(event) {
    if (event.request?.headers?.['user-agent']?.includes('vercel')) {
      return null
    }
    return event
  },
})
