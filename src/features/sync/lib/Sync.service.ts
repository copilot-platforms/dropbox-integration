import { and, eq } from 'drizzle-orm'
import { DropboxResponseError } from 'dropbox'
import { ApiError } from 'node_modules/copilot-node-sdk/dist/codegen/api'
import fetch from 'node-fetch'
import { ObjectType, type ObjectTypeValue } from '@/db/constants'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import { type FileSyncCreateType, fileFolderSync } from '@/db/schema/fileFolderSync.schema'
import { DBX_URL_PATH } from '@/features/sync/constant'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import type {
  AssemblyToDropboxSyncFilesPayload,
  DropboxFileListFolderSingleEntry,
  DropboxToAssemblySyncFilesPayload,
  WhereClause,
} from '@/features/sync/types'
import { copilotBottleneck } from '@/lib/copilot/bottleneck'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import type User from '@/lib/copilot/models/User.model'
import type { CopilotFileRetrieve } from '@/lib/copilot/types'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import { bidirectionalMasterSync } from '@/trigger/processFileSync'
import { appendDateTimeToFilePath, buildPathArray } from '@/utils/filePath'

export class SyncService extends AuthenticatedDropboxService {
  readonly mapFilesService: MapFilesService

  constructor(user: User, connectionToken: DropboxConnectionTokens) {
    super(user, connectionToken)
    this.mapFilesService = new MapFilesService(user, connectionToken)
  }

  async initiateSync(assemblyChannelId: string, dbxRootPath: string) {
    console.info(
      `SyncService#initiateSync. Channel ID: ${assemblyChannelId}. DBX root path: ${dbxRootPath}`,
    )
    await bidirectionalMasterSync.trigger({
      dbxRootPath,
      assemblyChannelId,
      connectionToken: this.connectionToken,
      user: this.user,
    })
  }

