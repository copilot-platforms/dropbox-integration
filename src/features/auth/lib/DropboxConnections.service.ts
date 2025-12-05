import { eq } from 'drizzle-orm'
import z from 'zod'
import db from '@/db'
import { channelSync } from '@/db/schema/channelSync.schema'
import {
  type DropboxConnection,
  type DropboxConnectionUpdatePayload,
  dropboxConnections,
} from '@/db/schema/dropboxConnections.schema'
import BaseService from '@/lib/copilot/services/base.service'
import logger from '@/lib/logger'

class DropboxConnectionsService extends BaseService {
  async getConnectionForWorkspace(): Promise<DropboxConnection> {
    let [connection] = await db
      .select()
      .from(dropboxConnections)
      .where(eq(dropboxConnections.portalId, this.user.portalId))

    if (!connection) {
      logger.info(
        'DropboxConnectionsService#getConnectionForWorkspace :: No connection found for workspace, creating a new one',
        this.user.internalUserId,
      )
      const newConnection = await db
        .insert(dropboxConnections)
        .values({
          portalId: z.string().min(1).parse(this.user.portalId),
          initiatedBy: z.uuid().parse(this.user.internalUserId),
        })
        .returning()
      connection = newConnection[0]
    }

    logger.info(
      'DropboxConnectionsService#getConnectionForWorkspace :: Found connection ',
      connection.id,
    )

    return connection
  }

  async updateConnectionForWorkspace(
    payload: DropboxConnectionUpdatePayload,
  ): Promise<DropboxConnection> {
    logger.info(
      'DropboxConnectionsService#updateConnectionForWorkspace :: Updating connection for workspace',
      this.user.internalUserId,
    )
    const connections = await db
      .update(dropboxConnections)
      .set(payload)
      .where(eq(dropboxConnections.portalId, this.user.portalId))
      .returning()
    return connections[0]
  }

  async getActiveConnection(accountId: string) {
    logger.info(
      'DropboxConnectionsService#getActiveConnection :: Getting active connection for account',
      accountId,
    )
    return await db.query.dropboxConnections.findFirst({
      where: (dropboxConnections, { eq, and }) =>
        and(eq(dropboxConnections.status, true), eq(dropboxConnections.accountId, accountId)),
      columns: {
        portalId: true,
        initiatedBy: true,
        refreshToken: true,
      },
    })
  }

  async disconnect() {
    logger.info(
      'DropboxConnectionService#disconnect :: Disconnecting for workspace ',
      this.user.portalId,
    )

    //disconnect all channel syncs and the connection.
    return await db.transaction(async (trx) => {
      await trx
        .update(channelSync)
        .set({ status: false })
        .where(eq(channelSync.portalId, this.user.portalId))

      await trx
        .update(dropboxConnections)
        .set({ status: false })
        .where(eq(dropboxConnections.portalId, this.user.portalId))
    })
  }
}

export default DropboxConnectionsService
