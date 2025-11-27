import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './src/db/migrations',
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: validateEnv already gets run before migrations
    url: process.env.DATABASE_URL!,
  },
  casing: 'snake_case',
  breakpoints: false, // Not required for postgres
  migrations: {
    prefix: 'timestamp',
    schema: 'public',
  },
})