  async syncDropboxFilesToAssembly({ entry, opts }: DropboxToAssemblySyncFilesPayload) {
    console.info(`SyncService#syncDropboxFilesToAssembly. Channel ID: ${opts.assemblyChannelId}`)

    const { dbxRootPath, assemblyChannelId, channelSyncId } = opts
    const fileObjectType = entry['.tag']
    const basePath = entry.path_display.replace(dbxRootPath, '') // removes the base folder path
    const pathArray = buildPathArray(basePath) // to create a folders hierarchy if not exists

    const uploadPromises = []
    for (let i = 0; i < pathArray.length; i++) {
      const lastItem = i === pathArray.length - 1
      const itemPath = pathArray[i]

      uploadPromises.push(
        copilotBottleneck.schedule(() => {
          return this.createAndUploadFileToAssembly(
            assemblyChannelId,
            itemPath,
            lastItem,
            fileObjectType as ObjectTypeValue,
            channelSyncId,
            entry,
            basePath,
          )
        }),
      )
    }

    await Promise.all(uploadPromises)
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
    console.info(`SyncService#createAndUploadFileToAssembly. Channel ID: ${assemblyChannelId}`)
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

      await this.mapFilesService.insertFileMap({
        ...filePayload,
        dbxFileId: lastItem ? entry.id : null,
      })

      if (fileObjectType === ObjectType.FILE && fileCreateResponse.uploadUrl && lastItem) {
        const dbxFileResponse = this.dbxApi.getDropboxClient(this.connectionToken.refreshToken)
        const fileMetaData = await dbxFileResponse.filesDownload({ path: entry?.path_display }) // get metadata for the files

        const downloadBody = await this.dbxApi.downloadFile(
          DBX_URL_PATH.fileDownload,
          entry?.path_display,
        )
        // upload file to assembly
        await copilotApi.uploadFile(
          fileCreateResponse.uploadUrl,
          fileMetaData.result.size.toString(),
          downloadBody,
        )
        filePayload.contentHash = entry.content_hash
      }

      console.info(
        `SyncService#createAndUploadFileToAssembly. Channel ID: ${assemblyChannelId}. File upload success. Type: ${tempFileType}. File ID: ${filePayload.assemblyFileId}. Dbx fileId: ${lastItem ? entry.id : null}`,
      )
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
      console.error(
        `SyncService#createAndUploadFileToAssembly. Upload failed. Channel ID: ${assemblyChannelId}`,
      )
      throw error
    }
  }

  async removeFileFromAssembly(channelSyncId: string, entry: DropboxFileListFolderSingleEntry) {
    const copilotApi = new CopilotAPI(this.user.token)
    const mappedFile = await this.mapFilesService.getDbxMappedFile(entry.id, channelSyncId)
    if (!mappedFile) {
      return
    }
    if (mappedFile.assemblyFileId) {
      const deleteMappedFile = this.mapFilesService.deleteFileMap(mappedFile.id)
      const deleteFileInAssembly = copilotApi.deleteFile(mappedFile.assemblyFileId)
      await Promise.all([deleteMappedFile, deleteFileInAssembly])
    }
  }

  async removeFileFromDropbox(payload: AssemblyToDropboxSyncFilesPayload) {
    try {
      const { file, opts } = payload
      const { channelSyncId } = opts
      const mappedFile = await this.mapFilesService.getAssemblyMappedFile(file.id, channelSyncId)
      if (!mappedFile) {
        return
      }
      const { dbxRootPath } = opts
      const dbxFilePath = `${dbxRootPath}/${mappedFile.itemPath}`
      const dbxClient = this.dbxApi.getDropboxClient(this.connectionToken.refreshToken)
      await this.mapFilesService.deleteFileMap(mappedFile.id)
      await dbxClient.filesDeleteV2({ path: dbxFilePath })
    } catch (error: unknown) {
      console.info('error : ', error)
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
    console.info(`SyncService#syncAssemblyFilesToDropbox. Channel ID: ${opts.assemblyChannelId}`)

    const { channelSyncId, dbxRootPath } = opts
    const filePayload = {
      channelSyncId,
      itemPath: file.path,
      object: file.object,
      portalId: this.user.portalId,
      assemblyFileId: file.id,
    }
    const dbxFileInfo = await this.createAndUploadFileInDropbox(dbxRootPath, file.object, file)
    await this.mapFilesService.insertFileMap({
      ...filePayload,
      ...dbxFileInfo,
    })
    console.info(
      `SyncService#syncAssemblyFilesToDropbox. Channel ID: ${opts.assemblyChannelId}. File upload success. Type: ${file.object}. File ID: ${filePayload.assemblyFileId}. Dbx fileId: ${dbxFileInfo?.dbxFileId}`,
    )
  }

  async createAndUploadFileInDropbox(
    dbxRootPath: string,
    fileType: ObjectTypeValue,
    file: CopilotFileRetrieve,
  ): Promise<{ dbxFileId: string; contentHash?: string } | undefined> {
    console.info(`SyncService#createAndUploadFileInDropbox. Channel ID: ${file.channelId}`)

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

        return await this.uploadFileInDropbox(file, dbxFilePath)
      }
      console.info(
        `SyncService#createAndUploadFileInDropbox. File exists but didn't received required file tag. Type: ${dbxResponse.result['.tag']}. Channel ID: ${file.channelId}`,
      )
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
          return await this.uploadFileInDropbox(file, dbxFilePath)
        }
        console.info(
          `SyncService#createAndUploadFileInDropbox. File type out of bound. Type: ${fileType}. Channel ID: ${file.channelId}`,
        )
      }
      console.error(`SyncService#createAndUploadFileInDropbox. Channel ID: ${file.channelId}`)
      throw error
    }
  }

  private async uploadFileInDropbox(file: CopilotFileRetrieve, path: string) {
    if (file.downloadUrl) {
      // download file from Assembly
      const resp = await fetch(file.downloadUrl)
      // upload file to dropbox
      const dbxResponse = await this.dbxApi.uploadFile(DBX_URL_PATH.fileUpload, path, resp.body)
      return {
        dbxFileId: dbxResponse.id,
        contentHash: dbxResponse.contentHash,
      }
    }
    console.error(
      `SyncService#uploadFileInDropbox. Assembly file with Id: ${file.id} has no download url. Channel ID: ${file.channelId}`,
    )
    throw new Error('File not found')
  }
}
