import 'server-only'

declare global {
  var _drizzleDb: DB | undefined
}

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import env from '@/config/server.env'
import { schema } from '@/db/schema'

type DB = PostgresJsDatabase<typeof schema>

globalThis._drizzleDb ??= drizzle(postgres(env.DATABASE_URL, { prepare: false, debug: true }), {
  casing: 'snake_case',
  schema,
}) as unknown as DB

const db = globalThis._drizzleDb as DB

export default db
