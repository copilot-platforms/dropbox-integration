import { defineConfig } from 'drizzle-kit'
import { z } from 'zod'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './src/db/migrations',
  dbCredentials: {
    url: z.url({ error: 'Please provide a valid DATABASE_URL' }).parse(process.env.DATABASE_URL),
  },
  casing: 'snake_case',
  breakpoints: false, // Not required for postgres
  migrations: {
    prefix: 'timestamp',
    schema: 'public',
  },
})
