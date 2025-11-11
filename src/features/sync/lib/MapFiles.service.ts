import { and, eq, isNotNull } from 'drizzle-orm'
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
        .values({ ...payload, portalId: this.user.portalId })
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

  async getAllChannelMaps(where?: WhereClause): Promise<ChannelSyncSelectType[]> {
    return await db.query.channelSync.findMany({
      where: (channelSync, { eq }) => and(where, eq(channelSync.portalId, this.user.portalId)),
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
        if (file.status === 'pending') return null

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

    return await Promise.all(channelMapPromises)
  }

  private async formatChannelMap(channelMap: ChannelSyncSelectType): Promise<MapList> {
    const fileChannel = await this.copilot.retrieveFileChannel(channelMap.assemblyChannelId)
    let fileChannelDetail: MapList['fileChannelDetail']
    let fileChannelValue: UserCompanySelectorInputValue[]

    if (fileChannel.membershipType === FileChannelMembership.COMPANY) {
      if (!fileChannel.companyId) throw new Error('Company id not found')
      const companyDetails = await this.copilot.getCompany(fileChannel.companyId)
      fileChannelDetail = [
        {
          value: companyDetails.id,
          label: companyDetails.name,
          avatarSrc: companyDetails.iconImageUrl || undefined,
          avatarFallbackColor: companyDetails.fallbackColor || undefined,
          companyId: companyDetails.id,
          type: 'company' as const,
        },
      ]
      fileChannelValue = [
        {
          id: companyDetails.id,
          companyId: companyDetails.id,
          object: 'company' as const,
        },
      ]
    } else {
      if (!fileChannel.clientId) throw new Error('Client id not found')
      const clientDetails = await this.copilot.getClient(fileChannel.clientId)
      fileChannelDetail = [
        {
          value: clientDetails.id,
          label: clientDetails.givenName,
          avatarSrc: clientDetails.avatarImageUrl || undefined,
          avatarFallbackColor: clientDetails.fallbackColor || undefined,
          companyId: clientDetails.companyId,
          type: 'client' as const,
        },
      ]
      fileChannelValue = [
        {
          id: clientDetails.id,
          companyId: z.string().parse(fileChannel.companyId),
          object: 'client' as const,
        },
      ]
    }

    return {
      fileChannelDetail,
      fileChannelValue,
      dbxRoothPath: channelMap.dbxRootPath,
      status: channelMap.status,
      fileChannelId: fileChannel.id,
    }
  }
}
