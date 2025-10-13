import BaseService from '@/lib/copilot/services/base.service'
import { DropboxApi } from '@/lib/dropbox/dropboxApi'
import logger from '@/lib/logger'
import DropboxConnectionsService from './DropboxConnections.service'

class AuthService extends BaseService {
  async handleDropboxCallback(urlParams: Record<string, string | string[] | undefined>) {
    try {
      const dpx = new DropboxApi()
      const { refreshToken, scope, accountId } = await dpx.handleDropboxCallback(urlParams)
      const dpxConnectionService = new DropboxConnectionsService(this.user)
      return await dpxConnectionService.updateConnectionForWorkspace({
        accountId,
        tokenSet: {
          refreshToken,
          scope,
        },
        status: true,
      })
    } catch (error) {
      logger.error('AuthService#handleDropboxCallback :: Error handling Dropbox callback:', error)
      throw new Error('Error handling Dropbox callback')
    }
  }
}

export default AuthService
