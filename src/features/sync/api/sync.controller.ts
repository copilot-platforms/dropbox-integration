import { type NextRequest, NextResponse } from 'next/server'
import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import User from '@/lib/copilot/models/User.model'
import { SyncService } from '../lib/Sync.service'
import { FileSyncCreateSchema } from '../types'

export const initiateSync = async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get('token')
  // const channelId = req.nextUrl.searchParams.get('channelId')

  // if (!channelId) throw new Error('No channelId found')

  const user = await User.authenticate(token)
  const dbxService = new DropboxConnectionsService(user)
  const connection = await dbxService.getConnectionForWorkspace()

  if (!connection.refreshToken) throw new Error('No refresh token found')
  if (!connection.accountId) throw new Error('No accountId found')

  const body = await req.json()
  const parsedBody = FileSyncCreateSchema.parse(body)

  // 2. get the channelId from the user
  const syncService = new SyncService(user, {
    refreshToken: connection.refreshToken,
    accountId: connection.accountId,
  })

  const channelId = await syncService.getFileChannel(parsedBody.user[0])
  await syncService.initiateSync(channelId, parsedBody.dbxRootPath)

  return NextResponse.json({ message: 'Sync initiated successfully' }, { status: 200 })
}
