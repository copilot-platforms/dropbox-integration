import { eq } from 'drizzle-orm'
import type { DropboxResponse, files } from 'dropbox'
import db from '@/db'
import { ObjectType } from '@/db/constants'
import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import {
  type FileFolderCreateType,
  type FileFolderSelectType,
  fileFolderSync,
} from '@/db/schema/fileFolderSync.schema'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import type User from '@/lib/copilot/models/User.model'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'
import { SyncFilesService } from './SyncFiles.service'

export class SyncService extends AuthenticatedDropboxService {
  private syncFileService: SyncFilesService

  constructor(user: User, connectionToken: DropboxConnectionTokens) {
    super(user, connectionToken)
    this.syncFileService = new SyncFilesService(user)
  }

  async initiateSync(assemblyChannelId: string) {
    // 1. expect assembly channel and dropbox folder path Inputs.
    const dbxRootPath = '/Assembly'

    // 2. sync dropbox folder to assembly channel
    await this.processDropboxSyncToAssembly(dbxRootPath, assemblyChannelId)
  }

  private async processDropboxSyncToAssembly(dbxRootPath: string, assemblyChannelId: string) {
    // store sync flow in db
    const channelPayload = {
      dbxAccountId: this.connectionToken.accountId,
      assemblyChannelId,
      dbxRootPath,
    }
    const channelMap = await this.syncFileService.getChannelSync(channelPayload)

    // 1. get all the files folder from dropbox
    const dbxApi = new DropboxApi()
    const dbxClient = dbxApi.getDropboxClient(this.connectionToken.refreshToken)
    let dbxFiles: DropboxResponse<files.ListFolderResult>
    const copilotApi = new CopilotAPI(this.user.token)

    do {
      dbxFiles = await dbxClient.filesListFolder({
        path: dbxRootPath,
        recursive: true,
      })
      console.info({ ent: dbxFiles.result.entries })
      await this.syncDropboxFilesToAssembly(
        dbxFiles,
        dbxRootPath,
        copilotApi,
        assemblyChannelId,
        channelMap.id,
      )
    } while (dbxFiles.result.has_more)
  }

  private hasDbxFileMapped(mappedFiles: FileFolderSelectType[], filePath: string, dbxId: string) {
    return mappedFiles.find((file) => file.itemPath === filePath && file.dbxFfId === dbxId)
  }

  private async syncDropboxFilesToAssembly(
    dbxFiles: DropboxResponse<files.ListFolderResult>,
    dbxRootPath: string,
    copilotApi: CopilotAPI,
    assemblyChannelId: string,
    channelSyncId: string,
  ) {
    this.dbxApi.refreshAccessToken(this.connectionToken.refreshToken)
    const mappedFiles = await this.syncFileService.getAllFileMaps(
      eq(fileFolderSync.channelSyncId, channelSyncId),
    )

    for (const entry of dbxFiles.result.entries) {
      if (
        ((entry['.tag'] === ObjectType.FOLDER && entry.path_display !== dbxRootPath) ||
          entry['.tag'] === ObjectType.FILE) &&
        entry.path_display
      ) {
        const cleanPath = entry.path_display.replace(dbxRootPath, '') // removes the base folder path
        if (this.hasDbxFileMapped(mappedFiles, cleanPath, entry.id))
          // consider already mapped
          continue

        const objectType = entry['.tag'] as ObjectType

        // create file/folder
        const fileCreateResponse = await copilotApi.createFile(
          cleanPath,
          assemblyChannelId,
          objectType,
        )

        const filePayload: FileFolderCreateType = {
          channelSyncId,
          itemPath: cleanPath,
          object: objectType,
          dbxFfId: entry.id,
          ffId: fileCreateResponse.id,
          portalId: this.user.portalId,
        }
        if (entry['.tag'] === ObjectType.FILE && fileCreateResponse.uploadUrl) {
          const dbxArrayBuffer = await this.dbxApi.downloadFile(
            '/2/files/download',
            entry.path_display,
          )
          // upload file to assembly
          await copilotApi.uploadFile(fileCreateResponse.uploadUrl, dbxArrayBuffer)

          filePayload.contentHash = entry.content_hash
        }
        await db.insert(fileFolderSync).values(filePayload).returning()
      }
    }
  }
}
