#!/usr/bin/env tsx

import 'dotenv/config'
import { ZodError } from 'zod'

const validateEnv = async () => {
  try {
    const env = await import('../../src/config/server.env')
    void env // "fake" access it to trigger module evaluation & parsing
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('❌ Invalid environment variables:')
      for (const issue of e.issues) {
        const key = issue.path.join('.') || '(root)'
        console.error(` - ${key}: ${issue.message}`)
      }
      process.exit(1)
    }

    console.error('❌ Unexpected error while validating env:', e)
    process.exit(1)
  }
}

// biome-ignore lint/nursery/noFloatingPromises: This won't affect script's execution
;(async () => {
  console.info('\n🔍 Validating environment variables...')
  await validateEnv()
  console.info('✅ All required environment variables are set!\n')
})()
