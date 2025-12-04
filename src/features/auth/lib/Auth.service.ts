import DropboxConnectionsService from '@/features/auth/lib/DropboxConnections.service'
import BaseService from '@/lib/copilot/services/base.service'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'
import type { DropboxAuthResponseType } from '@/lib/dropbox/type'
import logger from '@/lib/logger'

class AuthService extends BaseService {
  async handleDropboxCallback(urlParams: Record<string, string | string[] | undefined>) {
    logger.info(
      'AuthService#handleDropboxCallback :: Handling Dropbox callback',
      this.user.internalUserId,
    )
    let tokenSet: DropboxAuthResponseType
    try {
      const dpx = new DropboxApi()
      tokenSet = await dpx.handleDropboxCallback(urlParams)
      
      // NEW: Fetch the user's account info to get the Team Root Namespace ID
      // We temporarily need an access token for this. The tokenSet usually has it.
      // If tokenSet only has refresh token, we might need to assume dpx.dropboxAuth has the access token cached in memory 
      // or explicitly use the one returned in tokenSet if available.
      
      // Assuming dpx.dropboxAuth internal state is valid after handleDropboxCallback:
      const accessToken = dpx['dropboxAuth'].getAccessToken() 
      const accountInfo = await dpx.getCurrentAccount(accessToken)
      
      // The root_namespace_id is strictly available on root_info
      const rootNamespaceId = accountInfo.root_info?.root_namespace_id
    } catch (error) {
      logger.error('AuthService#handleDropboxCallback :: Error handling Dropbox callback:', error)
      throw new Error('Error handling Dropbox callback')
    }

    const dpxConnectionService = new DropboxConnectionsService(this.user)
    return await dpxConnectionService.updateConnectionForWorkspace({
      ...tokenSet,
      rootNamespaceId, // Save this to DB
      status: true,
    })
  }
}

export default AuthService
