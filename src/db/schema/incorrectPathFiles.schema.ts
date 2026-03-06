import { type InferInsertModel, type InferSelectModel, sql } from 'drizzle-orm'
import { boolean, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import type z from 'zod'
import { timestamps } from '@/db/db.helpers'

export const incorrectPathFiles = pgTable('incorrect_path_files', {
  id: uuid().primaryKey().notNull().defaultRandom(),
  portalId: varchar({ length: 32 }).notNull(), // Workspace ID / Portal ID in Copilot
  fileIds: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  isMoveComplete: boolean().notNull().default(false),
  channelId: varchar({ length: 255 }).notNull(),
  ...timestamps,
})

export const IncorrectPathCreateSchema = createInsertSchema(incorrectPathFiles)
export type IncorrectPathFilesCreateType = InferInsertModel<typeof incorrectPathFiles>
export type IncorrectPathFilesSelectType = InferSelectModel<typeof incorrectPathFiles>

export const IncorrectPathUpdatePayloadSchema = createUpdateSchema(incorrectPathFiles).omit({
  id: true,
  portalId: true,
})
export type IncorrectPathUpdatePayload = z.infer<typeof IncorrectPathUpdatePayloadSchema>
