import User from '@/lib/copilot/models/User.model'
import DropboxConnectionsService from '../lib/DropboxConnections.service'

export async function disconnectDropbox(token: string) {
  const user = await User.authenticate(token)
  const dbxService = new DropboxConnectionsService(user)
  return await dbxService.disconnect()
}
