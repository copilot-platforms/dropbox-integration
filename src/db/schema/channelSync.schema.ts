import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import type z from 'zod'
import { timestamps } from '@/db/db.helpers'
import { fileFolderSync } from '@/db/schema/fileFolderSync.schema'

export const channelSync = pgTable('channel_sync', {
  id: uuid().primaryKey().notNull().defaultRandom(),
  portalId: varchar({ length: 32 }).notNull(), // Workspace ID / Portal ID in Copilot
  dbxAccountId: varchar({ length: 100 }).notNull(),
  assemblyChannelId: varchar({ length: 255 }).notNull(), // Assembly channel ID
  dbxRootPath: varchar().notNull(),
  dbxCursor: varchar(),
  status: boolean().default(false), // TODO: make this enum with values like 'pending', 'syncing', 'synced'
  ...timestamps,
})

export const ChannelSyncRelations = relations(channelSync, ({ many }) => ({
  fileSync: many(fileFolderSync),
}))

export const ChannelSyncCreateSchema = createInsertSchema(channelSync)
export type ChannelSyncCreateType = InferInsertModel<typeof channelSync>
export type ChannelSyncSelectType = InferSelectModel<typeof channelSync>

export const ChannelSyncUpdatePayloadSchema = createUpdateSchema(channelSync).omit({
  id: true,
  portalId: true,
  dbxAccountId: true,
})
export type ChannelSyncUpdatePayload = z.infer<typeof ChannelSyncUpdatePayloadSchema>
