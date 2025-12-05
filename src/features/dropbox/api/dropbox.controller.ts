import httpStatus from 'http-status'
import { type NextRequest, NextResponse } from 'next/server'
import APIError from '@/errors/APIError'
import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import { DropboxService } from '@/features/dropbox/lib/Dropbox.service'
import User from '@/lib/copilot/models/User.model'

export const getFolderTree = async (req: NextRequest) => {
  try {
    const token = req.nextUrl.searchParams.get('token')

    const user = await User.authenticate(token)
    const dbxService = new DropboxConnectionsService(user)
    const connection = await dbxService.getConnectionForWorkspace()

    if (!connection.refreshToken) throw new APIError('No refresh token found', httpStatus.NOT_FOUND)
    if (!connection.accountId) throw new APIError('No account Id found', httpStatus.NOT_FOUND)

    const dropboxService = new DropboxService(user, {
      refreshToken: connection.refreshToken,
      accountId: connection.accountId,
      rootNamespaceId: connection.rootNamespaceId,
    })
    const folders = await dropboxService.getFolderTree()
    return NextResponse.json({ message: 'Sync initiated successfully', folders }, { status: 200 })
  } catch (error) {
    console.warn('Something went wrong', error)
    return NextResponse.json({ message: 'Something went wrong', folders: [] })
  }
}
