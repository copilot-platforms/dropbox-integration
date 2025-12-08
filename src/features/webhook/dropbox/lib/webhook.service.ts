import { and, eq } from 'drizzle-orm'
import { type Dropbox, DropboxResponseError } from 'dropbox'
import status from 'http-status'
import httpStatus from 'http-status'
import z from 'zod'
import env from '@/config/server.env'
import db from '@/db'
import { type ChannelSyncSelectType, channelSync } from '@/db/schema/channelSync.schema'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import APIError from '@/errors/APIError'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import type { DropboxFileListFolderResultEntries } from '@/features/sync/types'
import { getDropboxChanges } from '@/features/webhook/dropbox/utils/getDropboxChanges'
import { generateToken } from '@/lib/copilot/generateToken'
import User from '@/lib/copilot/models/User.model'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'
import logger from '@/lib/logger'
import { handleChannelFileChanges } from '@/trigger/processFileSync'

export class DropboxWebhook {
  async fetchDropBoxChanges(accountId: string) {
    const connection = await this.getActiveConnection(accountId)

    if (!connection || !connection.refreshToken) {
      throw new APIError('Connection not valid', status.INTERNAL_SERVER_ERROR)
    }

    const { portalId, initiatedBy, refreshToken, rootNamespaceId } = connection

    const connectionToken = {
      refreshToken,
      accountId,
      rootNamespaceId,
    }
    const token = generateToken(env.COPILOT_API_KEY, {
      workspaceId: portalId,
      internalUserId: initiatedBy,
    })

    const user = await User.authenticate(token)
    const mapFilesService = new MapFilesService(user, connectionToken)

    const channels = await mapFilesService.getAllChannelMaps(
      and(eq(channelSync.dbxAccountId, accountId), eq(channelSync.status, true)),
    )

    const dbxApi = new DropboxApi()
    const dbxClient = dbxApi.getDropboxClient(refreshToken, rootNamespaceId)
    for (const channel of channels) {
      const proceed = await this.handleDbxRootPathMove(channel, mapFilesService, dbxClient)
      proceed &&
        (await this.processChannelChanges(channel, dbxApi, mapFilesService, user, connectionToken))
    }
  }

  async getDropboxFileMetadata(filePath: string, dbxClient: Dropbox) {
    return await dbxClient.filesGetMetadata({
      path: filePath,
    })
  }

  async handleDbxRootPathMove(
    channel: ChannelSyncSelectType,
    mapFilesService: MapFilesService,
    dbxClient: Dropbox,
  ): Promise<boolean> {
    try {
      console.info(
        `WebhookService#handleDbxRootPathMove. Root path: ${channel.dbxRootPath}. Assembly file channel ID: ${channel.assemblyChannelId} Checking if the root path exists...`,
      )
      const response = await this.getDropboxFileMetadata(channel.dbxRootPath, dbxClient)
      if (response.result) return true
      throw new APIError('Root path not found', httpStatus.NOT_FOUND)
    } catch (error: unknown) {
      logger.error(
        'WebhookService#handleDbxRootPathMove :: Error handling dbx root path move',
        error,
      )
      if (error instanceof DropboxResponseError && error.status === 409) {
        console.info(
          'WebhookService#handleDbxRootPathMove :: Root path not found',
          channel.dbxRootPath,
        )
        const response = await this.getDropboxFileMetadata(
          z.string().parse(channel.dbxRootId),
          dbxClient,
        )
        const cursorData = await dbxClient.filesListFolderGetLatestCursor({
          path: z.string().parse(response.result.path_display),
          recursive: true,
        })
        await mapFilesService.updateChannelMapById(
          {
            dbxRootPath: response.result.path_display,
            dbxCursor: cursorData.result.cursor,
          },
          channel.id,
        )
        return false
      }
      throw error
    }
  }

  private async processChannelChanges(
    channel: ChannelSyncSelectType,
    dbxApi: DropboxApi,
    mapFilesService: MapFilesService,
    user: User,
    connectionToken: DropboxConnectionTokens,
  ) {
    console.info(
      `webhookService#processChannelChanges. ChannelId: ${channel.id} ${JSON.stringify(channel)}`,
    )
    const { id: channelSyncId, dbxRootPath, assemblyChannelId, dbxCursor } = channel
    let hasMore = true
    let currentCursor = dbxCursor ?? ''
    const allChanges: DropboxFileListFolderResultEntries = []

    while (hasMore) {
      const {
        entries,
        newCursor,
        hasMore: more,
      } = await getDropboxChanges(
        connectionToken.refreshToken,
        connectionToken.rootNamespaceId,
        currentCursor,
        dbxRootPath,
        dbxApi,
        mapFilesService,
        channelSyncId,
      )

      allChanges.push(...entries)
      currentCursor = newCursor
      hasMore = more
    }

    if (allChanges.length > 0) {
      await handleChannelFileChanges.trigger({
        files: allChanges,
        channelSyncId,
        dbxRootPath,
        assemblyChannelId,
        user,
        connectionToken,
      })
    }

    await mapFilesService.updateChannelMapById(
      { dbxCursor: currentCursor, lastSyncedAt: new Date() },
      channelSyncId,
    )
  }

  private async getActiveConnection(accountId: string) {
    return await db.query.dropboxConnections.findFirst({
      where: (dropboxConnections, { eq, and }) =>
        and(eq(dropboxConnections.status, true), eq(dropboxConnections.accountId, accountId)),
      columns: {
        portalId: true,
        initiatedBy: true,
        refreshToken: true,
        rootNamespaceId: true,
      },
    })
  } // should have been resuable but this is only needed while consuming webhook events from dropbox.
}
