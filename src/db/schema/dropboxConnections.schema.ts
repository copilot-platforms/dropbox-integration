import { boolean, jsonb, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import type z from 'zod'
import { timestamps } from '@/db/db.helpers'
import type { DropboxAuthResponseType } from '@/lib/dropbox/type'

export type DropboxTokenSetType = Omit<DropboxAuthResponseType, 'accountId'>

export const dropboxConnections = pgTable(
  'dropbox_connections',
  {
    id: uuid().primaryKey().notNull().defaultRandom(),

    // Workspace ID / Portal ID in Copilot
    portalId: varchar({ length: 16 }).notNull(),

    // Unique account ID returned from DropboxAuth
    accountId: varchar({ length: 100 }),

    // tokenset of refreshToken and scopes returned from DropboxAuth
    tokenSet: jsonb().$type<DropboxTokenSetType>(),

    // Connection status
    status: boolean().notNull().default(false),

    // Copilot internalUserId that initiated the connection
    initiatedBy: uuid().notNull(),

    ...timestamps,
  },
  (table) => [uniqueIndex('uq_dropbox_connections_portal_id').on(table.portalId)],
)

export const DropboxConnectionSchema = createSelectSchema(dropboxConnections)
export type DropboxConnection = z.infer<typeof DropboxConnectionSchema>
// Authenticated dropbox connection (must have valid tokenSet + accountId)
export type DropboxConnectionWithTokenSet = DropboxConnection & {
  tokenSet: DropboxTokenSetType
  accountId: string
}

export const DropboxConnectionInsertPayloadSchema = createInsertSchema(dropboxConnections)
export type DropboxConnectionInsertPayload = z.infer<typeof DropboxConnectionInsertPayloadSchema>

export const DropboxConnectionUpdatePayloadSchema = createUpdateSchema(dropboxConnections).omit({
  id: true,
  portalId: true,
})
export type DropboxConnectionUpdatePayload = z.infer<typeof DropboxConnectionUpdatePayloadSchema>
