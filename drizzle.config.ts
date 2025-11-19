import { defineConfig } from 'drizzle-kit'
import env from '@/config/server.env'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './src/db/migrations',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  casing: 'snake_case',
  breakpoints: false, // Not required for postgres
  migrations: {
    prefix: 'timestamp',
    schema: 'public',
  },
})
