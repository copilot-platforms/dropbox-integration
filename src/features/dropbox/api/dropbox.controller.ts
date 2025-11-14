import { type NextRequest, NextResponse } from 'next/server'
import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import { DropboxService } from '@/features/dropbox/lib/Dropbox.service'
import User from '@/lib/copilot/models/User.model'

export const getFolderTree = async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get('token')

  const user = await User.authenticate(token)
  const dbxService = new DropboxConnectionsService(user)
  const connection = await dbxService.getConnectionForWorkspace()

  if (!connection.refreshToken) throw new Error('No refresh token found')
  if (!connection.accountId) throw new Error('No accountId found')

  const dropboxService = new DropboxService(user, {
    refreshToken: connection.refreshToken,
    accountId: connection.accountId,
  })
  const folders = await dropboxService.getFolderTree()
  return NextResponse.json({ message: 'Sync initiated successfully', folders }, { status: 200 })
}
