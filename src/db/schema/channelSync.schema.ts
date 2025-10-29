import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import type z from 'zod'
import { timestamps } from '@/db/db.helpers'

export const channelSync = pgTable('channel_sync', {
  id: uuid().primaryKey().notNull().defaultRandom(),
  portalId: varchar({ length: 32 }).notNull(), // Workspace ID / Portal ID in Copilot
  dbxAccountId: varchar({ length: 100 }).notNull(),
  assemblyChannelId: varchar({ length: 255 }).notNull(), // Assembly channel ID
  dbxRootPath: varchar().notNull(),
  dbxCursor: varchar(),
  pauseCursor: varchar(),
  currentCursor: varchar(),
  status: boolean().notNull().default(false), // Connection status
  ...timestamps,
})

export const ChannelSyncCreateSchema = createInsertSchema(channelSync)
export type ChannelSyncCreateType = InferInsertModel<typeof channelSync>
export type ChannelSyncSelectType = InferSelectModel<typeof channelSync>

export const ChannelSyncUpdatePayloadSchema = createUpdateSchema(channelSync).omit({
  id: true,
  portalId: true,
  dbxAccountId: true,
})
export type ChannelSyncUpdatePayload = z.infer<typeof ChannelSyncUpdatePayloadSchema>
