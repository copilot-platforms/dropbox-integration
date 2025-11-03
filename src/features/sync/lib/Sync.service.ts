import { and, eq } from 'drizzle-orm'
import { type Dropbox, DropboxResponseError } from 'dropbox'
import { ApiError } from 'node_modules/copilot-node-sdk/dist/codegen/api'
import { ObjectType, type ObjectTypeValue } from '@/db/constants'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import { type FileSyncCreateType, fileFolderSync } from '@/db/schema/fileFolderSync.schema'
import { getFetcher } from '@/helper/fetcher.helper'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import type User from '@/lib/copilot/models/User.model'
import type { CopilotFileRetrieve } from '@/lib/copilot/types'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import { bidirectionalMasterSync } from '@/trigger/processFileSync'
import { appendDateTimeToFilePath, buildPathArray } from '@/utils/filePath'
import type {
  AssemblyToDropboxSyncFilesPayload,
  DropboxFileListFolderSingleEntry,
  DropboxToAssemblySyncFilesPayload,
  WhereClause,
} from '../types'
import { MapFilesService } from './MapFiles.service'

export class SyncService extends AuthenticatedDropboxService {
  readonly mapFilesService: MapFilesService

  constructor(user: User, connectionToken: DropboxConnectionTokens) {
    super(user, connectionToken)
    this.mapFilesService = new MapFilesService(user, connectionToken)
  }

  async initiateSync(assemblyChannelId: string) {
    // expect assembly channel and dropbox folder path Inputs.
    const dbxRootPath = '/Assembly'

    // bidrectional sync
    await bidirectionalMasterSync.trigger({
      dbxRootPath,
      assemblyChannelId,
      connectionToken: this.connectionToken,
      user: this.user,
    })
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

  async syncAssemblyFilesToDropbox({ file, opts }: AssemblyToDropboxSyncFilesPayload) {
    const { channelSyncId, dbxRootPath } = opts
    const dbxFileInfo = await this.createAndUploadFileInDropbox(dbxRootPath, file.object, file)

    const filePayload = {
      channelSyncId,
      itemPath: file.path,
      object: file.object,
      portalId: this.user.portalId,
      assemblyFileId: file.id,
    }
    await this.mapFilesService.insertFileMap({
      ...filePayload,
      ...dbxFileInfo,
    })
  }

  async createAndUploadFileInDropbox(
    dbxRootPath: string,
    fileType: ObjectTypeValue,
    file: CopilotFileRetrieve,
  ): Promise<{ dbxFileId: string; contentHash?: string } | undefined> {
    const dbxClient = this.dbxApi.getDropboxClient(this.connectionToken.refreshToken)
    const dbxFilePath = `${dbxRootPath}/${file.path}`

    // create file/folder
    try {
      // 1. check if the file/folder exists
      const dbxResponse = await dbxClient.filesGetMetadata({
        path: dbxFilePath,
      })
      // 1.1 if folder exists, simply return the folder id
      if (dbxResponse.result['.tag'] === ObjectType.FOLDER) {
        return { dbxFileId: dbxResponse.result.id }
      } else if (dbxResponse.result['.tag'] === ObjectType.FILE) {
        // 1.2 if file exists, rename the existing file in Dropbox and create a new file
        const newFilePath = appendDateTimeToFilePath(dbxFilePath)

        await dbxClient.filesMoveV2({
          from_path: dbxFilePath,
          to_path: newFilePath,
        })

        return await this.uploadFileInDropbox(file, dbxFilePath, dbxClient)
      }
    } catch (error: unknown) {
      // 2. if doesn't exist, create the file/folder
      if (
        error instanceof DropboxResponseError &&
        error.status === 409 &&
        error.error.error.path['.tag'] === 'not_found'
      ) {
        if (fileType === ObjectType.FOLDER) {
          const folderCreateResponse = await dbxClient.filesCreateFolderV2({
            path: dbxFilePath,
          })
          return { dbxFileId: folderCreateResponse.result.metadata.id }
        } else if (fileType === ObjectType.FILE) {
          return await this.uploadFileInDropbox(file, dbxFilePath, dbxClient)
        }
      }
      throw error
    }
  }

  private async uploadFileInDropbox(file: CopilotFileRetrieve, path: string, dbxClient: Dropbox) {
    if (file.downloadUrl) {
      // download file from Assembly
      const resp = await getFetcher(file.downloadUrl)
      const buffer = await resp.arrayBuffer()
      // upload file to dropbox
      const dbxResponse = await dbxClient.filesUpload({
        contents: buffer,
        path,
      })
      return { dbxFileId: dbxResponse.result.id, contentHash: dbxResponse.result.content_hash }
    }
    throw new Error('File not found')
  }
}
