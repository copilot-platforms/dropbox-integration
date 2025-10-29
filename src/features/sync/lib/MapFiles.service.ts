import { and, eq } from 'drizzle-orm'
import db from '@/db'
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
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import type { WhereClause } from '../types'

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

  async getMappedDbxFile(filePath: string, dbxId: string, channelSyncId: string) {
    const mappedFiles = await this.getAllFileMaps(eq(fileFolderSync.channelSyncId, channelSyncId))
    return mappedFiles.find((file) => file.itemPath === filePath && file.dbxFfId === dbxId)
  }

  async getChannelMap(
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
}
