import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { pgEnum, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import type z from 'zod'
import { ObjectType } from '@/db/constants'
import { enumToPgEnum, timestamps } from '@/db/db.helpers'
import { channelSync } from '@/db/schema/channelSync.schema'

export const ObjectEnum = pgEnum('object_types', enumToPgEnum(ObjectType))

export const fileFolderSync = pgTable('file_folder_sync', {
  id: uuid().primaryKey().notNull().defaultRandom(),
  portalId: varchar({ length: 32 }).notNull(), // Workspace ID / Portal ID in Copilot
  channelSyncId: uuid()
    .notNull()
    .references(() => channelSync.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  itemPath: varchar(),
  object: ObjectEnum().default(ObjectType.FILE).notNull(),
  contentHash: varchar(),
  dbxFileId: varchar(),
  assemblyFileId: uuid(),
  ...timestamps,
})

export const FileSyncRelations = relations(fileFolderSync, ({ one }) => ({
  channel: one(channelSync, {
    fields: [fileFolderSync.channelSyncId],
    references: [channelSync.id],
  }),
}))

export const FileFolderCreateSchema = createInsertSchema(fileFolderSync)
export type FileSyncCreateType = InferInsertModel<typeof fileFolderSync>
export type FileSyncSelectType = InferSelectModel<typeof fileFolderSync>

export const FileSyncUpdatePayloadSchema = createUpdateSchema(fileFolderSync).omit({
  id: true,
  portalId: true,
  channelSyncId: true,
})
export type FileSyncUpdatePayload = z.infer<typeof FileSyncUpdatePayloadSchema>
