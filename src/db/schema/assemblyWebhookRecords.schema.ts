import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import type z from 'zod'
import { enumToPgEnum, timestamps } from '@/db/db.helpers'
import { DISPATCHABLE_HANDLEABLE_EVENT } from '@/features/webhook/assembly/utils/types'

export const ActionEnum = pgEnum(
  'assembly_webhook_events_enum',
  enumToPgEnum(DISPATCHABLE_HANDLEABLE_EVENT),
)

export const assemblyWebhookRecord = pgTable(
  'assembly_webhook_records',
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    portalId: varchar({ length: 32 }).notNull(), // Workspace ID / Portal ID in Copilot
    action: ActionEnum().notNull(),
    assemblyChannelId: varchar({ length: 255 }).notNull(), // Assembly channel ID
    fileId: uuid().notNull(),
    triggeredAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_all_columns_combined').on(
      table.portalId,
      table.assemblyChannelId,
      table.fileId,
      table.triggeredAt,
      table.action,
    ),
  ],
)

export const WebhookRecordCreateSchema = createInsertSchema(assemblyWebhookRecord)
export type WebhookRecordCreateType = InferInsertModel<typeof assemblyWebhookRecord>
export type WebhookRecordSelectType = InferSelectModel<typeof assemblyWebhookRecord>

export const WebhookRecordUpdatePayloadSchema = createUpdateSchema(assemblyWebhookRecord).omit({
  id: true,
  portalId: true,
  channelSyncId: true,
})
export type WebhookRecordUpdatePayload = z.infer<typeof WebhookRecordUpdatePayloadSchema>
