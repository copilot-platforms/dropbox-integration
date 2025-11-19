import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import httpStatus from 'http-status'
import { ApiError } from 'node_modules/copilot-node-sdk/dist/codegen/api'
import z from 'zod'
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
import type {
  DropboxFileListFolderResultEntries,
  MapList,
  WhereClause,
} from '@/features/sync/types'
import { copilotBottleneck } from '@/lib/copilot/bottleneck'
import {
  type CopilotFileList,
  FileChannelMembership,
  type UserCompanySelectorInputValue,
} from '@/lib/copilot/types'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'

export class MapFilesService extends AuthenticatedDropboxService {
  async getSingleFileMap(where: WhereClause): Promise<FileSyncSelectType | undefined> {
    return await db.query.fileFolderSync.findFirst({
      where,
    })
  }

  async getAllFileMaps(where: WhereClause): Promise<FileSyncSelectType[]> {
    return await db.query.fileFolderSync.findMany({
      where: (fileFolderSync, { eq }) =>
        and(
          where,
          eq(fileFolderSync.portalId, this.user.portalId),
          isNull(fileFolderSync.deletedAt),
        ),
    })
  }

  async insertFileMap(payload: FileSyncCreateType): Promise<FileSyncSelectType> {
    const [mappedFile] = await db.insert(fileFolderSync).values(payload).returning()
    return mappedFile
  }

  async deleteFileMap(id: string): Promise<void> {
    await db.delete(fileFolderSync).where(eq(fileFolderSync.id, id))
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

  async getAssemblyMappedFile(assemblyId: string, channelSyncId: string) {
    const [mappedFile] = await this.getAllFileMaps(
      and(
        eq(fileFolderSync.channelSyncId, channelSyncId),
        eq(fileFolderSync.assemblyFileId, assemblyId),
        isNotNull(fileFolderSync.assemblyFileId),
      ) as WhereClause,
    )
    return mappedFile
  }

  async getDbxMappedFileIds(channelSyncId: string) {
    const mappedFile = await this.getAllFileMaps(
      and(
        eq(fileFolderSync.channelSyncId, channelSyncId),
        isNotNull(fileFolderSync.dbxFileId),
        isNotNull(fileFolderSync.assemblyFileId),
      ) as WhereClause,
    )
    return mappedFile.map((file) => file.dbxFileId)
  }

  async getDbxMappedFileFromPath(dbxPath: string, channelSyncId: string) {
    const [mappedFile] = await this.getAllFileMaps(
      and(
        eq(fileFolderSync.channelSyncId, channelSyncId),
        eq(fileFolderSync.itemPath, dbxPath),
        isNotNull(fileFolderSync.assemblyFileId),
      ) as WhereClause,
    )
    return mappedFile
  }

  async getAssemblyMappedFileIds(channelSyncId: string) {
    const mappedFile = await this.getAllFileMaps(
      and(
        eq(fileFolderSync.channelSyncId, channelSyncId),
        isNotNull(fileFolderSync.assemblyFileId),
        isNotNull(fileFolderSync.dbxFileId),
      ) as WhereClause,
    )
    return mappedFile.map((file) => file.assemblyFileId)
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
        .values({ ...payload, portalId: this.user.portalId, status: false })
        .returning()
      channel = newChannel[0]
    }

    return channel
  }

  async updateChannelMap(
    payload: ChannelSyncUpdatePayload,
    assemblyChannelId: string,
    dbxRootPath: string,
  ): Promise<ChannelSyncSelectType> {
    const connections = await db
      .update(channelSync)
      .set(payload)
      .where(
        and(
          eq(channelSync.portalId, this.user.portalId),
          eq(channelSync.dbxAccountId, this.connectionToken.accountId),
          eq(channelSync.assemblyChannelId, assemblyChannelId),
          eq(channelSync.dbxRootPath, dbxRootPath),
        ),
      )
      .returning()
    return connections[0]
  }

  async deleteChannelMapById(id: string) {
    await db.transaction(async (tx) => {
      const deletedAt = new Date()
      await tx
        .update(channelSync)
        .set({
          deletedAt,
          status: false,
        })
        .where(eq(channelSync.id, id))

      await tx
        .update(fileFolderSync)
        .set({
          deletedAt,
        })
        .where(eq(fileFolderSync.channelSyncId, id))
    })
  }

  async getAllChannelMaps(where?: WhereClause): Promise<ChannelSyncSelectType[]> {
    return await db.query.channelSync.findMany({
      where: (channelSync, { eq }) =>
        and(where, eq(channelSync.portalId, this.user.portalId), isNull(channelSync.deletedAt)),
    })
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
    const fileIds = await this.getDbxMappedFileIds(channelMap.id)

    const mappedEntries = parsedDbxEntries.map((entry) => {
      const fileObjectType = entry['.tag']
      if (
        (fileObjectType === ObjectType.FOLDER && entry.path_display !== dbxRootPath) ||
        fileObjectType === ObjectType.FILE
      ) {
        if (!fileIds.includes(entry.id))
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
      }
      return null
    })
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
    const fileIds = await this.getAssemblyMappedFileIds(channelMap.id)

    const mappedEntries = files.map((file) => {
      if (file.status === 'pending') return null // pending records mean files are not uploaded yet to Assembly

      const fileType = file.object
      if (fileType === ObjectType.FILE || fileType === ObjectType.FOLDER) {
        if (!fileIds.includes(file.id))
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
      }
      return null
    })
    return mappedEntries.filter((entry) => !!entry)
  }

  async listFormattedChannelMap(): Promise<MapList[]> {
    const channelMaps = await this.getAllChannelMaps()

    const channelMapPromises = []
    for (const channelMap of channelMaps) {
      channelMapPromises.push(
        copilotBottleneck.schedule(() => {
          return this.formatChannelMap(channelMap)
        }),
      )
    }

    return (await Promise.all(channelMapPromises)).filter((channelMap) => !!channelMap)
  }

  async formatChannelMap(channelMap: ChannelSyncSelectType): Promise<MapList | null> {
    try {
      let fileChannelValue: UserCompanySelectorInputValue[]
      const fileChannel = await this.copilot.retrieveFileChannel(channelMap.assemblyChannelId)

      if (fileChannel.membershipType === FileChannelMembership.COMPANY) {
        if (!fileChannel.companyId) {
          console.error('Company id not found')
          return null
        }
        const companyDetails = await this.copilot.getCompany(fileChannel.companyId)
        fileChannelValue = [
          {
            id: companyDetails.id,
            companyId: companyDetails.id,
            object: 'company' as const,
          },
        ]
      } else {
        if (!fileChannel.clientId) {
          console.error('Client id not found')
          return null
        }
        const clientDetails = await this.copilot.getClient(fileChannel.clientId)
        fileChannelValue = [
          {
            id: clientDetails.id,
            companyId: z.string().parse(fileChannel.companyId),
            object: 'client' as const,
          },
        ]
      }
      return {
        id: channelMap.id,
        fileChannelValue,
        dbxRootPath: channelMap.dbxRootPath,
        status: channelMap.status,
        fileChannelId: fileChannel.id,
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === httpStatus.BAD_REQUEST) {
        console.info('Soft delete channel map and make it inactive')
        await this.deleteChannelMapById(channelMap.id)
      }
      return null
    }
  }
}
