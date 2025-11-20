import { type NextRequest, NextResponse } from 'next/server'
import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import { SyncService } from '@/features/sync/lib/Sync.service'
import { FileSyncCreateRequestSchema } from '@/features/sync/types'
import User from '@/lib/copilot/models/User.model'

export const initiateSync = async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get('token')
  const user = await User.authenticate(token)
  const dbxService = new DropboxConnectionsService(user)
  const connection = await dbxService.getConnectionForWorkspace()

  if (!connection.refreshToken) throw new Error('No refresh token found')
  if (!connection.accountId) throw new Error('No accountId found')

  const body = await req.json()
  const parsedBody = FileSyncCreateRequestSchema.parse(body)

  // 2. get the channelId from the user
  const syncService = new SyncService(user, {
    refreshToken: connection.refreshToken,
    accountId: connection.accountId,
  })
  await syncService.initiateSync(parsedBody.fileChannelId, parsedBody.dbxRootPath)

  return NextResponse.json({ message: 'Sync initiated successfully' }, { status: 200 })
}
