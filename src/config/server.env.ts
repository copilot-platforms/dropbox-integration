import 'server-only'

import { z } from 'zod'

const ServerEnvSchema = z.object({
  COPILOT_API_KEY: z.string().min(1),
  DATABASE_URL: z.url(),

  // add dropbox client id, secret, callback url, scopes
})

const env = ServerEnvSchema.parse(process.env)
export default env
