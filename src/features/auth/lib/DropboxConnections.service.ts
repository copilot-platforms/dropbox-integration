import { eq } from 'drizzle-orm'
import status from 'http-status'
import z from 'zod'
import db from '@/db'
import { channelSync } from '@/db/schema/channelSync.schema'
import {
  type DropboxConnection,
  type DropboxConnectionUpdatePayload,
  dropboxConnections,
} from '@/db/schema/dropboxConnections.schema'
import APIError from '@/errors/APIError'
import { MAX_RECURSION_ATTEMPTS } from '@/features/auth/lib/constants'
import BaseService from '@/lib/copilot/services/base.service'
import logger from '@/lib/logger'

class DropboxConnectionsService extends BaseService {
  async getConnectionForWorkspace(attempt = 0): Promise<DropboxConnection> {
    if (attempt > MAX_RECURSION_ATTEMPTS) {
      throw new APIError('Failed to create connection', status.INTERNAL_SERVER_ERROR)
    }

    const [connection] = await db
      .select()
      .from(dropboxConnections)
      .where(eq(dropboxConnections.portalId, this.user.portalId))

    if (connection) return connection

    logger.info(
      'DropboxConnectionsService#getConnectionForWorkspace :: No connection found for workspace, creating a new one',
      this.user.internalUserId,
    )
    const [newConnection] = await db
      .insert(dropboxConnections)
      .values({
        portalId: z.string().min(1).parse(this.user.portalId),
        initiatedBy: z.uuid().parse(this.user.internalUserId),
      })
      .onConflictDoNothing()
      .returning()

    if (!newConnection) return this.getConnectionForWorkspace(attempt + 1)

    return newConnection
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
