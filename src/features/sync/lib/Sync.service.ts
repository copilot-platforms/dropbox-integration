import { and, eq } from 'drizzle-orm'
import { ApiError } from 'node_modules/copilot-node-sdk/dist/codegen/api'
import { ObjectType, type ObjectTypeValue } from '@/db/constants'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import { type FileSyncCreateType, fileFolderSync } from '@/db/schema/fileFolderSync.schema'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import type User from '@/lib/copilot/models/User.model'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'
import { processDropboxSyncToAssemblyTask } from '@/trigger/processFileSync'
import { buildPathArray } from '@/utils/filePath'
import { MAX_FILES_LIMIT } from '../constant'
import {
  DropboxFileListFolderResultEntriesSchema,
  type DropboxFileListFolderSingleEntry,
  type DropboxToAssemblySyncFilesPayload,
  type DropboxToAssemblySyncTaskPayload,
  type WhereClause,
} from '../types'
import { MapFilesService } from './MapFiles.service'

export class SyncService extends AuthenticatedDropboxService {
  readonly mapFilesService: MapFilesService

  constructor(user: User, connectionToken: DropboxConnectionTokens) {
    super(user, connectionToken)
    this.mapFilesService = new MapFilesService(user, connectionToken)
  }

  async initiateSync(assemblyChannelId: string) {
    // 1. expect assembly channel and dropbox folder path Inputs.
    const dbxRootPath = '/Assembly'

    // 2. sync dropbox folder to assembly channel
    await this.processDropboxSyncToAssembly(dbxRootPath, assemblyChannelId)

    // 3. TODO: sync assembly channel to dropbox folder
  }

  private async processDropboxSyncToAssembly(dbxRootPath: string, assemblyChannelId: string) {
    // 1. store channel sync
    const channelPayload = {
      dbxAccountId: this.connectionToken.accountId,
      assemblyChannelId,
      dbxRootPath,
    }
    const channelMap = await this.mapFilesService.getOrCreateChannelMap(channelPayload)

    // 1. get all the files folder from dropbox
    const dbxApi = new DropboxApi()
    const dbxClient = dbxApi.getDropboxClient(this.connectionToken.refreshToken)

    let dbxFiles = await dbxClient.filesListFolder({
      path: dbxRootPath,
      recursive: true,
      limit: MAX_FILES_LIMIT,
    })
    let loopOver = !!dbxFiles.result.entries.length

    this.dbxApi.refreshAccessToken(this.connectionToken.refreshToken)

    while (loopOver) {
      const parsedDbxFiles = DropboxFileListFolderResultEntriesSchema.safeParse(
        dbxFiles.result.entries,
      )

      if (!parsedDbxFiles.success) {
        console.error('Error parsing Dropbox files', parsedDbxFiles.error)
        break
      }

      const parsedDbxEntries = parsedDbxFiles.data
      const syncTaskPayload: DropboxToAssemblySyncTaskPayload = {
        resultEntries: parsedDbxEntries,
        dbxRootPath,
        assemblyChannelId,
        channelSyncId: channelMap.id,
        user: this.user,
        connectionToken: this.connectionToken,
      }

      await processDropboxSyncToAssemblyTask.trigger(syncTaskPayload)

      if (!dbxFiles.result.has_more || !parsedDbxEntries.length) {
        loopOver = false

        // update channelSync with lastest cursor
        await this.mapFilesService.updateChannelMap({
          dbxCursor: dbxFiles.result.cursor,
        })
        break
      }

      // continue pagination
      dbxFiles = await dbxClient.filesListFolderContinue({
        cursor: dbxFiles.result.cursor,
      })
    }
  }

  async syncDropboxFilesToAssembly({ entry, opts }: DropboxToAssemblySyncFilesPayload) {
    const { dbxRootPath, assemblyChannelId, channelSyncId } = opts

    const fileObjectType = entry['.tag']
    const basePath = entry.path_display.replace(dbxRootPath, '') // removes the base folder path

    const pathArray = buildPathArray(basePath) // to create a folders hierarchy if not exists

    for (let i = 0; i < pathArray.length; i++) {
      const lastItem = i === pathArray.length - 1

      const itemPath = pathArray[i]

      await this.createAndUploadFileToAssembly(
        assemblyChannelId,
        itemPath,
        lastItem,
        fileObjectType as ObjectTypeValue,
        channelSyncId,
        entry,
        basePath,
      )
    }
  }

  async createAndUploadFileToAssembly(
    assemblyChannelId: string,
    itemPath: string,
    lastItem: boolean,
    fileObjectType: ObjectTypeValue,
    channelSyncId: string,
    entry: DropboxFileListFolderSingleEntry,
    basePath: string,
  ) {
    const copilotApi = new CopilotAPI(this.user.token)
    const tempFileType = lastItem ? fileObjectType : ObjectType.FOLDER

    try {
      // create file/folder
      const fileCreateResponse = await copilotApi.createFile(
        itemPath,
        assemblyChannelId,
        tempFileType,
      )
      const filePayload: FileSyncCreateType = {
        channelSyncId,
        itemPath,
        object: tempFileType,
        assemblyFileId: fileCreateResponse.id,
        portalId: this.user.portalId,
      }

      if (fileObjectType === ObjectType.FILE && fileCreateResponse.uploadUrl && lastItem) {
        const dbxArrayBuffer = await this.dbxApi.downloadFile(
          '/2/files/download',
          entry?.path_display,
        )
        // upload file to assembly
        await copilotApi.uploadFile(fileCreateResponse.uploadUrl, dbxArrayBuffer)

        filePayload.contentHash = entry.content_hash
      }

      await this.mapFilesService.insertFileMap({
        ...filePayload,
        dbxFileId: lastItem ? entry.id : null,
      })
    } catch (error: unknown) {
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.body.message === 'Folder already exists'
      ) {
        console.info({ message: error.body.message })
        await this.handleFolderCreatedCase(
          lastItem,
          tempFileType,
          channelSyncId,
          basePath,
          entry.id,
        )
        return
      }
      console.error(error)
      throw error
    }
  }

  /**
   * purpose: checks if the item is last item of the folder heirarchy and the entry is a folder.
   * if yes, update the dbxFileId to the table
   */
  private async handleFolderCreatedCase(
    lastItem: boolean,
    tempFileType: ObjectTypeValue,
    channelSyncId: string,
    basePath: string,
    entryId: string,
  ) {
    if (lastItem && tempFileType === ObjectType.FOLDER) {
      const fileMapCondition = and(
        eq(fileFolderSync.channelSyncId, channelSyncId),
        eq(fileFolderSync.itemPath, basePath),
      ) as WhereClause

      // update the dbxFileId to the table
      await this.mapFilesService.updateFileMap(
        {
          dbxFileId: entryId,
        },
        fileMapCondition,
      )
    }
  }
}
