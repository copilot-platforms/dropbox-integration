import { and, eq } from 'drizzle-orm'
import status from 'http-status'
import z from 'zod'
import env from '@/config/server.env'
import db from '@/db'
import { type ChannelSyncSelectType, channelSync } from '@/db/schema/channelSync.schema'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import APIError from '@/errors/APIError'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import type {
  DropboxFileListFolderResultEntries,
  DropboxFileListFolderSingleEntry,
  DropboxToAssemblySyncFilesPayload,
} from '@/features/sync/types'
import { getDropboxChanges } from '@/features/webhook/dropbox/utils/getDropboxChanges'
import { generateToken } from '@/lib/copilot/generateToken'
import User from '@/lib/copilot/models/User.model'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'
import {
  deleteDropboxFileInAssembly,
  syncDropboxFileToAssembly,
  updateDropboxFileInAssembly,
} from '@/trigger/processFileSync'

export class DropboxWebhook {
  async fetchDropBoxChanges(accountId: string) {
    const connection = await this.getActiveConnection(accountId)

    if (!connection || !connection.refreshToken) {
      throw new APIError('Connection not valid', status.INTERNAL_SERVER_ERROR)
    }

    const { portalId, initiatedBy, refreshToken } = connection

    const connectionToken = {
      refreshToken,
      accountId,
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

    for (const channel of channels) {
      await this.processChannelChanges(channel, dbxApi, mapFilesService, user, connectionToken)
    }
  }

  private async processChannelChanges(
    channel: ChannelSyncSelectType,
    dbxApi: DropboxApi,
    mapFilesService: MapFilesService,
    user: User,
    connectionToken: DropboxConnectionTokens,
  ) {
    console.info(`webhookService#processChannelChanges. ChannelId: ${channel.id}`)
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
      await this.handleChannelFileChanges(
        allChanges,
        mapFilesService,
        channelSyncId,
        dbxRootPath,
        assemblyChannelId,
        user,
        connectionToken,
      )
    }

    await mapFilesService.updateChannelMapById(
      { dbxCursor: currentCursor, lastSyncedAt: new Date() },
      channelSyncId,
    )
  }

  private async handleChannelFileChanges(
    files: DropboxFileListFolderResultEntries,
    mapFilesService: MapFilesService,
    channelSyncId: string,
    dbxRootPath: string,
    assemblyChannelId: string,
    user: User,
    connectionToken: DropboxConnectionTokens,
  ) {
    for (const file of files) {
      const existingFile = await db.query.fileFolderSync.findFirst({
        where: (fileFolderSync, { eq }) => eq(fileFolderSync.dbxFileId, z.string().parse(file.id)),
      })
      if (file['.tag'] === 'deleted') {
        existingFile &&
          (await this.handleFileDelete(
            file,
            mapFilesService,
            channelSyncId,
            dbxRootPath,
            assemblyChannelId,
            user,
            connectionToken,
          ))
        continue
      }
      const hasFileChanged =
        !!existingFile &&
        ((existingFile.contentHash && existingFile.contentHash !== file.content_hash) ||
          existingFile.itemPath !== file.path_display.replace(dbxRootPath, ''))
      if (!existingFile) {
        await this.handleFileInsert(file, mapFilesService, assemblyChannelId, dbxRootPath)
      }
      if (hasFileChanged) {
        await this.handleFileUpdate(
          file,
          mapFilesService,
          channelSyncId,
          dbxRootPath,
          assemblyChannelId,
          user,
          connectionToken,
        )
      }
    }
  }

  private async handleFileInsert(
    file: DropboxFileListFolderSingleEntry,
    mapFilesService: MapFilesService,
    assemblyChannelId: string,
    dbxRootPath: string,
  ) {
    const filteredEntries = await mapFilesService.checkAndFilterDbxFiles(
      [file],
      dbxRootPath,
      assemblyChannelId,
    )

    if (filteredEntries.length) {
      await syncDropboxFileToAssembly.batchTrigger(filteredEntries)
    }
  }

  private async handleFileDelete(
    file: DropboxFileListFolderSingleEntry,
    mapFilesService: MapFilesService,
    channelSyncId: string,
    dbxRootPath: string,
    assemblyChannelId: string,
    user: User,
    connectionToken: DropboxConnectionTokens,
  ) {
    const mappedEntry = await mapFilesService.getDbxMappedFile(file.id, channelSyncId)
    if (mappedEntry) {
      const payload: DropboxToAssemblySyncFilesPayload = {
        entry: file,
        opts: {
          dbxRootPath,
          assemblyChannelId,
          channelSyncId,
          user,
          connectionToken,
        },
      }
      await deleteDropboxFileInAssembly.trigger(payload)
    }
  }

  private async handleFileUpdate(
    file: DropboxFileListFolderSingleEntry,
    mapFilesService: MapFilesService,
    channelSyncId: string,
    dbxRootPath: string,
    assemblyChannelId: string,
    user: User,
    connectionToken: DropboxConnectionTokens,
  ) {
    const mappedEntry = await mapFilesService.getDbxMappedFile(file.id, channelSyncId)

    if (mappedEntry) {
      const payload: DropboxToAssemblySyncFilesPayload = {
        entry: file,
        opts: {
          dbxRootPath,
          assemblyChannelId,
          channelSyncId,
          user,
          connectionToken,
        },
      }
      await updateDropboxFileInAssembly.trigger(payload)
    }
  }

  private async getActiveConnection(accountId: string) {
    return await db.query.dropboxConnections.findFirst({
      where: (dropboxConnections, { eq, and }) =>
        and(eq(dropboxConnections.status, true), eq(dropboxConnections.accountId, accountId)),
      columns: {
        portalId: true,
        initiatedBy: true,
        refreshToken: true,
      },
    })
  } // should have been resuable but this is only needed while consuming webhook events from dropbox.
}
