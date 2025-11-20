import type { NextConfig } from 'next'
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

export default nextConfig
