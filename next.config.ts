import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'
import z from 'zod'
import { DEV_URL } from '@/config/client.env'

const nextConfig = {
  // Ngrok tunnel for local dev testing (sndp)
  allowedDevOrigins: [DEV_URL],
  // biome-ignore lint/suspicious/useAwait: `headers` needs to be async
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://dashboard.copilot.app https://dashboard.copilot-staging.app https://dashboard.copilot-staging.com https://dashboard.assembly.com https://dashboard.assembly-staging.com https://*.myassembly.com;",
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
} satisfies NextConfig

const isProduction = process.env.VERCEL_ENV === 'production'

const org = isProduction ? z.string().min(1).parse(process.env.SENTRY_ORG) : ''
const project = isProduction ? z.string().min(1).parse(process.env.SENTRY_PROJECT) : ''
const authToken = isProduction ? z.string().min(1).parse(process.env.SENTRY_AUTH_TOKEN) : ''

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org,

  project,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,

  authToken,
})
