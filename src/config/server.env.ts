import 'server-only'

import { z } from 'zod'

const ServerEnvSchema = z.object({
  COPILOT_API_KEY: z.string().min(1),
  DATABASE_URL: z.url(),
  DROPBOX_APP_KEY: z.string().min(1),
  DROPBOX_APP_SECRET: z.string().min(1),
  DROPBOX_REDIRECT_URI: z.url(),
  DROPBOX_SCOPES: z.string().min(1),
})

const env = ServerEnvSchema.parse(process.env)
export default env
