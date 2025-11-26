import { and, eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import type { ObjectTypeValue } from '@/db/constants'
import { channelSync } from '@/db/schema/channelSync.schema'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import APIError from '@/errors/APIError'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import type { AssemblyToDropboxSyncFilesPayload } from '@/features/sync/types'
import {
  type AssemblyWebhookEvent,
  AssemblyWebhookSchema,
  DISPATCHABLE_HANDLEABLE_EVENT,
} from '@/features/webhook/assembly/utils/types'
import type User from '@/lib/copilot/models/User.model'
import { type CopilotFileRetrieve, CopilotFileWithObjectSchema } from '@/lib/copilot/types'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import {
  deleteAssemblyFileInDropbox,
  syncAssemblyFileToDropbox,
  updateAssemblyFileInDropbox,
} from '@/trigger/processFileSync'

export class AssemblyWebhookService extends AuthenticatedDropboxService {
  readonly mapFilesService: MapFilesService
  constructor(user: User, connectionToken: DropboxConnectionTokens) {
    super(user, connectionToken)
    this.mapFilesService = new MapFilesService(user, connectionToken)
  }

  async parseWebhook(req: NextRequest): Promise<AssemblyWebhookEvent> {
    const webhookEvent = AssemblyWebhookSchema.safeParse(await req.json())
    if (!webhookEvent.success) {
      throw new APIError('Failed to parse webhook event')
    }
    return webhookEvent.data
  }

  validateHandleableEvent(
    webhookEvent: AssemblyWebhookEvent,
  ): DISPATCHABLE_HANDLEABLE_EVENT | null {
    const eventType = webhookEvent.eventType as DISPATCHABLE_HANDLEABLE_EVENT
    const isValidWebhook = [
      DISPATCHABLE_HANDLEABLE_EVENT.FileCreated,
      DISPATCHABLE_HANDLEABLE_EVENT.FileDeleted,
      DISPATCHABLE_HANDLEABLE_EVENT.FileUpdated,
      DISPATCHABLE_HANDLEABLE_EVENT.FolderCreated,
      DISPATCHABLE_HANDLEABLE_EVENT.FolderDeleted,
      DISPATCHABLE_HANDLEABLE_EVENT.FolderUpdated,
    ].includes(eventType)
    return isValidWebhook ? eventType : null
  }

  async handleFileCreated(webhookEvent: AssemblyWebhookEvent) {
    const channel = await this.mapFilesService.getAllChannelMaps(
      and(
        eq(channelSync.assemblyChannelId, webhookEvent.data.channelId),
        eq(channelSync.status, true),
      ),
    )
    if (!channel.length) return

    const { dbxRootPath, id: channelSyncId } = channel[0]
    const file = webhookEvent.data
    const filteredEntries = await this.mapFilesService.checkAndFilterAssemblyFiles(
      [file],
      dbxRootPath,
      webhookEvent.data.channelId,
    )

    if (filteredEntries.length) {
      await syncAssemblyFileToDropbox.batchTrigger(filteredEntries)
      await this.updateLastSynced(channelSyncId)
    }
  }

  async handleFileDeleted(webhookEvent: AssemblyWebhookEvent) {
    const file = webhookEvent.data
    const channel = await this.mapFilesService.getAllChannelMaps(
      and(
        eq(channelSync.assemblyChannelId, webhookEvent.data.channelId),
        eq(channelSync.status, true),
      ),
    )
    if (!channel.length) return

    const { dbxRootPath, assemblyChannelId, id: channelSyncId } = channel[0]
    const user = this.user
    const connectionToken = this.connectionToken
    if (file) {
      const payload: AssemblyToDropboxSyncFilesPayload = {
        file: file as CopilotFileRetrieve & { object: ObjectTypeValue },
        opts: {
          dbxRootPath,
          assemblyChannelId,
          channelSyncId,
          user,
          connectionToken,
        },
      }

      await deleteAssemblyFileInDropbox.trigger(payload)
      await this.updateLastSynced(channelSyncId) // this updates the last synced timestamp for the channel. This runs before
    }
  }

  async handleFileUpdated(webhookEvent: AssemblyWebhookEvent) {
    const file = webhookEvent.data
    const channel = await this.mapFilesService.getAllChannelMaps(
      and(
        eq(channelSync.assemblyChannelId, webhookEvent.data.channelId),
        eq(channelSync.status, true),
      ),
    )
    if (!channel.length) return

    const { dbxRootPath, assemblyChannelId, id: channelSyncId } = channel[0]
    const user = this.user
    const connectionToken = this.connectionToken
    if (file) {
      const payload: AssemblyToDropboxSyncFilesPayload = {
        file: CopilotFileWithObjectSchema.parse(file),
        opts: {
          dbxRootPath,
          assemblyChannelId,
          channelSyncId,
          user,
          connectionToken,
        },
      }

      await updateAssemblyFileInDropbox.trigger(payload)
      await this.updateLastSynced(channelSyncId)
    }
  }

  private async updateLastSynced(channelSyncId: string) {
    await this.mapFilesService.updateChannelMapById(
      {
        lastSyncedAt: new Date(),
      },
      channelSyncId,
    )
  }
}
