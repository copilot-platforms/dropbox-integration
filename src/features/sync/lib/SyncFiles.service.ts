import { and, eq } from 'drizzle-orm'
import db from '@/db'
import {
  type ChannelSyncCreateType,
  type ChannelSyncSelectType,
  channelSync,
} from '@/db/schema/channelSync.schema'
import type { FileFolderSelectType } from '@/db/schema/fileFolderSync.schema'
import BaseService from '@/lib/copilot/services/base.service'
import type { WhereClause } from '../types'

export class SyncFilesService extends BaseService {
  async getSingleFileMap(where: WhereClause): Promise<FileFolderSelectType | undefined> {
    return await db.query.fileFolderSync.findFirst({
      where,
    })
  }

  async getAllFileMaps(where: WhereClause): Promise<FileFolderSelectType[]> {
    return await db.query.fileFolderSync.findMany({
      where: (fileFolderSync, { eq }) =>
        and(where, eq(fileFolderSync.portalId, this.user.portalId)),
    })
  }

  async getChannelSync(
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
}
