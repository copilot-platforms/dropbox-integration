import { and, eq } from 'drizzle-orm'
import status from 'http-status'
import db from '@/db'
import {
  assemblyWebhookRecord,
  type WebhookRecordCreateType,
  type WebhookRecordSelectType,
} from '@/db/schema/assemblyWebhookRecords.schema'
import APIError from '@/errors/APIError'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import logger from '@/lib/logger'

export class AssemblyWebhookRecordService extends AuthenticatedDropboxService {
  async getOrCreateWebhookRecord(
    payload: Omit<WebhookRecordCreateType, 'portalId'>,
  ): Promise<{ item: WebhookRecordSelectType; isCreated: boolean }> {
    logger.info(
      'AssemblyWebhookRecordService#getOrCreateWebhookRecord :: Getting or creating webhook record',
      payload,
    )
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
      logger.info(
        'AssemblyWebhookRecordService#getOrCreateWebhookRecord :: Webhook event does not exists. Creating ...',
      )
      try {
        const [webhookRecord] = await db
          .insert(assemblyWebhookRecord)
          .values({ ...payload, portalId: this.user.portalId })
          .returning()
        record = webhookRecord
        isCreated = true
      } catch (_e: unknown) {
        throw new APIError('Skipping duplicate webhook record', status.OK)
      }
    }

    logger.info(
      'AssemblyWebhookRecordService#getOrCreateWebhookRecord :: Returning webhook record',
      record,
    )
    return { item: record, isCreated }
  }
}
