import { and, eq, isNotNull } from 'drizzle-orm'
import db from '@/db'
import { ObjectType } from '@/db/constants'
import {
  type ChannelSyncCreateType,
  type ChannelSyncSelectType,
  type ChannelSyncUpdatePayload,
  channelSync,
} from '@/db/schema/channelSync.schema'
import {
  type FileSyncCreateType,
  type FileSyncSelectType,
  type FileSyncUpdatePayload,
  fileFolderSync,
} from '@/db/schema/fileFolderSync.schema'
import type { CopilotFileList } from '@/lib/copilot/types'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import type { DropboxFileListFolderResultEntries, WhereClause } from '../types'

export class MapFilesService extends AuthenticatedDropboxService {
  async getSingleFileMap(where: WhereClause): Promise<FileSyncSelectType | undefined> {
    return await db.query.fileFolderSync.findFirst({
      where,
    })
  }

  async getAllFileMaps(where: WhereClause): Promise<FileSyncSelectType[]> {
    return await db.query.fileFolderSync.findMany({
      where: (fileFolderSync, { eq }) =>
        and(where, eq(fileFolderSync.portalId, this.user.portalId)),
    })
  }

  async insertFileMap(payload: FileSyncCreateType): Promise<FileSyncSelectType> {
    const [mappedFile] = await db.insert(fileFolderSync).values(payload).returning()
    return mappedFile
  }

  async updateFileMap(
    payload: FileSyncUpdatePayload,
    condition: WhereClause,
  ): Promise<FileSyncSelectType> {
    const connections = await db
      .update(fileFolderSync)
      .set(payload)
      .where(and(eq(fileFolderSync.portalId, this.user.portalId), condition))
      .returning()
    return connections[0]
  }

  async getDbxMappedFile(dbxId: string, channelSyncId: string) {
    const [mappedFile] = await this.getAllFileMaps(
      and(
        eq(fileFolderSync.channelSyncId, channelSyncId),
        eq(fileFolderSync.dbxFileId, dbxId),
        isNotNull(fileFolderSync.assemblyFileId),
      ) as WhereClause,
    )
    return mappedFile
  }

  async getAssemblyMappedFile(fileId: string, channelSyncId: string) {
    const [mappedFile] = await this.getAllFileMaps(
      and(
        eq(fileFolderSync.channelSyncId, channelSyncId),
        eq(fileFolderSync.assemblyFileId, fileId),
        isNotNull(fileFolderSync.dbxFileId),
      ) as WhereClause,
    )
    return mappedFile
  }

  async getOrCreateChannelMap(
    payload: Omit<ChannelSyncCreateType, 'portalId'>,
  ): Promise<ChannelSyncSelectType> {
    let [channel] = await db
      .select()
      .from(channelSync)
      .where(
        and(
          eq(channelSync.portalId, this.user.portalId),
          eq(channelSync.assemblyChannelId, payload.assemblyChannelId),
        ),
      )

    if (!channel) {
      const newChannel = await db
        .insert(channelSync)
        .values({ ...payload, portalId: this.user.portalId, status: true })
        .returning()
      channel = newChannel[0]
    }

    return channel
  }

  async updateChannelMap(payload: ChannelSyncUpdatePayload): Promise<ChannelSyncSelectType> {
    const connections = await db
      .update(channelSync)
      .set(payload)
      .where(
        and(
          eq(channelSync.portalId, this.user.portalId),
          eq(channelSync.dbxAccountId, this.connectionToken.accountId),
        ),
      )
      .returning()
    return connections[0]
  }

  async checkAndFilterDbxFiles(
    parsedDbxEntries: DropboxFileListFolderResultEntries,
    dbxRootPath: string,
    assemblyChannelId: string,
  ) {
    const channelMap = await this.getOrCreateChannelMap({
      dbxAccountId: this.connectionToken.accountId,
      assemblyChannelId,
      dbxRootPath,
    })

    const mappedEntries = await Promise.all(
      parsedDbxEntries.map(async (entry) => {
        const fileObjectType = entry['.tag']
        if (
          (fileObjectType === ObjectType.FOLDER && entry.path_display !== dbxRootPath) ||
          fileObjectType === ObjectType.FILE
        ) {
          const isMapped = await this.getDbxMappedFile(entry.id, channelMap.id)
          if (!isMapped)
            return {
              payload: {
                opts: {
                  dbxRootPath,
                  assemblyChannelId,
                  channelSyncId: channelMap.id,
                  user: this.user,
                  connectionToken: this.connectionToken,
                },
                entry,
              },
            }

          return null
        }
      }),
    )
    return mappedEntries.filter((entry) => !!entry)
  }

  async checkAndFilterAssemblyFiles(
    files: CopilotFileList['data'],
    dbxRootPath: string,
    assemblyChannelId: string,
  ) {
    const channelMap = await this.getOrCreateChannelMap({
      dbxAccountId: this.connectionToken.accountId,
      assemblyChannelId,
      dbxRootPath,
    })

    const mappedEntries = await Promise.all(
      files.map(async (file) => {
        const fileType = file.object
        if (fileType === ObjectType.FILE || fileType === ObjectType.FOLDER) {
          const isMapped = await this.getAssemblyMappedFile(file.id, channelMap.id)

          if (!isMapped)
            return {
              payload: {
                opts: {
                  dbxRootPath,
                  assemblyChannelId,
                  channelSyncId: channelMap.id,
                  user: this.user,
                  connectionToken: this.connectionToken,
                },
                file: { ...file, object: fileType },
              },
            }

          return null
        }
      }),
    )
    return mappedEntries.filter((entry) => !!entry)
  }
}
