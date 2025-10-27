import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { pgEnum, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema } from 'drizzle-zod'
import { enumToPgEnum, timestamps } from '@/db/db.helpers'
import { ObjectType } from '../constants'
import { channelSync } from './channelSync.schema'

export const ObjectEnum = pgEnum('object_types', enumToPgEnum(ObjectType))

export const fileFolderSync = pgTable('file_folder_sync', {
  id: uuid().primaryKey().notNull().defaultRandom(),
  portalId: varchar({ length: 32 }).notNull(), // Workspace ID / Portal ID in Copilot
  channelSyncId: uuid()
    .notNull()
    .references(() => channelSync.id),
  itemPath: varchar(),
  object: ObjectEnum().default(ObjectType.FILE).notNull(),
  contentHash: varchar(),
  dbxFfId: varchar(),
  ffId: varchar(),
  ...timestamps,
})

export const FileFolderCreateSchema = createInsertSchema(fileFolderSync)
export type FileFolderCreateType = InferInsertModel<typeof fileFolderSync>
export type FileFolderSelectType = InferSelectModel<typeof fileFolderSync>
