import { eq } from 'drizzle-orm'
import z from 'zod'
import db from '@/db'
import {
  type DropboxConnection,
  type DropboxConnectionUpdatePayload,
  dropboxConnections,
} from '@/db/schema/dropboxConnections.schema'
import BaseService from '@/lib/copilot/services/base.service'

class DropboxConnectionsService extends BaseService {
  async getConnectionForWorkspace(): Promise<DropboxConnection> {
    let [connection] = await db
      .select()
      .from(dropboxConnections)
      .where(eq(dropboxConnections.portalId, this.user.portalId))

    if (!connection) {
      const newConnection = await db
        .insert(dropboxConnections)
        .values({
          portalId: z.string().min(1).parse(this.user.portalId),
          initiatedBy: z.uuid().parse(this.user.internalUserId),
        })
        .returning()
      connection = newConnection[0]
    }

    return connection
  }

  async updateConnectionForWorkspace(
    payload: DropboxConnectionUpdatePayload,
  ): Promise<DropboxConnection> {
    const connections = await db
      .update(dropboxConnections)
      .set(payload)
      .where(eq(dropboxConnections.portalId, this.user.portalId))
      .returning()
    return connections[0]
  }

  async getActiveConnection(accountId: string) {
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
}

export default DropboxConnectionsService
