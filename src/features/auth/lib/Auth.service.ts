import BaseService from '@/lib/copilot/services/base.service'
import { DropboxApi } from '@/lib/dropbox/dropboxApi'
import type { DropboxAuthResponseType } from '@/lib/dropbox/type'
import logger from '@/lib/logger'
import DropboxConnectionsService from './DropboxConnections.service'

class AuthService extends BaseService {
  async handleDropboxCallback(urlParams: Record<string, string | string[] | undefined>) {
    let tokenSet: DropboxAuthResponseType
    try {
      const dpx = new DropboxApi()
      tokenSet = await dpx.handleDropboxCallback(urlParams)
    } catch (error) {
      logger.error('AuthService#handleDropboxCallback :: Error handling Dropbox callback:', error)
      throw new Error('Error handling Dropbox callback')
    }

    const dpxConnectionService = new DropboxConnectionsService(this.user)
    return await dpxConnectionService.updateConnectionForWorkspace({
      ...tokenSet,
      status: true,
    })
  }
}

export default AuthService
