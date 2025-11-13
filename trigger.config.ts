// import { syncVercelEnvVars } from '@trigger.dev/build/extensions/core'
import { defineConfig } from '@trigger.dev/sdk/v3'
import dotenv from 'dotenv'
import z from 'zod'

dotenv.config()

// use relative path to import from server env or parse like below
const project = z
  .string({ message: 'Must have TRIGGER_PROJECT_ID in environment to run trigger jobs' })
  .min(1)
  .parse(process.env.TRIGGER_PROJECT_ID)

export default defineConfig({
  project,
  // Automatically sync env variables from Vercel to Trigger
  // build: {
  //   extensions: [syncVercelEnvVars()],
  // },
  runtime: 'node',
  logLevel: 'log',
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 60_000, // 1 minute
      factor: 2,
      randomize: true,
    },
  },
  dirs: ['./src/trigger'],
})
