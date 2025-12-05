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
    let tokenSet: DropboxAuthResponseType, rootNamespaceId: string

    try {
      const dbx = new DropboxApi()
      tokenSet = await dbx.handleDropboxCallback(urlParams)

      // NEW: Fetch the user's account info to get the Team Root Namespace ID
      // We temporarily need an access token for this. The tokenSet usually has it.
      // If tokenSet only has refresh token, we might need to assume dbx.dropboxAuth has the access token cached in memory
      // or explicitly use the one returned in tokenSet if available.

      console.info('AuthService#handleDropboxCallback :: Getting account info')
      const dbxClient = dbx.getDropboxClient(tokenSet.refreshToken)
      const accountInfo = await dbxClient.usersGetCurrentAccount()
      console.info('AuthService#handleDropboxCallback :: Account info', accountInfo)

      // The root_namespace_id is strictly available on root_info
      rootNamespaceId = accountInfo.result.root_info?.root_namespace_id
    } catch (error) {
      logger.error('AuthService#handleDropboxCallback :: Error handling Dropbox callback:', error)
      throw new Error('Error handling Dropbox callback')
    }

    const dbxConnectionService = new DropboxConnectionsService(this.user)
    return await dbxConnectionService.updateConnectionForWorkspace({
      ...tokenSet,
      rootNamespaceId, // Save this to DB
      status: true,
    })
  }
}

export default AuthService
