import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import User from '@/lib/copilot/models/User.model'

export async function disconnectDropbox(token: string) {
  const user = await User.authenticate(token)
  const dbxService = new DropboxConnectionsService(user)
  return await dbxService.disconnect()
}
