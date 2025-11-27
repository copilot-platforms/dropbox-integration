import { and, eq } from 'drizzle-orm'
import db from '@/db'
import {
  assemblyWebhookRecord,
  type WebhookRecordCreateType,
  type WebhookRecordSelectType,
} from '@/db/schema/assemblyWebhookRecords.schema'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'

export class AssemblyWebhookRecordService extends AuthenticatedDropboxService {
  async getOrCreateWebhookRecord(
    payload: Omit<WebhookRecordCreateType, 'portalId'>,
  ): Promise<{ item: WebhookRecordSelectType; isCreated: boolean }> {
    console.info(` \n\n\n triggeredAt: ${new Date(payload.triggeredAt)} \n\n\n`)
    let isCreated = false
    let [record] = await db
      .select()
      .from(assemblyWebhookRecord)
      .where(
        and(
          eq(assemblyWebhookRecord.portalId, this.user.portalId),
          eq(assemblyWebhookRecord.action, payload.action),
          eq(assemblyWebhookRecord.fileId, payload.fileId),
          eq(assemblyWebhookRecord.assemblyChannelId, payload.assemblyChannelId),
          eq(assemblyWebhookRecord.triggeredAt, new Date(payload.triggeredAt)),
        ),
      )

    if (!record) {
      console.info(`Webhook event does not exists. Creating ...`)
      const [webhookRecord] = await db
        .insert(assemblyWebhookRecord)
        .values({ ...payload, portalId: this.user.portalId })
        .returning()
      record = webhookRecord
      isCreated = true
    }

    return { item: record, isCreated }
  }
}
